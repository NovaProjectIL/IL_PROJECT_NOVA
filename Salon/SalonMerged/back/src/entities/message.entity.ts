import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { ChatSession } from './chat-session.entity';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text', nullable: true })
  content: string | null;

  @Column({ type: 'text', nullable: true })
  gifUrl: string | null;

  // ✅ CORRECTION : Ajout de la colonne timecode
  // Permet de stocker la position dans la vidéo au moment de l'envoi du message.
  // Utilisé par le badge cliquable "⏱ MM:SS" dans le chat pour naviguer dans la vidéo.
  // nullable: true car les anciens messages n'ont pas de timecode.
  @Column({ type: 'int', nullable: true })
  timecode: number | null;

  // when user deleted => user_id set to NULL, message stays
  @ManyToOne(() => User, (user) => user.messages, {
    eager: true,
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  // when session deleted => message deleted
  @ManyToOne(() => ChatSession, (session) => session.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'chat_session_id' })
  chatSession: ChatSession;
}