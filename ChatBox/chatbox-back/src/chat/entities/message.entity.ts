import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text', nullable: true })
  content: string | null; // ✅ permet de stocker null

  @Column({ type: 'text', nullable: true })
  gifUrl: string | null; // ✅ permet de stocker null

  @ManyToOne(() => User, (user) => user.messages, {
    eager: true,
    onDelete: 'CASCADE',
  })
  user: User;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;
}
