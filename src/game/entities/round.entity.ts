import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Match } from './match.entity';
import { Player } from './player.entity';

@Entity('rounds')
export class Round {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Match, { eager: true })
  @JoinColumn({ name: 'matchId' })
  match!: Match;

  @Column()
  word!: string;

  @Column({ type: 'simple-json' })
  revealedTiles!: boolean[];

  @ManyToOne(() => Player, { nullable: true, eager: true })
  @JoinColumn({ name: 'winnerId' })
  winner!: Player | null;

  @Column()
  roundNumber!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  endedAt!: Date | null;
}
