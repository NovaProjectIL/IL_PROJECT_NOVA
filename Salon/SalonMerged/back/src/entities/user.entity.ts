import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
} from 'typeorm';
import { Message } from './message.entity';
import { Room } from './room.entity';
import { PlaylistEntry } from './playlist-entry.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ default: 'OBSERVER' })
  role: string;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  joinedAt: Date;

  @ManyToOne(() => Room, (room) => room.users, { onDelete: 'CASCADE' })
  room: Room;

  @OneToMany(() => PlaylistEntry, (entry) => entry.addedBy)
  addedEntries: PlaylistEntry[];

  @OneToMany(() => Message, (message) => message.user)
  messages: Message[];
}
