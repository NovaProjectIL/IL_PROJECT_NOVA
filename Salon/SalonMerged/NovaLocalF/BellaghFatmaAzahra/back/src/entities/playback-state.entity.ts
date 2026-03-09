import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { Room } from './room.entity';
import { YouTubeVideo } from './youtube-video.entity';

export enum PlayStatus {
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  ENDED = 'ENDED',
}

export enum PlaybackSourceType {
  PLAYLIST = 'PLAYLIST',
  DIRECT = 'DIRECT',
}

@Entity('playback_states')
export class PlaybackState {
  @PrimaryGeneratedColumn()
  id: number;

  // child of Room, FK = playback_states.room_id
  @OneToOne(() => Room, (room) => room.playbackState, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'room_id' })
  room: Room;

  @Column({
    type: 'enum',
    enum: PlayStatus,
    default: PlayStatus.PAUSED,
  })
  status: PlayStatus;

  @Column({ type: 'int', default: 0 })
  positionSec: number;

  @Column({ type: 'float', default: 1.0 })
  playbackRate: number;

  @Column({ type: 'timestamptz', nullable: true })
  serverTimeRef: Date | null;

  @ManyToOne(() => YouTubeVideo, { nullable: true })
  @JoinColumn({ name: 'video_id' })
  video: YouTubeVideo | null;

  @Column({
    type: 'enum',
    enum: PlaybackSourceType,
    nullable: true,
  })
  sourceType: PlaybackSourceType | null;
}