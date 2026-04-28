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
var GameService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const guess_entity_1 = require("./entities/guess.entity");
const match_entity_1 = require("./entities/match.entity");
const player_entity_1 = require("./entities/player.entity");
const round_entity_1 = require("./entities/round.entity");
let GameService = GameService_1 = class GameService {
    playerRepo;
    matchRepo;
    roundRepo;
    guessRepo;
    logger = new common_1.Logger(GameService_1.name);
    dictionary = [
        'planet',
    ];
    tickDurationMs = 10000;
    pointsToWin = 3;
    disconnectGraceMs = 4000;
    waitingPlayer = null;
    sessions = new Map();
    socketToRoom = new Map();
    constructor(playerRepo, matchRepo, roundRepo, guessRepo) {
        this.playerRepo = playerRepo;
        this.matchRepo = matchRepo;
        this.roundRepo = roundRepo;
        this.guessRepo = guessRepo;
    }
    async registerPlayer(socketId, username) {
        let player = await this.playerRepo.findOne({ where: { username } });
        if (!player) {
            player = this.playerRepo.create({ username });
            player = await this.playerRepo.save(player);
        }
        const entry = { socketId, player };
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
    leaveWaitingLobby(socketId) {
        if (this.waitingPlayer?.socketId !== socketId)
            return false;
        this.waitingPlayer = null;
        return true;
    }
    pickWord() {
        return this.dictionary[Math.floor(Math.random() * this.dictionary.length)];
    }
    async withRetry(fn, retries = 2) {
        let error;
        for (let i = 0; i <= retries; i += 1) {
            try {
                return await fn();
            }
            catch (err) {
                error = err;
                this.logger.warn(`DB write failed (attempt ${i + 1}).`);
            }
        }
        throw error;
    }
    async createSession(roomId, p1, p2) {
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
        const session = {
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
            submittedThisTick: new Map(),
            active: true,
        };
        this.sessions.set(roomId, session);
        this.socketToRoom.set(p1.socketId, roomId);
        this.socketToRoom.set(p2.socketId, roomId);
        return session;
    }
    getSessionByRoom(roomId) {
        return this.sessions.get(roomId);
    }
    getRoomBySocket(socketId) {
        return this.socketToRoom.get(socketId);
    }
    startTick(session, onTickEnd) {
        if (!session.active)
            return;
        session.submittedThisTick.clear();
        session.tickEndsAt = Date.now() + session.tickDurationMs;
        if (session.tickTimer)
            clearTimeout(session.tickTimer);
        session.tickTimer = setTimeout(() => void onTickEnd(), session.tickDurationMs);
    }
    markSubmitted(session, playerId, isCorrect) {
        if (session.submittedThisTick.has(playerId))
            return false;
        session.submittedThisTick.set(playerId, isCorrect);
        return true;
    }
    getTickResult(session) {
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
    isTickOpen(session) {
        return Date.now() < session.tickEndsAt;
    }
    async persistGuess(round, player, guessText, isCorrect, timestamp) {
        const guess = this.guessRepo.create({
            round,
            player,
            guess: guessText,
            isCorrect,
            timestamp,
        });
        await this.withRetry(() => this.guessRepo.save(guess));
    }
    revealRandomTile(session) {
        const hiddenIndexes = session.revealedTiles
            .map((value, idx) => ({ value, idx }))
            .filter((entry) => !entry.value)
            .map((entry) => entry.idx);
        if (!hiddenIndexes.length)
            return null;
        const index = hiddenIndexes[Math.floor(Math.random() * hiddenIndexes.length)];
        session.revealedTiles[index] = true;
        return { index, letter: session.word[index] };
    }
    isRoundFullyRevealed(session) {
        return session.revealedTiles.every(Boolean);
    }
    async completeRound(session, winnerPlayerId) {
        const winner = winnerPlayerId
            ? (session.players.find((entry) => entry.player.id === winnerPlayerId)
                ?.player ?? null)
            : null;
        if (winner) {
            if (winner.id === session.match.player1.id)
                session.match.score1 += 1;
            if (winner.id === session.match.player2.id)
                session.match.score2 += 1;
        }
        session.round.winner = winner;
        session.round.endedAt = new Date();
        session.round.revealedTiles = session.revealedTiles;
        await this.withRetry(async () => {
            await this.roundRepo.save(session.round);
            await this.matchRepo.save(session.match);
        });
    }
    shouldEndMatch(session) {
        return (session.match.score1 >= this.pointsToWin ||
            session.match.score2 >= this.pointsToWin ||
            session.roundNumber >= 5);
    }
    async startNextRound(session) {
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
    async endMatch(session) {
        session.active = false;
        if (session.tickTimer)
            clearTimeout(session.tickTimer);
        session.tickTimer = null;
        session.match.status = match_entity_1.MatchStatus.COMPLETED;
        await this.withRetry(() => this.matchRepo.save(session.match));
        this.sessions.delete(session.roomId);
        for (const p of session.players)
            this.socketToRoom.delete(p.socketId);
    }
    handleDisconnect(socketId, onGraceWinner) {
        if (this.waitingPlayer?.socketId === socketId) {
            this.waitingPlayer = null;
            return;
        }
        const roomId = this.socketToRoom.get(socketId);
        if (!roomId)
            return;
        const session = this.sessions.get(roomId);
        if (!session || !session.active)
            return;
        const leaver = session.players.find((p) => p.socketId === socketId);
        const remaining = session.players.find((p) => p.socketId !== socketId);
        if (!leaver || !remaining)
            return;
        setTimeout(() => {
            void (async () => {
                const sameRoom = this.socketToRoom.get(remaining.socketId) === roomId;
                if (!sameRoom)
                    return;
                await onGraceWinner(session, remaining.player.id);
            })();
        }, this.disconnectGraceMs);
    }
};
exports.GameService = GameService;
exports.GameService = GameService = GameService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(player_entity_1.Player)),
    __param(1, (0, typeorm_1.InjectRepository)(match_entity_1.Match)),
    __param(2, (0, typeorm_1.InjectRepository)(round_entity_1.Round)),
    __param(3, (0, typeorm_1.InjectRepository)(guess_entity_1.Guess)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], GameService);
//# sourceMappingURL=game.service.js.map