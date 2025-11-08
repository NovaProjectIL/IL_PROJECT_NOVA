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

  // ✅ On accepte maintenant message texte OU gifUrl
  async saveMessage(user: User, content?: string, gifUrl?: string): Promise<Message> {
    const message = this.messageRepo.create({ user, content, gifUrl });
    return this.messageRepo.save(message);
  }

  async getAllMessages(): Promise<{ username: string; message?: string; gifUrl?: string }[]> {
    const messages = await this.messageRepo.find({ relations: ['user'], order: { createdAt: 'ASC' } });
    return messages.map(m => ({
      username: m.user.name,
      message: m.content,
      gifUrl: m.gifUrl,
    }));
  }
}
