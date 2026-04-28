import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Player } from './player.entity';

export enum MatchStatus {
  ONGOING = 'ongoing',
  COMPLETED = 'completed',
}

@Entity('matches')
export class Match {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Player, { eager: true })
  @JoinColumn({ name: 'player1Id' })
  player1!: Player;

  @ManyToOne(() => Player, { eager: true })
  @JoinColumn({ name: 'player2Id' })
  player2!: Player;

  @Column({ default: 0 })
  score1!: number;

  @Column({ default: 0 })
  score2!: number;

  @Column({ type: 'enum', enum: MatchStatus, default: MatchStatus.ONGOING })
  status!: MatchStatus;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
