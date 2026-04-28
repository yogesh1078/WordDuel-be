"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const join_lobby_dto_1 = require("./dto/join-lobby.dto");
const submit_guess_dto_1 = require("./dto/submit-guess.dto");
const game_service_1 = require("./game.service");
let GameGateway = class GameGateway {
    gameService;
    server;
    constructor(gameService) {
        this.gameService = gameService;
    }
    betweenTicksDelayMs = 1500;
    handleDisconnect(client) {
        this.gameService.handleDisconnect(client.id, async (session, winnerId) => {
            await this.finishRound(session.roomId, winnerId, 'disconnect');
        });
    }
    async onJoinLobby(client, body) {
        const result = await this.gameService.registerPlayer(client.id, body.username.trim().toLowerCase());
        if (result.status === 'waiting') {
            client.emit('lobbyWaiting');
            return;
        }
        const roomId = result.roomId;
        const session = this.gameService.getSessionByRoom(roomId);
        if (!session)
            return;
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
    async onSubmitGuess(client, body) {
        const roomId = this.gameService.getRoomBySocket(client.id);
        if (!roomId)
            return;
        const session = this.gameService.getSessionByRoom(roomId);
        if (!session || !session.active || body.roundId !== session.round.id)
            return;
        const sender = session.players.find((entry) => entry.socketId === client.id);
        if (!sender)
            return;
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
        await this.gameService.persistGuess(session.round, sender.player, guess, isCorrect, submittedAt);
    }
    async onLeaveLobby(client) {
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
        if (remaining.player.id === session.match.player1.id) {
            session.match.score1 = 3;
        }
        else {
            session.match.score2 = 3;
        }
        await this.finishRound(roomId, remaining.player.id, 'player left lobby');
        client.emit('lobbyLeft', { reason: 'you left the lobby' });
    }
    startTick(roomId) {
        const session = this.gameService.getSessionByRoom(roomId);
        if (!session || !session.active)
            return;
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
    async resolveTick(roomId) {
        const session = this.gameService.getSessionByRoom(roomId);
        if (!session || !session.active)
            return;
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
        if (revealed)
            this.server.to(roomId).emit('revealTile', revealed);
        if (this.gameService.isRoundFullyRevealed(session)) {
            await this.finishRound(roomId, null, 'all tiles revealed');
            return;
        }
        setTimeout(() => {
            const stillActive = this.gameService.getSessionByRoom(roomId);
            if (!stillActive || !stillActive.active)
                return;
            this.startTick(roomId);
        }, this.betweenTicksDelayMs);
    }
    async finishRound(roomId, winnerPlayerId, reason) {
        const session = this.gameService.getSessionByRoom(roomId);
        if (!session || !session.active)
            return;
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
            const winner = session.match.score1 === session.match.score2
                ? 'draw'
                : session.match.score1 > session.match.score2
                    ? session.match.player1.id
                    : session.match.player2.id;
            const winnerUsername = session.match.score1 === session.match.score2
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
};
exports.GameGateway = GameGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], GameGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('joinLobby'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket,
        join_lobby_dto_1.JoinLobbyDto]),
    __metadata("design:returntype", Promise)
], GameGateway.prototype, "onJoinLobby", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('submitGuess'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket,
        submit_guess_dto_1.SubmitGuessDto]),
    __metadata("design:returntype", Promise)
], GameGateway.prototype, "onSubmitGuess", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('leaveLobby'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], GameGateway.prototype, "onLeaveLobby", null);
exports.GameGateway = GameGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: {
            origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:3001',
            credentials: true,
        },
    }),
    __metadata("design:paramtypes", [game_service_1.GameService])
], GameGateway);
//# sourceMappingURL=game.gateway.js.map