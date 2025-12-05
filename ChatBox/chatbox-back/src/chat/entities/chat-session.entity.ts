import {
  Entity,
  PrimaryGeneratedColumn,
  OneToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Room } from './room.entity';
import { Message } from './message.entity';

@Entity('chat_sessions')
export class ChatSession {
  @PrimaryGeneratedColumn()
  id: number;

  // child of Room, FK = chat_sessions.room_id
  @OneToOne(() => Room, (room) => room.chatSession, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'room_id' })
  room: Room;

  // messages deleted when session is deleted
  @OneToMany(() => Message, (message) => message.chatSession, {
    cascade: true,
  })
  messages: Message[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}