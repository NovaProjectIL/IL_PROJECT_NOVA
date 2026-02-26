import { Injectable, Logger } from '@nestjs/common';

export enum RoomGlobalStatus {
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  LOADING = 'LOADING',
}

export interface ClientState {
  clientId: string;
  memberId: number;
  isReady: boolean;
  joinedAt: Date;
}

export interface RoomState {
  roomCode: string;
  status: RoomGlobalStatus;
  currentTimestamp: number;
  lastUpdateServerTime: number;
  clients: Map<string, ClientState>;
}

@Injectable()
export class RoomStateService {
  private readonly logger = new Logger(RoomStateService.name);
  private rooms = new Map<string, RoomState>();

  /**
   * Récupère ou initialise l'état d'une room
   */
  getOrCreateRoomState(roomCode: string): RoomState {
    const code = roomCode.toUpperCase();
    if (!this.rooms.has(code)) {
      this.logger.log(`Initialisation de l'état en mémoire pour la room: ${code}`);
      this.rooms.set(code, {
        roomCode: code,
        status: RoomGlobalStatus.PAUSED,
        currentTimestamp: 0,
        lastUpdateServerTime: Date.now(),
        clients: new Map<string, ClientState>(),
      });
    }
    return this.rooms.get(code)!;
  }

  /**
   * Met à jour le statut global de la room
   */
  updateStatus(roomCode: string, status: RoomGlobalStatus, timestamp?: number) {
    const state = this.getOrCreateRoomState(roomCode);
    state.status = status;
    state.lastUpdateServerTime = Date.now();
    
    if (timestamp !== undefined) {
      state.currentTimestamp = timestamp;
    }
    
    this.logger.debug(`Statut mis à jour pour ${roomCode}: ${status} à ${state.currentTimestamp}s`);
  }

  /**
   * Met à jour le timestamp actuel
   */
  updateTimestamp(roomCode: string, timestamp: number) {
    const state = this.getOrCreateRoomState(roomCode);
    state.currentTimestamp = timestamp;
    state.lastUpdateServerTime = Date.now();
  }

  /**
   * Calcule le timestamp actuel en tenant compte du temps écoulé si en lecture
   */
  getAdjustedTimestamp(roomCode: string): number {
    const state = this.getOrCreateRoomState(roomCode);
    if (state.status === RoomGlobalStatus.PLAYING) {
      const elapsed = (Date.now() - state.lastUpdateServerTime) / 1000;
      return state.currentTimestamp + elapsed;
    }
    return state.currentTimestamp;
  }

  /**
   * Ajoute ou met à jour un client dans la room
   */
  addClient(roomCode: string, clientId: string, memberId: number) {
    const state = this.getOrCreateRoomState(roomCode);
    state.clients.set(clientId, {
      clientId,
      memberId,
      isReady: false,
      joinedAt: new Date(),
    });
    this.logger.log(`Client ${clientId} (membre ${memberId}) ajouté à ${roomCode}`);
  }

  /**
   * Supprime un client de la room
   */
  removeClient(clientId: string) {
    for (const [roomCode, state] of this.rooms.entries()) {
      if (state.clients.has(clientId)) {
        state.clients.delete(clientId);
        this.logger.log(`Client ${clientId} supprimé de ${roomCode}`);
        
        // Optionnel: Si la room est vide en mémoire, on peut la nettoyer après un certain temps
        if (state.clients.size === 0) {
          // On pourrait ajouter un timer de nettoyage ici
        }
        return roomCode;
      }
    }
    return null;
  }

  /**
   * Marque un client comme prêt
   */
  setClientReady(roomCode: string, clientId: string, isReady: boolean) {
    const state = this.getOrCreateRoomState(roomCode);
    const client = state.clients.get(clientId);
    if (client) {
      client.isReady = isReady;
      this.logger.debug(`Client ${clientId} dans ${roomCode} prêt: ${isReady}`);
    }
  }

  /**
   * Vérifie si tous les clients d'une room sont prêts
   */
  areAllClientsReady(roomCode: string): boolean {
    const state = this.getOrCreateRoomState(roomCode);
    if (state.clients.size === 0) return true;
    
    for (const client of state.clients.values()) {
      if (!client.isReady) return false;
    }
    return true;
  }

  /**
   * Récupère la liste des membres ID connectés
   */
  getConnectedMembers(roomCode: string): number[] {
    const state = this.getOrCreateRoomState(roomCode);
    return Array.from(state.clients.values()).map(c => c.memberId);
  }

  /**
   * Prépare la room pour un saut temporel (seek)
   */
  prepareForSeek(roomCode: string, timestamp: number) {
    const state = this.getOrCreateRoomState(roomCode);
    state.status = RoomGlobalStatus.LOADING;
    state.currentTimestamp = timestamp;
    state.lastUpdateServerTime = Date.now();
    
    // Tout le monde doit re-confirmer qu'il est prêt au nouvel emplacement
    for (const client of state.clients.values()) {
      client.isReady = false;
    }
    
    this.logger.log(`Room ${roomCode} préparée pour seek à ${timestamp}s. Ready states réinitialisés.`);
  }

  /**
   * Vérifie si un client fait partie d'une room
   */
  isClientInRoom(roomCode: string, clientId: string): boolean {
    const code = roomCode.toUpperCase();
    const state = this.rooms.get(code);
    return state ? state.clients.has(clientId) : false;
  }

  /**
   * Réinitialise l'état de la room (ex: nouvelle vidéo)
   */
  resetRoomState(roomCode: string) {
    const state = this.getOrCreateRoomState(roomCode);
    state.status = RoomGlobalStatus.PAUSED;
    state.currentTimestamp = 0;
    state.lastUpdateServerTime = Date.now();
    
    // On remet tout le monde en "non prêt" pour le chargement de la nouvelle vidéo
    for (const client of state.clients.values()) {
      client.isReady = false;
    }
    
    this.logger.log(`État réinitialisé pour la room: ${roomCode}`);
  }

  /**
   * Récupère l'état complet pour synchronisation
   */
  getFullState(roomCode: string) {
    const state = this.getOrCreateRoomState(roomCode);
    return {
      roomCode: state.roomCode,
      status: state.status,
      currentTimestamp: this.getAdjustedTimestamp(roomCode),
      connectedCount: state.clients.size,
      readyCount: Array.from(state.clients.values()).filter(c => c.isReady).length,
      allReady: this.areAllClientsReady(roomCode),
    };
  }
}
