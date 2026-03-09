import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { RoomStateService } from '../room-state.service';

@Injectable()
export class WsRoomMemberGuard implements CanActivate {
  private readonly logger = new Logger(WsRoomMemberGuard.name);

  constructor(private readonly roomStateService: RoomStateService) {}

  /**
   * Cette fonction décide si on laisse passer l'action ou si on la bloque.
   */
  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient(); // La personne qui envoie le message.
    const data = context.switchToWs().getData();     // Les données envoyées (ex: {codeRoom: 'XYZ'}).

    // 1. On vérifie qu'on nous a bien donné un code de salon.
    if (!data || !data.codeRoom) {
      this.logger.warn(`Un client (${client.id}) essaie de faire un truc sans donner de code de salon.`);
      throw new WsException('Erreur : Il manque le code du salon.');
    }

    const roomCode = data.codeRoom.toUpperCase();
    
    // 2. On demande au RoomStateService si ce client fait bien partie de ce salon.
    const isMember = this.roomStateService.isClientInRoom(roomCode, client.id);

    // 3. Si c'est un intrus, on bloque et on affiche une erreur rouge dans la console.
    if (!isMember) {
      this.logger.error(`SÉCURITÉ : L'utilisateur ${client.id} a tenté de modifier le salon ${roomCode} alors qu'il n'y est pas !`);
      throw new WsException(`Accès refusé : Vous ne faites pas partie de ce salon.`);
    }

    // 4. Si tout est bon, on laisse l'action s'exécuter.
    return true;
  }
}
