import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Guess } from './entities/guess.entity';
import { Match, MatchStatus } from './entities/match.entity';
import { Player } from './entities/player.entity';
import { Round } from './entities/round.entity';

export interface SessionPlayer {
  socketId: string;
  player: Player;
}

interface MatchSession {
  roomId: string;
  match: Match;
  round: Round;
  word: string;
  revealedTiles: boolean[];
  players: SessionPlayer[];
  roundNumber: number;
  tickDurationMs: number;
  tickEndsAt: number;
  tickTimer: NodeJS.Timeout | null;
  submittedThisTick: Map<string, boolean>;
  active: boolean;
}

@Injectable()
export class GameService {
  private readonly logger = new Logger(GameService.name);
  private readonly dictionary = [
    'planet',
    // 'puzzle',
    // 'anchor',
    // 'rocket',
    // 'socket',
    // 'memory',
    // 'galaxy',
    // 'forest',
  ];
  private readonly tickDurationMs = 10000;
  private readonly pointsToWin = 3;
  private readonly disconnectGraceMs = 4000;

  private waitingPlayer: SessionPlayer | null = null;
  private readonly sessions = new Map<string, MatchSession>();
  private readonly socketToRoom = new Map<string, string>();

  constructor(
    @InjectRepository(Player) private readonly playerRepo: Repository<Player>,
    @InjectRepository(Match) private readonly matchRepo: Repository<Match>,
    @InjectRepository(Round) private readonly roundRepo: Repository<Round>,
    @InjectRepository(Guess) private readonly guessRepo: Repository<Guess>,
  ) {}

  async registerPlayer(
    socketId: string,
    username: string,
  ): Promise<{ status: 'waiting' | 'paired'; roomId?: string }> {
    let player = await this.playerRepo.findOne({ where: { username } });
    if (!player) {
      player = this.playerRepo.create({ username });
      player = await this.playerRepo.save(player);
    }
    const entry: SessionPlayer = { socketId, player };

    if (!this.waitingPlayer) {
      this.waitingPlayer = entry;
      return { status: 'waiting' };
    }

    const first = this.waitingPlayer;
    this.waitingPlayer = null;
    const roomId = `room-${crypto.randomUUID()}`;
    await this.createSession(roomId, first, entry);
    return { status: 'paired', roomId };
  }

  leaveWaitingLobby(socketId: string): boolean {
    if (this.waitingPlayer?.socketId !== socketId) return false;
    this.waitingPlayer = null;
    return true;
  }

  private pickWord(): string {
    return this.dictionary[Math.floor(Math.random() * this.dictionary.length)];
  }

