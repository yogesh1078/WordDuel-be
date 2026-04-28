import { Repository } from 'typeorm';
import { Guess } from './entities/guess.entity';
import { Match } from './entities/match.entity';
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
export declare class GameService {
    private readonly playerRepo;
    private readonly matchRepo;
    private readonly roundRepo;
    private readonly guessRepo;
    private readonly logger;
    private readonly dictionary;
    private readonly tickDurationMs;
    private readonly pointsToWin;
    private readonly disconnectGraceMs;
    private waitingPlayer;
    private readonly sessions;
    private readonly socketToRoom;
    constructor(playerRepo: Repository<Player>, matchRepo: Repository<Match>, roundRepo: Repository<Round>, guessRepo: Repository<Guess>);
    registerPlayer(socketId: string, username: string): Promise<{
        status: 'waiting' | 'paired';
        roomId?: string;
    }>;
    leaveWaitingLobby(socketId: string): boolean;
    private pickWord;
    private withRetry;
    private createSession;
    getSessionByRoom(roomId: string): MatchSession | undefined;
    getRoomBySocket(socketId: string): string | undefined;
    startTick(session: MatchSession, onTickEnd: () => Promise<void>): void;
    markSubmitted(session: MatchSession, playerId: string, isCorrect: boolean): boolean;
    getTickResult(session: MatchSession): {
        winnerId: string | null;
        isDraw: boolean;
    };
    isTickOpen(session: MatchSession): boolean;
    persistGuess(round: Round, player: Player, guessText: string, isCorrect: boolean, timestamp: Date): Promise<void>;
    revealRandomTile(session: MatchSession): {
        index: number;
        letter: string;
    } | null;
    isRoundFullyRevealed(session: MatchSession): boolean;
    completeRound(session: MatchSession, winnerPlayerId: string | null): Promise<void>;
    shouldEndMatch(session: MatchSession): boolean;
    startNextRound(session: MatchSession): Promise<Round>;
    endMatch(session: MatchSession): Promise<void>;
    handleDisconnect(socketId: string, onGraceWinner: (session: MatchSession, winnerId: string) => Promise<void>): void;
}
export {};
