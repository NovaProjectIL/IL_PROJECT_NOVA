import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  
} from 'typeorm';
import { Message } from './message.entity';
import { Room } from './room.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ default: 'MEMBER' })
  role: string;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  joinedAt: Date;

  @ManyToOne(() => Room, (room) => room.users, { onDelete: 'CASCADE' })
  room: Room;

  @OneToMany(() => Message, (message) => message.user)
  messages: Message[];
}