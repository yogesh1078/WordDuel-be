import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JoinLobbyDto } from './dto/join-lobby.dto';
import { SubmitGuessDto } from './dto/submit-guess.dto';
import { GameService } from './game.service';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:3001',
    credentials: true,
  },
})
export class GameGateway {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly gameService: GameService) {}

  private readonly betweenTicksDelayMs = 1500;

  handleDisconnect(client: Socket): void {
    this.gameService.handleDisconnect(client.id, async (session, winnerId) => {
      await this.finishRound(session.roomId, winnerId, 'disconnect');
    });
  }

  @SubscribeMessage('joinLobby')
  async onJoinLobby(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: JoinLobbyDto,
  ): Promise<void> {
    const result = await this.gameService.registerPlayer(
      client.id,
      body.username.trim().toLowerCase(),
    );
    if (result.status === 'waiting') {
      client.emit('lobbyWaiting');
      return;
    }
    const roomId = result.roomId!;
    const session = this.gameService.getSessionByRoom(roomId);
    if (!session) return;

    // Join both users to same room and start round once both are paired.
    for (const p of session.players) {
      const socket = this.server.sockets.sockets.get(p.socketId);
      void socket?.join(roomId);
      socket?.emit('paired', {
        roomId,
        playerId: p.player.id,
        username: p.player.username,
        players: session.players.map((entry) => ({
          playerId: entry.player.id,
          username: entry.player.username,
        })),
      });
    }
    this.server.to(roomId).emit('startRound', {
      wordLength: session.word.length,
      roundId: session.round.id,
      roundNumber: 1,
    });
    this.startTick(roomId);
  }

  @SubscribeMessage('submitGuess')
  async onSubmitGuess(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: SubmitGuessDto,
  ): Promise<void> {
    const roomId = this.gameService.getRoomBySocket(client.id);
    if (!roomId) return;
    const session = this.gameService.getSessionByRoom(roomId);
    if (!session || !session.active || body.roundId !== session.round.id)
      return;

    const sender = session.players.find(
      (entry) => entry.socketId === client.id,
    );
    if (!sender) return;
    if (!this.gameService.isTickOpen(session)) {
      client.emit('guessRejected', { reason: 'late submission' });
      return;
    }
    const guess = body.guessText.trim().toLowerCase();
    const submittedAt = body.timestamp ? new Date(body.timestamp) : new Date();
    const isCorrect = guess === session.word.toLowerCase();
    if (!this.gameService.markSubmitted(session, sender.player.id, isCorrect)) {
      client.emit('guessRejected', { reason: 'one guess per tick' });
      return;
    }
    await this.gameService.persistGuess(
      session.round,
      sender.player,
      guess,
      isCorrect,
      submittedAt,
    );

  }

  @SubscribeMessage('leaveLobby')
  async onLeaveLobby(@ConnectedSocket() client: Socket): Promise<void> {
    if (this.gameService.leaveWaitingLobby(client.id)) {
      client.emit('lobbyLeft', { reason: 'left waiting lobby' });
      return;
    }

    const roomId = this.gameService.getRoomBySocket(client.id);
    if (!roomId) {
      client.emit('lobbyLeft', { reason: 'not in lobby' });
      return;
    }
    const session = this.gameService.getSessionByRoom(roomId);
    if (!session || !session.active) {
      client.emit('lobbyLeft', { reason: 'not in active lobby' });
      return;
    }

    const leaver = session.players.find((entry) => entry.socketId === client.id);
    const remaining = session.players.find((entry) => entry.socketId !== client.id);
    if (!leaver || !remaining) {
      client.emit('lobbyLeft', { reason: 'unable to leave lobby' });
      return;
    }

    // Treat manual leave as forfeit so the remaining player is declared winner.
    if (remaining.player.id === session.match.player1.id) {
      session.match.score1 = 3;
    } else {
      session.match.score2 = 3;
    }
    await this.finishRound(roomId, remaining.player.id, 'player left lobby');
    client.emit('lobbyLeft', { reason: 'you left the lobby' });
  }

  private startTick(roomId: string): void {
    const session = this.gameService.getSessionByRoom(roomId);
    if (!session || !session.active) return;
    this.gameService.startTick(session, async () => {
      this.server.to(roomId).emit('tickEnd');
      await this.resolveTick(roomId);
    });
    const hiddenIndexes = session.revealedTiles
      .map((isRevealed, index) => ({ isRevealed, index }))
      .filter((entry) => !entry.isRevealed)
      .map((entry) => entry.index);
    this.server.to(roomId).emit('tickStart', {
      roundId: session.round.id,
      tickEndsAt: session.tickEndsAt,
      unrevealedPositions: hiddenIndexes,
    });
  }

  private async resolveTick(roomId: string): Promise<void> {
    const session = this.gameService.getSessionByRoom(roomId);
    if (!session || !session.active) return;
    const tickResult = this.gameService.getTickResult(session);
    if (tickResult.winnerId) {
      await this.finishRound(roomId, tickResult.winnerId, 'correct guess');
      return;
    }
    if (tickResult.isDraw) {
      await this.finishRound(roomId, null, 'both players guessed correctly');
      return;
    }

    const revealed = this.gameService.revealRandomTile(session);
    if (revealed) this.server.to(roomId).emit('revealTile', revealed);
    if (this.gameService.isRoundFullyRevealed(session)) {
      await this.finishRound(roomId, null, 'all tiles revealed');
      return;
    }
    setTimeout(() => {
      const stillActive = this.gameService.getSessionByRoom(roomId);
      if (!stillActive || !stillActive.active) return;
      this.startTick(roomId);
    }, this.betweenTicksDelayMs);
  }

  private async finishRound(
    roomId: string,
    winnerPlayerId: string | null,
    reason: string,
  ): Promise<void> {
    const session = this.gameService.getSessionByRoom(roomId);
    if (!session || !session.active) return;
    await this.gameService.completeRound(session, winnerPlayerId);
    const roundWinner = winnerPlayerId
      ? (session.players.find((entry) => entry.player.id === winnerPlayerId)?.player ??
        null)
      : null;
    this.server.to(roomId).emit('roundEnd', {
      winner: winnerPlayerId,
      winnerUsername: roundWinner?.username ?? null,
      revealedWord: session.word,
      reason,
      scores: { player1: session.match.score1, player2: session.match.score2 },
    });

    if (this.gameService.shouldEndMatch(session)) {
      const winner =
        session.match.score1 === session.match.score2
          ? 'draw'
          : session.match.score1 > session.match.score2
            ? session.match.player1.id
            : session.match.player2.id;
      const winnerUsername =
        session.match.score1 === session.match.score2
          ? 'draw'
          : session.match.score1 > session.match.score2
            ? session.match.player1.username
            : session.match.player2.username;
      this.server.to(roomId).emit('matchEnd', {
        winner,
        winnerUsername,
        finalScores: {
          player1: session.match.score1,
          player2: session.match.score2,
        },
      });
      await this.gameService.endMatch(session);
      return;
    }

    setTimeout(() => {
      void (async () => {
        const nextRound = await this.gameService.startNextRound(session);
        this.server.to(roomId).emit('startRound', {
          wordLength: session.word.length,
          roundId: nextRound.id,
          roundNumber: session.roundNumber,
        });
        this.startTick(roomId);
      })();
    }, 2000);
  }
}
