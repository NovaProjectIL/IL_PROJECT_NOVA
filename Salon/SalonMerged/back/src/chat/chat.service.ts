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

  // --- GESTION UTILISATEUR ---
  async getOrCreateUser(name: string): Promise<User> {
    let user = await this.userRepo.findOne({ where: { name } });
    if (!user) {
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

  // --- SAUVEGARDE DU MESSAGE ---
  async saveMessage(
    user: User,
    content: string | undefined,
    gifUrl: string | undefined,
    codeRoom: string,
    timecode: number | null = null,
  ): Promise<Message> {
    
    // 1. Trouver la Room
    const room = await this.roomRepo.findOne({ 
      where: { code: codeRoom },
      relations: ['chatSession', 'playbackState'] 
    });

    if (!room) {
      throw new NotFoundException(`Room avec le code ${codeRoom} introuvable.`);
    }

    // 2. Vérifier ou créer la ChatSession
    let session = room.chatSession;
    if (!session) {
      session = this.chatSessionRepo.create({ room: room });
      await this.chatSessionRepo.save(session);
    }

    // 3. Créer le message
    let resolvedTimecode = timecode ?? null;
    if (resolvedTimecode == null && room.playbackState) {
      const playback = room.playbackState;
      let position = playback.positionSec ?? 0;
      if (playback.status === 'PLAYING' && playback.serverTimeRef) {
        const elapsedMs = Date.now() - new Date(playback.serverTimeRef).getTime();
        position += (elapsedMs / 1000) * (playback.playbackRate ?? 1);
      }
      resolvedTimecode = Math.max(0, Math.floor(position));
    }

    const message = this.messageRepo.create({
      content: content ?? null,
      gifUrl: gifUrl ?? null,
      timecode: resolvedTimecode,
      user: user,
      chatSession: session,
    });

    return this.messageRepo.save(message);
  }

  // --- RÉCUPÉRATION HISTORIQUE AVEC userId ✅ ---
  async getMessagesByRoom(codeRoom: string) {
    const messages = await this.messageRepo.find({
      where: {
        chatSession: {
          room: { code: codeRoom }
        }
      },
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });

    return messages.map((m) => ({
      username: m.user?.name || 'Utilisateur',
      userId: m.user?.id ?? null, // ✅ FIX PRINCIPAL : Inclure l'userId
      message: m.content ?? undefined,
      gifUrl: m.gifUrl ?? undefined,
      timecode: m.timecode ?? null,
      createdAt: m.createdAt,
    }));
  }
}
