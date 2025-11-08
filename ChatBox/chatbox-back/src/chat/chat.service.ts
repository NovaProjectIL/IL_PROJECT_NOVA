import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Message } from './entities/message.entity';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Message) private messageRepo: Repository<Message>,
  ) {}

  async getOrCreateUser(name: string): Promise<User> {
    let user = await this.userRepo.findOne({ where: { name } });
    if (!user) {
      user = this.userRepo.create({ name });
      await this.userRepo.save(user);
    }
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return this.userRepo.find();
  }

  // Création d'un message en instanciant la classe directement (évite les problèmes de typing)
  async saveMessage(
    user: User,
    content?: string,
    gifUrl?: string,
  ): Promise<Message> {
    const message = new Message();            // <-- instanciation explicite
    message.user = user;
    message.content = content ?? null;
    message.gifUrl = gifUrl ?? null;
    // createdAt sera géré par @CreateDateColumn
    return this.messageRepo.save(message);
  }

  // Retourne l'historique formaté (username + message + gifUrl + createdAt)
  async getAllMessages(): Promise<
    { username: string; message?: string; gifUrl?: string; createdAt: Date }[]
  > {
    const messages = await this.messageRepo.find({
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });

    return messages.map((m) => ({
      username: m.user?.name ?? 'Inconnu',
      message: m.content ?? undefined,
      gifUrl: m.gifUrl ?? undefined,
      createdAt: m.createdAt,
    }));
  }
}
