import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Room } from './room.entity';
import { PlaylistEntry } from './playlist-entry.entity';

@Entity('playlists')
export class Playlist {
  @PrimaryGeneratedColumn()
  id: number;

  // child of Room, FK = playlists.room_id
  @OneToOne(() => Room, (room) => room.playlist, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'room_id' })
  room: Room;

  @Column({ type: 'int', default: -1 })
  currentIndex: number; // -1 = no current video

  @OneToMany(() => PlaylistEntry, (entry) => entry.playlist, {
    cascade: true,
  })
  entries: PlaylistEntry[];
}