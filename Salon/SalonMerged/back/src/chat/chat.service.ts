import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { Message } from '../entities/message.entity'; 
import { Room } from '../entities/room.entity'; 
import { ChatSession } from '../entities/chat-session.entity'; 

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Message) private messageRepo: Repository<Message>,
    @InjectRepository(Room) private roomRepo: Repository<Room>,
    @InjectRepository(ChatSession) private chatSessionRepo: Repository<ChatSession>,
  ) {}

  // GESTION UTILISATEUR
  async getOrCreateUser(name: string): Promise<User> {
    let user = await this.userRepo.findOne({ where: { name } });
    if (!user) {
      // On crée un user temporaire s'il n'existe pas
      user = this.userRepo.create({ name, role: 'MEMBER' }); 
      await this.userRepo.save(user);
    }
    return user;
  }

  async findUserById(userId: number): Promise<User | null> {
    return this.userRepo.findOne({ where: { id: userId } });
  }

  // SAUVEGARDE DU MESSAGE
  async saveMessage(
    user: User,
    content: string | undefined,
    gifUrl: string | undefined,
    codeRoom: string,
  ): Promise<Message> {
    
    // 1. Trouver la room
    const room = await this.roomRepo.findOne({ 
      where: { code: codeRoom },
      relations: ['chatSession'] 
    });

    if (!room) {
      // Fallback : Si la room est introuvable, on évite le crash mais on log l'erreur
      console.error(`Room ${codeRoom} introuvable pour le chat`);
      throw new NotFoundException('Room introuvable');
    }

    // 2. Trouver ou Créer la session de chat
    let session = room.chatSession;
    if (!session) {
      session = this.chatSessionRepo.create({ room: room });
      await this.chatSessionRepo.save(session);
    }

    // 3. Créer le message
    const message = this.messageRepo.create({
      content: content ?? null, // Accepte null si c'est un GIF
      gifUrl: gifUrl ?? null,
      user: user,
      chatSession: session,
    });

    return this.messageRepo.save(message);
  }

  // HISTORIQUE (Optionnel pour l'instant)
  async getMessagesByRoom(codeRoom: string) {
    const messages = await this.messageRepo.find({
      where: { chatSession: { room: { code: codeRoom } } },
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