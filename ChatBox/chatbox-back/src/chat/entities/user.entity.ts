import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Message } from './message.entity';

@Entity('users') // renomme la table en "users"
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ default: 'Anonymous' })
  name: string;


  @OneToMany(() => Message, message => message.user)
  messages: Message[];
}
