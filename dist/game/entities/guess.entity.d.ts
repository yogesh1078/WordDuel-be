import { Round } from './round.entity';
import { Player } from './player.entity';
export declare class Guess {
    id: string;
    round: Round;
    player: Player;
    guess: string;
    isCorrect: boolean;
    timestamp: Date;
}
