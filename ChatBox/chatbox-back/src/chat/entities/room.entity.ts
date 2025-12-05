import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  OneToOne,
} from 'typeorm';

import { User } from './user.entity';
import { ChatSession } from './chat-session.entity';

@Entity('rooms')
export class Room {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  code: string;

  @Column({ type: 'text' })
  link: string;

  @Column({ name: 'qrcode', type: 'text', nullable: true })
  QRcode: string | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  lastActivityAt: Date;

  @OneToMany(() => User, (m) => m.room)
  users: User[];


  @OneToOne(() => ChatSession, (session) => session.room)
  chatSession: ChatSession;
}