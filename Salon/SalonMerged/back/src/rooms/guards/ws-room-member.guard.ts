import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { RoomStateService } from '../room-state.service';

@Injectable()
export class WsRoomMemberGuard implements CanActivate {
  private readonly logger = new Logger(WsRoomMemberGuard.name);

  constructor(private readonly roomStateService: RoomStateService) {}

  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient();
    const data = context.switchToWs().getData();

    if (!data || !data.codeRoom) {
      this.logger.warn(`Tentative d'action WebSocket sans code de room par le client: ${client.id}`);
      throw new WsException('Code de room manquant');
    }

    const roomCode = data.codeRoom.toUpperCase();
    const isMember = this.roomStateService.isClientInRoom(roomCode, client.id);

    if (!isMember) {
      this.logger.error(`ACCÈS REFUSÉ : Le client ${client.id} a tenté une action dans la room ${roomCode} sans y être inscrit.`);
      throw new WsException(`Vous ne faites pas partie de la room ${roomCode}`);
    }

    return true;
  }
}
