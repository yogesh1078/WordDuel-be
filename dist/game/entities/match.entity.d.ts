import { Player } from './player.entity';
export declare enum MatchStatus {
    ONGOING = "ongoing",
    COMPLETED = "completed"
}
export declare class Match {
    id: string;
    player1: Player;
    player2: Player;
    score1: number;
    score2: number;
    status: MatchStatus;
    createdAt: Date;
    updatedAt: Date;
}
