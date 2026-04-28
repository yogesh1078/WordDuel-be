import { Match } from './match.entity';
import { Player } from './player.entity';
export declare class Round {
    id: string;
    match: Match;
    word: string;
    revealedTiles: boolean[];
    winner: Player | null;
    roundNumber: number;
    createdAt: Date;
    endedAt: Date | null;
}
