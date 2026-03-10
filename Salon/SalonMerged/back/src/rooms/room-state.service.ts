import { Injectable, Logger } from '@nestjs/common';

// Les 3 états possibles d'un salon : on regarde, on a mis pause, ou on attend que ça charge.
export enum RoomGlobalStatus {
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  LOADING = 'LOADING',
}

// Les infos qu'on garde sur chaque utilisateur connecté au salon.
export interface ClientState {
  clientId: string; // L'identifiant de sa connexion socket.
  memberId: number; // Son ID dans la base de données.
  isReady: boolean; // Est-ce que son lecteur YouTube a fini de charger ?
  joinedAt: Date;   // À quelle heure il est arrivé.
}

// La structure d'un salon dans la mémoire du serveur.
export interface RoomState {
  roomCode: string;
  status: RoomGlobalStatus;
  statusBeforeLoading: RoomGlobalStatus; // Ce qu'on faisait AVANT de passer en LOADING.
  currentTimestamp: number;    // À quelle seconde on en est dans la vidéo.
  lastUpdateServerTime: number; // L'heure exacte du serveur au moment du dernier changement.
  lastAllReadyTime: number;    // Quand le dernier all-ready a été émis (anti-cascade).
  clients: Map<string, ClientState>; // La liste de tous les gens connectés ici.
}

@Injectable()
export class RoomStateService {
  private readonly logger = new Logger(RoomStateService.name);
  // On stocke tous les salons dans une "Map" (une sorte de gros dictionnaire en mémoire).
  private rooms = new Map<string, RoomState>();

  /**
   * Si le salon n'existe pas encore en mémoire, on le crée.
   * C'est ici qu'on prépare l'endroit où on va stocker les gens et le temps de la vidéo.
   */
  getOrCreateRoomState(roomCode: string): RoomState {
    const code = roomCode.toUpperCase();
    if (!this.rooms.has(code)) {
      this.logger.log(`On prépare la mémoire pour le nouveau salon : ${code}`);
      this.rooms.set(code, {
        roomCode: code,
        status: RoomGlobalStatus.PAUSED,
        statusBeforeLoading: RoomGlobalStatus.PAUSED,
        currentTimestamp: 0,
        lastUpdateServerTime: Date.now(),
        lastAllReadyTime: 0,
        clients: new Map<string, ClientState>(),
      });
    }
    return this.rooms.get(code)!;
  }

  /**
   * On change l'état du salon (ex: on passe de PAUSE à LECTURE).
   * On note aussi à quelle seconde de la vidéo ça s'est passé.
   */
  updateStatus(roomCode: string, status: RoomGlobalStatus, timestamp?: number) {
    const state = this.getOrCreateRoomState(roomCode);
    state.status = status;
    state.lastUpdateServerTime = Date.now(); // On note l'heure actuelle du serveur.
    
    if (timestamp !== undefined) {
      state.currentTimestamp = timestamp;
    }
  }

  /**
   * Juste pour mettre à jour la seconde de la vidéo sans changer le statut.
   */
  updateTimestamp(roomCode: string, timestamp: number) {
    const state = this.getOrCreateRoomState(roomCode);
    state.currentTimestamp = timestamp;
    state.lastUpdateServerTime = Date.now();
  }

  /**
   * C'EST LE CALCUL MAGIQUE :
   * Si la vidéo joue, on calcule la vraie seconde actuelle.
   * On prend la dernière seconde enregistrée + le temps qui a passé depuis le dernier clic.
   * Ça permet à tout le monde d'être synchro à la milliseconde près.
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
   * Quand quelqu'un se connecte, on l'ajoute à la liste du salon.
   * Par défaut, il n'est pas encore "prêt" (il doit charger la vidéo).
   */
  addClient(roomCode: string, clientId: string, memberId: number) {
    const state = this.getOrCreateRoomState(roomCode);
    state.clients.set(clientId, {
      clientId,
      memberId,
      isReady: false,
      joinedAt: new Date(),
    });
  }

  /**
   * Quand quelqu'un ferme son onglet, on le retire du salon.
   */
  removeClient(clientId: string) {
    for (const [roomCode, state] of this.rooms.entries()) {
      if (state.clients.has(clientId)) {
        state.clients.delete(clientId);
        return roomCode;
      }
    }
    return null;
  }

  /**
   * Le client nous dit : "C'est bon, j'ai fini de charger la vidéo !".
   */
  setClientReady(roomCode: string, clientId: string, isReady: boolean) {
    const state = this.getOrCreateRoomState(roomCode);
    const client = state.clients.get(clientId);
    if (client) {
      client.isReady = isReady;
    }
  }

  /**
   * On vérifie si absolument TOUT LE MONDE dans le salon a fini de charger.
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
   * Donne la liste des IDs des gens qui sont en train de regarder.
   */
  getConnectedMembers(roomCode: string): number[] {
    const state = this.getOrCreateRoomState(roomCode);
    return Array.from(state.clients.values()).map(c => c.memberId);
  }

  /**
   * Quand on change de vidéo ou qu'on saute dans le temps :
   * On remet tout le monde en "pas prêt" et on attend qu'ils chargent le nouveau moment.
   */
  prepareForSeek(roomCode: string, timestamp: number) {
    const state = this.getOrCreateRoomState(roomCode);
    // Remember what we were doing before LOADING so we can restore it.
    if (state.status !== RoomGlobalStatus.LOADING) {
      state.statusBeforeLoading = state.status;
    }
    state.status = RoomGlobalStatus.LOADING;
    state.currentTimestamp = timestamp;
    state.lastUpdateServerTime = Date.now();
    
    for (const client of state.clients.values()) {
      client.isReady = false;
    }
  }

  /**
   * Est-ce que cette connexion (clientId) appartient bien à ce salon ?
   * Très important pour la sécurité !
   */
  isClientInRoom(roomCode: string, clientId: string): boolean {
    const code = roomCode.toUpperCase();
    const state = this.rooms.get(code);
    return state ? state.clients.has(clientId) : false;
  }

  /**
   * On vide tout et on recommence (utile pour une nouvelle vidéo).
   */
  resetRoomState(roomCode: string) {
    const state = this.getOrCreateRoomState(roomCode);
    state.status = RoomGlobalStatus.PAUSED;
    state.currentTimestamp = 0;
    state.lastUpdateServerTime = Date.now();
    for (const client of state.clients.values()) {
      client.isReady = false;
    }
  }

  /**
   * Petit résumé rapide de ce qui se passe dans le salon.
   */
  setLastAllReadyTime(roomCode: string) {
    const state = this.getOrCreateRoomState(roomCode);
    state.lastAllReadyTime = Date.now();
  }

  getLastAllReadyTime(roomCode: string): number {
    const state = this.getOrCreateRoomState(roomCode);
    return state.lastAllReadyTime;
  }

  getStatusBeforeLoading(roomCode: string): RoomGlobalStatus {
    const state = this.getOrCreateRoomState(roomCode);
    return state.statusBeforeLoading;
  }

  getFullState(roomCode: string) {
    const state = this.getOrCreateRoomState(roomCode);
    return {
      roomCode: state.roomCode,
      status: state.status,
      statusBeforeLoading: state.statusBeforeLoading,
      currentTimestamp: this.getAdjustedTimestamp(roomCode),
      connectedCount: state.clients.size,
      readyCount: Array.from(state.clients.values()).filter(c => c.isReady).length,
      allReady: this.areAllClientsReady(roomCode),
    };
  }
}