  private async withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
    let error: unknown;
    for (let i = 0; i <= retries; i += 1) {
      try {
        return await fn();
      } catch (err) {
        error = err;
        this.logger.warn(`DB write failed (attempt ${i + 1}).`);
      }
    }
    throw error;
  }

  private async createSession(
    roomId: string,
    p1: SessionPlayer,
    p2: SessionPlayer,
  ): Promise<MatchSession> {
    let match = this.matchRepo.create({
      player1: p1.player,
      player2: p2.player,
      score1: 0,
      score2: 0,
    });
    match = await this.matchRepo.save(match);
    const word = this.pickWord();
    const revealedTiles = word.split('').map(() => false);
    let round = this.roundRepo.create({
      match,
      word,
      revealedTiles,
      roundNumber: 1,
      winner: null,
      endedAt: null,
    });
    round = await this.roundRepo.save(round);

    const session: MatchSession = {
      roomId,
      match,
      round,
      word,
      revealedTiles,
      players: [p1, p2],
      roundNumber: 1,
      tickDurationMs: this.tickDurationMs,
      tickEndsAt: 0,
      tickTimer: null,
      submittedThisTick: new Map<string, boolean>(),
      active: true,
    };
    this.sessions.set(roomId, session);
    this.socketToRoom.set(p1.socketId, roomId);
    this.socketToRoom.set(p2.socketId, roomId);
    return session;
  }

  getSessionByRoom(roomId: string): MatchSession | undefined {
    return this.sessions.get(roomId);
  }

  getRoomBySocket(socketId: string): string | undefined {
    return this.socketToRoom.get(socketId);
  }

  startTick(session: MatchSession, onTickEnd: () => Promise<void>): void {
    if (!session.active) return;
    session.submittedThisTick.clear();
    session.tickEndsAt = Date.now() + session.tickDurationMs;
    if (session.tickTimer) clearTimeout(session.tickTimer);
    session.tickTimer = setTimeout(
      () => void onTickEnd(),
      session.tickDurationMs,
    );
  }

  markSubmitted(
    session: MatchSession,
    playerId: string,
    isCorrect: boolean,
  ): boolean {
    if (session.submittedThisTick.has(playerId)) return false;
    session.submittedThisTick.set(playerId, isCorrect);
    return true;
  }

  getTickResult(session: MatchSession): { winnerId: string | null; isDraw: boolean } {
    const correctPlayers = Array.from(session.submittedThisTick.entries())
      .filter(([, isCorrect]) => isCorrect)
      .map(([id]) => id);
    if (correctPlayers.length === 1) {
      return { winnerId: correctPlayers[0], isDraw: false };
    }
    if (correctPlayers.length > 1) {
      return { winnerId: null, isDraw: true };
    }
    return { winnerId: null, isDraw: false };
  }

  isTickOpen(session: MatchSession): boolean {
    return Date.now() < session.tickEndsAt;
  }

  async persistGuess(
    round: Round,
    player: Player,
    guessText: string,
    isCorrect: boolean,
    timestamp: Date,
  ): Promise<void> {
    const guess = this.guessRepo.create({
      round,
      player,
      guess: guessText,
      isCorrect,
      timestamp,
    });
    await this.withRetry(() => this.guessRepo.save(guess));
  }

  revealRandomTile(
    session: MatchSession,
  ): { index: number; letter: string } | null {
    const hiddenIndexes = session.revealedTiles
      .map((value, idx) => ({ value, idx }))
      .filter((entry) => !entry.value)
      .map((entry) => entry.idx);
    if (!hiddenIndexes.length) return null;
    const index =
      hiddenIndexes[Math.floor(Math.random() * hiddenIndexes.length)];
    session.revealedTiles[index] = true;
    return { index, letter: session.word[index] };
  }

  isRoundFullyRevealed(session: MatchSession): boolean {
    return session.revealedTiles.every(Boolean);
  }

  async completeRound(
    session: MatchSession,
    winnerPlayerId: string | null,
  ): Promise<void> {
    const winner = winnerPlayerId
      ? (session.players.find((entry) => entry.player.id === winnerPlayerId)
          ?.player ?? null)
      : null;

    if (winner) {
      if (winner.id === session.match.player1.id) session.match.score1 += 1;
      if (winner.id === session.match.player2.id) session.match.score2 += 1;
    }

    session.round.winner = winner;
    session.round.endedAt = new Date();
    session.round.revealedTiles = session.revealedTiles;

    await this.withRetry(async () => {
      await this.roundRepo.save(session.round);
      await this.matchRepo.save(session.match);
    });
  }

  shouldEndMatch(session: MatchSession): boolean {
    return (
      session.match.score1 >= this.pointsToWin ||
      session.match.score2 >= this.pointsToWin ||
      session.roundNumber >= 5
    );
  }

  async startNextRound(session: MatchSession): Promise<Round> {
    session.roundNumber += 1;
    session.word = this.pickWord();
    session.revealedTiles = session.word.split('').map(() => false);
    let round = this.roundRepo.create({
      match: session.match,
      word: session.word,
      revealedTiles: session.revealedTiles,
      roundNumber: session.roundNumber,
      winner: null,
      endedAt: null,
    });
    round = await this.roundRepo.save(round);
    session.round = round;
    return round;
  }

  async endMatch(session: MatchSession): Promise<void> {
    session.active = false;
    if (session.tickTimer) clearTimeout(session.tickTimer);
    session.tickTimer = null;
    session.match.status = MatchStatus.COMPLETED;
    await this.withRetry(() => this.matchRepo.save(session.match));
    this.sessions.delete(session.roomId);
    for (const p of session.players) this.socketToRoom.delete(p.socketId);
  }

  handleDisconnect(
    socketId: string,
    onGraceWinner: (session: MatchSession, winnerId: string) => Promise<void>,
  ): void {
    if (this.waitingPlayer?.socketId === socketId) {
      this.waitingPlayer = null;
      return;
    }
    const roomId = this.socketToRoom.get(socketId);
    if (!roomId) return;
    const session = this.sessions.get(roomId);
    if (!session || !session.active) return;

    const leaver = session.players.find((p) => p.socketId === socketId);
    const remaining = session.players.find((p) => p.socketId !== socketId);
    if (!leaver || !remaining) return;

    setTimeout(() => {
      void (async () => {
        const sameRoom = this.socketToRoom.get(remaining.socketId) === roomId;
        if (!sameRoom) return;
        await onGraceWinner(session, remaining.player.id);
      })();
    }, this.disconnectGraceMs);
  }
}
