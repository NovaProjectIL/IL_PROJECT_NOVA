import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
// Import de TES entités
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

  // --- GESTION UTILISATEUR ---
  async getOrCreateUser(name: string): Promise<User> {
    let user = await this.userRepo.findOne({ where: { name } });
    if (!user) {
      // Par défaut role = MEMBER selon ton entité
      user = this.userRepo.create({ name: name || "Utilisateur" });
      await this.userRepo.save(user);
    }
    return user;
  }

  async findUserById(userId: number): Promise<User | null> {
    return this.userRepo.findOne({ where: { id: userId } });
  }

  async updateUserName(userId: number, newName: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found.`);
    }
    user.name = newName;
    return this.userRepo.save(user);
  }

  // --- SAUVEGARDE DU MESSAGE (Le cœur du système) ---
  async saveMessage(
    user: User,
    content: string | undefined,
    gifUrl: string | undefined,
    codeRoom: string, // On reçoit le code (ex: GQANZS)
  ): Promise<Message> {
    
    // 1. Trouver la Room via son code (colonne 'code' dans Room entity)
    const room = await this.roomRepo.findOne({ 
      where: { code: codeRoom },
      relations: ['chatSession'] 
    });

    if (!room) {
      throw new NotFoundException(`Room avec le code ${codeRoom} introuvable.`);
    }

    // 2. Vérifier ou créer la ChatSession (Relation OneToOne dans Room)
    let session = room.chatSession;
    if (!session) {
      session = this.chatSessionRepo.create({ room: room });
      await this.chatSessionRepo.save(session);
    }

    // 3. Créer le message lié à la SESSION et à l'USER
    // Ton entité Message a bien 'user' et 'chatSession'
    const message = this.messageRepo.create({
      content: content ?? null,
      gifUrl: gifUrl ?? null,
      user: user,
      chatSession: session,
    });

    return this.messageRepo.save(message);
  }

  // --- RÉCUPÉRATION HISTORIQUE ---
  async getMessagesByRoom(codeRoom: string) {
    // On cherche les messages liés à la session de la room donnée
    const messages = await this.messageRepo.find({
      where: {
        chatSession: {
          room: { code: codeRoom } // Jointure automatique TypeORM
        }
      },
      relations: ['user'], // Pour avoir le pseudo de l'auteur
      order: { createdAt: 'ASC' },
    });

    return messages.map((m) => ({
      username: m.user?.name || 'Utilisateur', // Gestion du user nullable (SET NULL)
      userId: m.user?.id ?? null,
      message: m.content ?? undefined,
      gifUrl: m.gifUrl ?? undefined,
      createdAt: m.createdAt,
    }));
  }
}