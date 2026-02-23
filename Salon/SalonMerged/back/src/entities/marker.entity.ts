// marker.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { Room } from './room.entity';
import { User } from './user.entity';
import { YouTubeVideo } from './youtube-video.entity';

export enum MarkerCategory {
  ERROR       = 'ERROR',      
  COMMENT     = 'COMMENT',     
  HIGHLIGHT   = 'HIGHLIGHT',   
  QUESTION    = 'QUESTION',    
}

@Entity('markers')
export class Marker {
  @PrimaryGeneratedColumn()
  id: number;

  // Position en secondes dans la vidéo 
  @Column({ type: 'float' })
  timeSec: number;

  // Titre court obligatoire 
  @Column({ type: 'varchar', length: 100 })
  label: string;

  // Description optionnelle longue
  @Column({ type: 'text', nullable: true })
  content: string | null;

  @Column({
    type: 'enum',
    enum: MarkerCategory,
    default: MarkerCategory.COMMENT,
  })
  category: MarkerCategory;

  // --- Gestion des conflits : Optimistic Locking ---
  // TypeORM incrémente ce champ automatiquement à chaque UPDATE.
  // Si deux clients sauvegardent en même temps, le second recevra une erreur OptimisticLockVersionMismatch.
  @VersionColumn()
  version: number;

  // --- Relations ---

  // Marqueur supprimé si la room est supprimée
  @ManyToOne(() => Room, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'room_id' })
  room: Room;

  // Marqueur conservé si l'user est supprimé (user_id → NULL)
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL', eager: true })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User | null;

  // Référence à la vidéo YouTube
  @ManyToOne(() => YouTubeVideo, { nullable: false, eager: false })
  @JoinColumn({ name: 'video_id' })
  video: YouTubeVideo;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}