import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('youtube_videos')
export class YouTubeVideo {
  @PrimaryColumn({ name: 'id' })
  youtubeId: string;

  @Column()
  title: string;

  @Column()
  channelTitle: string;

  @Column({ type: 'int' })
  durationSec: number;

  @Column({ type: 'text', nullable: true })
  thumbnailUrl: string | null;
}