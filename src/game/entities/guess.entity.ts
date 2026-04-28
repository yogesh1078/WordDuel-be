import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Round } from './round.entity';
import { Player } from './player.entity';

@Entity('guesses')
export class Guess {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Round, { eager: true })
  @JoinColumn({ name: 'roundId' })
  round!: Round;

  @ManyToOne(() => Player, { eager: true })
  @JoinColumn({ name: 'playerId' })
  player!: Player;

  @Column()
  guess!: string;

  @Column()
  isCorrect!: boolean;

  @Column()
  timestamp!: Date;
}
