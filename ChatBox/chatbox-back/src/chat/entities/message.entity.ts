import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { User } from './user.entity';

@Entity()
export class Message {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  content: string;

  @Column({ nullable: true })
  gifUrl: string; // 👉 champ optionnel pour stocker un GIF (ex: lien Giphy)

  @ManyToOne(() => User, user => user.messages, { eager: true })
  user: User;

  @CreateDateColumn()
  createdAt: Date;
}
