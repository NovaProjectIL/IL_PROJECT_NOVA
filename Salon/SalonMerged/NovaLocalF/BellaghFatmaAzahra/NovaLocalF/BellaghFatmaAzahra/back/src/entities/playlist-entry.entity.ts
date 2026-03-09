import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Playlist } from './playlist.entity';
import { YouTubeVideo } from './youtube-video.entity';
import { User } from './user.entity';

@Entity('playlist_entries')
export class PlaylistEntry {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Playlist, (playlist) => playlist.entries, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'playlist_id' })
  playlist: Playlist;

  @ManyToOne(() => YouTubeVideo, { eager: false })
  @JoinColumn({ name: 'video_id' })
  video: YouTubeVideo;

  @Column({ type: 'int' })
  position: number;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  addedAt: Date;

  @ManyToOne(() => User, (user) => user.addedEntries, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'added_by_id' })
  addedBy: User | null;
}