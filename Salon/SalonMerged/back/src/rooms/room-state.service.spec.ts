/**
 * ==============================================================
 *  TESTS UNITAIRES — RoomStateService (Machine d'état de sync)
 * ==============================================================
 *
 * Ce fichier teste le service qui gère la synchronisation vidéo
 * entre tous les utilisateurs d'un salon.
 *
 * On vérifie les fonctionnalités suivantes :
 *   1. Création et état initial d'une room
 *   2. Gestion des clients (ajout, suppression, ready)
 *   3. Transitions d'état (PLAYING / PAUSED / LOADING)
 *   4. Calcul du timestamp ajusté (drift serveur)
 *   5. Mécanisme Wait-for-Ready (seek → LOADING → all-ready)
 *   6. Timeout de sécurité LOADING (8 secondes max)
 *   7. Sécurité (vérification d'appartenance à la room)
 *   8. Sync-check périodique (détection de drift entre clients)
 *   9. Reset (changement de vidéo)
 *  10. getFullState (résumé complet de l'état du salon)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { RoomStateService, RoomGlobalStatus } from './room-state.service';

describe('RoomStateService', () => {
  let service: RoomStateService;

  // Avant chaque test, on crée une nouvelle instance propre du service.
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RoomStateService],
    }).compile();

    service = module.get<RoomStateService>(RoomStateService);
  });

  // On nettoie les timers pour éviter les fuites dans les tests.
  afterEach(() => {
    jest.clearAllTimers();
  });

  // ──────────────────────────────────────────────────────────────────
  //  1. CRÉATION ET ÉTAT INITIAL D'UNE ROOM
  // ──────────────────────────────────────────────────────────────────

  describe('Création d\'une room', () => {
    it('devrait créer une room avec le statut PAUSED par défaut', () => {
      const state = service.getOrCreateRoomState('ROOM1');

      expect(state.status).toBe(RoomGlobalStatus.PAUSED);
      expect(state.currentTimestamp).toBe(0);
      expect(state.clients.size).toBe(0);
    });

    it('devrait retourner la même room si elle existe déjà', () => {
      const first = service.getOrCreateRoomState('ROOM1');
      first.currentTimestamp = 42;

      const second = service.getOrCreateRoomState('ROOM1');

      // C'est le même objet, pas une copie
      expect(second.currentTimestamp).toBe(42);
    });

    it('devrait normaliser le code en majuscules', () => {
      service.addClient('room1', 'clientA', 1);

      // "room1" et "ROOM1" doivent pointer vers le même salon
      expect(service.isClientInRoom('ROOM1', 'clientA')).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────
  //  2. GESTION DES CLIENTS (connexion, déconnexion, ready)
  // ──────────────────────────────────────────────────────────────────

  describe('Gestion des clients', () => {
    it('devrait ajouter un client à la room', () => {
      service.addClient('ROOM1', 'socket-1', 101);

      const state = service.getOrCreateRoomState('ROOM1');
      expect(state.clients.size).toBe(1);
      expect(state.clients.get('socket-1')?.memberId).toBe(101);
    });

    it('le client ne devrait PAS être ready par défaut', () => {
      service.addClient('ROOM1', 'socket-1', 101);

      const client = service.getOrCreateRoomState('ROOM1').clients.get('socket-1');
      expect(client?.isReady).toBe(false);
    });

    it('devrait retirer un client et retourner le code de la room', () => {
      service.addClient('ROOM1', 'socket-1', 101);

      const roomCode = service.removeClient('socket-1');

      expect(roomCode).toBe('ROOM1');
      expect(service.getOrCreateRoomState('ROOM1').clients.size).toBe(0);
    });

    it('devrait retourner null si le client n\'existe pas', () => {
      const result = service.removeClient('inexistant');
      expect(result).toBeNull();
    });

    it('devrait marquer un client comme ready', () => {
      service.addClient('ROOM1', 'socket-1', 101);

      service.setClientReady('ROOM1', 'socket-1', true);

      const client = service.getOrCreateRoomState('ROOM1').clients.get('socket-1');
      expect(client?.isReady).toBe(true);
    });

    it('devrait lister les membres connectés', () => {
      service.addClient('ROOM1', 'socket-1', 10);
      service.addClient('ROOM1', 'socket-2', 20);

      const members = service.getConnectedMembers('ROOM1');

      expect(members).toContain(10);
      expect(members).toContain(20);
      expect(members.length).toBe(2);
    });
  });

  // ──────────────────────────────────────────────────────────────────
  //  3. TRANSITIONS D'ÉTAT (PAUSED ↔ PLAYING ↔ LOADING)
  // ──────────────────────────────────────────────────────────────────

  describe('Transitions d\'état', () => {
    it('devrait passer de PAUSED à PLAYING', () => {
      service.updateStatus('ROOM1', RoomGlobalStatus.PLAYING, 10);

      const state = service.getOrCreateRoomState('ROOM1');
      expect(state.status).toBe(RoomGlobalStatus.PLAYING);
      expect(state.currentTimestamp).toBe(10);
    });

    it('devrait passer de PLAYING à PAUSED', () => {
      service.updateStatus('ROOM1', RoomGlobalStatus.PLAYING, 10);
      service.updateStatus('ROOM1', RoomGlobalStatus.PAUSED, 15);

      const state = service.getOrCreateRoomState('ROOM1');
      expect(state.status).toBe(RoomGlobalStatus.PAUSED);
      expect(state.currentTimestamp).toBe(15);
    });

    it('devrait mettre à jour le timestamp sans changer le statut', () => {
      service.updateStatus('ROOM1', RoomGlobalStatus.PLAYING, 0);
      service.updateTimestamp('ROOM1', 42);

      const state = service.getOrCreateRoomState('ROOM1');
      expect(state.status).toBe(RoomGlobalStatus.PLAYING); // inchangé
      expect(state.currentTimestamp).toBe(42);
    });
  });

  // ──────────────────────────────────────────────────────────────────
  //  4. CALCUL DU TIMESTAMP AJUSTÉ (drift du serveur)
  // ──────────────────────────────────────────────────────────────────

  describe('Calcul du timestamp ajusté', () => {
    it('si PAUSED, le timestamp ne bouge pas', () => {
      service.updateStatus('ROOM1', RoomGlobalStatus.PAUSED, 30);

      // Même si du temps passe, la position reste à 30s
      const adjusted = service.getAdjustedTimestamp('ROOM1');
      expect(adjusted).toBe(30);
    });

    it('si PLAYING, le timestamp avance avec le temps réel', async () => {
      service.updateStatus('ROOM1', RoomGlobalStatus.PLAYING, 10);

      // On attend 100ms pour simuler le passage du temps
      await new Promise(resolve => setTimeout(resolve, 100));

      const adjusted = service.getAdjustedTimestamp('ROOM1');

      // Le timestamp devrait avoir avancé d'environ 0.1s
      expect(adjusted).toBeGreaterThan(10);
      expect(adjusted).toBeLessThan(11);
    });
  });

  // ──────────────────────────────────────────────────────────────────
  //  5. MÉCANISME WAIT-FOR-READY (seek / buffering)
  // ──────────────────────────────────────────────────────────────────

  describe('Wait-for-Ready (prepareForSeek)', () => {
    it('devrait passer en LOADING et sauvegarder l\'état précédent', () => {
      // La room est en PLAYING, quelqu'un fait un seek
      service.updateStatus('ROOM1', RoomGlobalStatus.PLAYING, 10);
      service.addClient('ROOM1', 'socket-1', 1);
      service.addClient('ROOM1', 'socket-2', 2);

      // Un utilisateur saute à la seconde 60
      service.prepareForSeek('ROOM1', 60);

      const state = service.getOrCreateRoomState('ROOM1');
      expect(state.status).toBe(RoomGlobalStatus.LOADING);
      expect(state.statusBeforeLoading).toBe(RoomGlobalStatus.PLAYING);
      expect(state.currentTimestamp).toBe(60);
    });

    it('devrait remettre TOUS les clients en not-ready', () => {
      service.addClient('ROOM1', 'socket-1', 1);
      service.addClient('ROOM1', 'socket-2', 2);
      service.setClientReady('ROOM1', 'socket-1', true);
      service.setClientReady('ROOM1', 'socket-2', true);

      service.prepareForSeek('ROOM1', 60);

      // Plus personne n'est prêt
      expect(service.areAllClientsReady('ROOM1')).toBe(false);
    });

    it('devrait reprendre quand TOUS les clients sont prêts', () => {
      service.addClient('ROOM1', 'socket-1', 1);
      service.addClient('ROOM1', 'socket-2', 2);
      service.prepareForSeek('ROOM1', 60);

      // Client 1 a fini de charger
      service.setClientReady('ROOM1', 'socket-1', true);
      expect(service.areAllClientsReady('ROOM1')).toBe(false);

      // Client 2 a fini de charger → TOUT LE MONDE est prêt !
      service.setClientReady('ROOM1', 'socket-2', true);
      expect(service.areAllClientsReady('ROOM1')).toBe(true);
    });

    it('devrait sauvegarder PAUSED si on était en pause avant le seek', () => {
      service.updateStatus('ROOM1', RoomGlobalStatus.PAUSED, 5);
      service.prepareForSeek('ROOM1', 30);

      expect(service.getStatusBeforeLoading('ROOM1')).toBe(RoomGlobalStatus.PAUSED);
    });
  });

  // ──────────────────────────────────────────────────────────────────
  //  6. TIMEOUT DE SÉCURITÉ LOADING (max 8 secondes)
  // ──────────────────────────────────────────────────────────────────

  describe('Timeout LOADING (8 secondes)', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('devrait appeler le callback après 8 secondes de LOADING', () => {
      const callback = jest.fn();
      service.onLoadingTimeout(callback);

      service.addClient('ROOM1', 'socket-1', 1);
      service.prepareForSeek('ROOM1', 10);

      // 7.9 secondes → pas encore déclenché
      jest.advanceTimersByTime(7900);
      expect(callback).not.toHaveBeenCalled();

      // +200ms → 8.1s total → déclenché !
      jest.advanceTimersByTime(200);
      expect(callback).toHaveBeenCalledWith('ROOM1');
    });

    it('ne devrait PAS déclencher le timeout si on sort de LOADING avant 8s', () => {
      const callback = jest.fn();
      service.onLoadingTimeout(callback);

      service.addClient('ROOM1', 'socket-1', 1);
      service.prepareForSeek('ROOM1', 10);

      // Après 3s, le client est prêt → on sort de LOADING
      jest.advanceTimersByTime(3000);
      service.updateStatus('ROOM1', RoomGlobalStatus.PLAYING, 10);

      // Même après 10s le callback ne doit PAS se déclencher
      jest.advanceTimersByTime(7000);
      expect(callback).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────
  //  7. SÉCURITÉ — Vérification d'appartenance
  // ──────────────────────────────────────────────────────────────────

  describe('Sécurité (isClientInRoom)', () => {
    it('devrait retourner true si le client est dans la room', () => {
      service.addClient('ROOM1', 'socket-1', 1);
      expect(service.isClientInRoom('ROOM1', 'socket-1')).toBe(true);
    });

    it('devrait retourner false si le client n\'est PAS dans la room', () => {
      service.addClient('ROOM1', 'socket-1', 1);
      expect(service.isClientInRoom('ROOM1', 'socket-inconnu')).toBe(false);
    });

    it('devrait retourner false pour une room qui n\'existe pas', () => {
      expect(service.isClientInRoom('INEXISTANTE', 'socket-1')).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────
  //  8. SYNC-CHECK PÉRIODIQUE (détection de drift entre clients)
  // ──────────────────────────────────────────────────────────────────

  describe('Sync-check périodique (détection de drift)', () => {
    it('devrait détecter un drift quand les positions sont trop éloignées (>3s)', () => {
      service.addClient('ROOM1', 'socket-1', 1);
      service.addClient('ROOM1', 'socket-2', 2);

      // Client 1 est à 30s, Client 2 est à 34s → 4s de drift
      service.updateClientPosition('ROOM1', 'socket-1', 30);
      service.updateClientPosition('ROOM1', 'socket-2', 34);

      const result = service.getPositionDrift('ROOM1');

      expect(result.drifted).toBe(true);
      expect(result.maxDrift).toBe(4);
      expect(result.positions).toEqual([30, 34]);
    });

    it('ne devrait PAS détecter de drift si les positions sont proches (≤3s)', () => {
      service.addClient('ROOM1', 'socket-1', 1);
      service.addClient('ROOM1', 'socket-2', 2);

      // Client 1 est à 30s, Client 2 est à 32.5s → seulement 2.5s
      service.updateClientPosition('ROOM1', 'socket-1', 30);
      service.updateClientPosition('ROOM1', 'socket-2', 32.5);

      const result = service.getPositionDrift('ROOM1');

      expect(result.drifted).toBe(false);
      expect(result.maxDrift).toBe(2.5);
    });

    it('ne devrait pas analyser avec moins de 2 clients', () => {
      service.addClient('ROOM1', 'socket-1', 1);
      service.updateClientPosition('ROOM1', 'socket-1', 30);

      const result = service.getPositionDrift('ROOM1');

      expect(result.drifted).toBe(false);
      expect(result.positions).toEqual([]);
    });

    it('devrait lister uniquement les rooms PLAYING avec >1 client', () => {
      // PLAYING + 2 clients → OUI
      service.updateStatus('ROOM1', RoomGlobalStatus.PLAYING, 10);
      service.addClient('ROOM1', 'socket-1', 1);
      service.addClient('ROOM1', 'socket-2', 2);

      // PAUSED + 2 clients → NON
      service.updateStatus('ROOM2', RoomGlobalStatus.PAUSED, 0);
      service.addClient('ROOM2', 'socket-3', 3);
      service.addClient('ROOM2', 'socket-4', 4);

      // PLAYING + 1 seul client → NON
      service.updateStatus('ROOM3', RoomGlobalStatus.PLAYING, 5);
      service.addClient('ROOM3', 'socket-5', 5);

      const rooms = service.getPlayingRooms();

      expect(rooms).toContain('ROOM1');
      expect(rooms).not.toContain('ROOM2');
      expect(rooms).not.toContain('ROOM3');
    });
  });

  // ──────────────────────────────────────────────────────────────────
  //  9. RESET (changement de vidéo)
  // ──────────────────────────────────────────────────────────────────

  describe('Reset (changement de vidéo)', () => {
    it('devrait remettre le salon à zéro', () => {
      service.updateStatus('ROOM1', RoomGlobalStatus.PLAYING, 120);
      service.addClient('ROOM1', 'socket-1', 1);
      service.setClientReady('ROOM1', 'socket-1', true);

      service.resetRoomState('ROOM1');

      const state = service.getOrCreateRoomState('ROOM1');
      expect(state.status).toBe(RoomGlobalStatus.PAUSED);
      expect(state.currentTimestamp).toBe(0);
      expect(state.clients.get('socket-1')?.isReady).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────
  //  10. getFullState (résumé complet)
  // ──────────────────────────────────────────────────────────────────

  describe('getFullState (résumé)', () => {
    it('devrait donner un résumé complet de la room', () => {
      service.updateStatus('ROOM1', RoomGlobalStatus.PLAYING, 50);
      service.addClient('ROOM1', 'socket-1', 1);
      service.addClient('ROOM1', 'socket-2', 2);
      service.setClientReady('ROOM1', 'socket-1', true);

      const summary = service.getFullState('ROOM1');

      expect(summary.roomCode).toBe('ROOM1');
      expect(summary.status).toBe(RoomGlobalStatus.PLAYING);
      expect(summary.connectedCount).toBe(2);
      expect(summary.readyCount).toBe(1);   // Seul socket-1 est prêt
      expect(summary.allReady).toBe(false);  // socket-2 pas encore prêt
    });
  });

  // ──────────────────────────────────────────────────────────────────
  //  11. TESTS DE CHARGE — Beaucoup d'utilisateurs dans un salon
  // ──────────────────────────────────────────────────────────────────
  //
  // Ces tests vérifient que le service ne crash pas et reste correct
  // quand il y a 50 ou 100 utilisateurs simultanés dans un salon.
  // On teste : ajout/suppression en masse, ready en masse, seek avec
  // beaucoup de clients, drift-check avec beaucoup de positions, etc.
  //

  describe('Charge — 50 utilisateurs dans un salon', () => {
    const ROOM = 'BIG-ROOM';
    const NUM_CLIENTS = 50;

    // Ajouter 50 clients au salon avant chaque test de charge
    beforeEach(() => {
      for (let i = 0; i < NUM_CLIENTS; i++) {
        service.addClient(ROOM, `socket-${i}`, i + 1);
      }
    });

    it('devrait supporter 50 clients connectés sans erreur', () => {
      const state = service.getOrCreateRoomState(ROOM);
      expect(state.clients.size).toBe(NUM_CLIENTS);

      // Vérifier que chaque client est bien là
      for (let i = 0; i < NUM_CLIENTS; i++) {
        expect(service.isClientInRoom(ROOM, `socket-${i}`)).toBe(true);
      }
    });

    it('devrait lister correctement les 50 membres connectés', () => {
      const members = service.getConnectedMembers(ROOM);
      expect(members.length).toBe(NUM_CLIENTS);

      // Vérifier qu'on a bien les IDs de 1 à 50
      for (let i = 1; i <= NUM_CLIENTS; i++) {
        expect(members).toContain(i);
      }
    });

    it('areAllClientsReady devrait être false si un seul client n\'est pas prêt', () => {
      // On marque 49 clients comme prêts
      for (let i = 0; i < NUM_CLIENTS - 1; i++) {
        service.setClientReady(ROOM, `socket-${i}`, true);
      }
      // Le dernier n'est PAS prêt → résultat = false
      expect(service.areAllClientsReady(ROOM)).toBe(false);

      // On marque le dernier comme prêt → résultat = true
      service.setClientReady(ROOM, `socket-${NUM_CLIENTS - 1}`, true);
      expect(service.areAllClientsReady(ROOM)).toBe(true);
    });

    it('prepareForSeek devrait remettre les 50 clients en not-ready', () => {
      // D'abord, marquer tout le monde comme prêt
      for (let i = 0; i < NUM_CLIENTS; i++) {
        service.setClientReady(ROOM, `socket-${i}`, true);
      }
      expect(service.areAllClientsReady(ROOM)).toBe(true);

      // Un seek remet tout le monde en not-ready
      service.prepareForSeek(ROOM, 300);

      expect(service.areAllClientsReady(ROOM)).toBe(false);
      const state = service.getOrCreateRoomState(ROOM);
      for (const client of state.clients.values()) {
        expect(client.isReady).toBe(false);
      }
    });

    it('resetRoomState devrait fonctionner avec 50 clients', () => {
      service.updateStatus(ROOM, RoomGlobalStatus.PLAYING, 500);
      for (let i = 0; i < NUM_CLIENTS; i++) {
        service.setClientReady(ROOM, `socket-${i}`, true);
      }

      service.resetRoomState(ROOM);

      const state = service.getOrCreateRoomState(ROOM);
      expect(state.status).toBe(RoomGlobalStatus.PAUSED);
      expect(state.currentTimestamp).toBe(0);
      // Tous les clients sont toujours là, mais plus prêts
      expect(state.clients.size).toBe(NUM_CLIENTS);
      for (const client of state.clients.values()) {
        expect(client.isReady).toBe(false);
      }
    });

    it('devrait supporter la suppression de clients un par un', () => {
      // Retirer la moitié des clients
      for (let i = 0; i < 25; i++) {
        const roomCode = service.removeClient(`socket-${i}`);
        expect(roomCode).toBe(ROOM);
      }

      const state = service.getOrCreateRoomState(ROOM);
      expect(state.clients.size).toBe(25);

      // Les clients restants sont toujours bien là
      for (let i = 25; i < NUM_CLIENTS; i++) {
        expect(service.isClientInRoom(ROOM, `socket-${i}`)).toBe(true);
      }
    });

    it('getFullState devrait être correct avec 50 clients (30 prêts)', () => {
      service.updateStatus(ROOM, RoomGlobalStatus.LOADING, 60);
      // 30 clients prêts, 20 pas prêts
      for (let i = 0; i < 30; i++) {
        service.setClientReady(ROOM, `socket-${i}`, true);
      }

      const summary = service.getFullState(ROOM);

      expect(summary.connectedCount).toBe(50);
      expect(summary.readyCount).toBe(30);
      expect(summary.allReady).toBe(false);
    });

    it('getPositionDrift devrait fonctionner avec 50 positions proches', () => {
      // Tous les clients reportent une position similaire (±0.5s autour de 100s)
      for (let i = 0; i < NUM_CLIENTS; i++) {
        const position = 100 + (i % 10) * 0.1; // entre 100.0 et 100.9
        service.updateClientPosition(ROOM, `socket-${i}`, position);
      }

      const result = service.getPositionDrift(ROOM);

      // Drift max ≈ 0.9s → pas de problème (seuil = 3s)
      expect(result.drifted).toBe(false);
      expect(result.maxDrift).toBeLessThan(3);
      expect(result.positions.length).toBe(NUM_CLIENTS);
    });

    it('getPositionDrift devrait détecter un drift parmi 50 clients', () => {
      // 49 clients sont à 100s, 1 client est à 106s → drift de 6s
      for (let i = 0; i < NUM_CLIENTS - 1; i++) {
        service.updateClientPosition(ROOM, `socket-${i}`, 100);
      }
      service.updateClientPosition(ROOM, `socket-${NUM_CLIENTS - 1}`, 106);

      const result = service.getPositionDrift(ROOM);

      expect(result.drifted).toBe(true);
      expect(result.maxDrift).toBe(6);
    });

    it('getPlayingRooms devrait inclure une room PLAYING avec 50 clients', () => {
      service.updateStatus(ROOM, RoomGlobalStatus.PLAYING, 10);

      const rooms = service.getPlayingRooms();
      expect(rooms).toContain(ROOM);
    });
  });

  describe('Charge — 100 utilisateurs, transitions rapides', () => {
    const ROOM = 'HUGE-ROOM';
    const NUM_CLIENTS = 100;

    it('devrait supporter 100 clients qui font seek → ready en séquence rapide', () => {
      // Ajouter 100 clients
      for (let i = 0; i < NUM_CLIENTS; i++) {
        service.addClient(ROOM, `s-${i}`, i + 1);
      }
      service.updateStatus(ROOM, RoomGlobalStatus.PLAYING, 50);

      // Un seek met tout le monde en LOADING
      service.prepareForSeek(ROOM, 200);
      expect(service.getOrCreateRoomState(ROOM).status).toBe(RoomGlobalStatus.LOADING);

      // Tous les 100 clients deviennent prêts un par un
      for (let i = 0; i < NUM_CLIENTS; i++) {
        service.setClientReady(ROOM, `s-${i}`, true);

        if (i < NUM_CLIENTS - 1) {
          // Pas encore tout le monde → areAllClientsReady = false
          expect(service.areAllClientsReady(ROOM)).toBe(false);
        }
      }

      // Maintenant tout le monde est prêt
      expect(service.areAllClientsReady(ROOM)).toBe(true);
    });

    it('devrait supporter des seeks répétés avec 100 clients', () => {
      for (let i = 0; i < NUM_CLIENTS; i++) {
        service.addClient(ROOM, `s-${i}`, i + 1);
      }

      // Simuler 10 seeks rapides d'affilée
      for (let seekNum = 1; seekNum <= 10; seekNum++) {
        const seekTo = seekNum * 30;
        service.prepareForSeek(ROOM, seekTo);

        // Vérifier que l'état est cohérent à chaque seek
        const state = service.getOrCreateRoomState(ROOM);
        expect(state.status).toBe(RoomGlobalStatus.LOADING);
        expect(state.currentTimestamp).toBe(seekTo);

        // Tous les clients doivent être not-ready
        for (const client of state.clients.values()) {
          expect(client.isReady).toBe(false);
        }

        // Remettre tout le monde prêt pour le seek suivant
        for (let i = 0; i < NUM_CLIENTS; i++) {
          service.setClientReady(ROOM, `s-${i}`, true);
        }
        service.updateStatus(ROOM, RoomGlobalStatus.PLAYING, seekTo);
      }
    });

    it('devrait supporter des déconnexions massives sans crash', () => {
      for (let i = 0; i < NUM_CLIENTS; i++) {
        service.addClient(ROOM, `s-${i}`, i + 1);
      }

      // 80 clients se déconnectent d'un coup
      for (let i = 0; i < 80; i++) {
        const code = service.removeClient(`s-${i}`);
        expect(code).toBe(ROOM);
      }

      // 20 clients restants
      const state = service.getOrCreateRoomState(ROOM);
      expect(state.clients.size).toBe(20);

      // Le salon doit toujours fonctionner normalement
      service.prepareForSeek(ROOM, 100);
      for (let i = 80; i < NUM_CLIENTS; i++) {
        service.setClientReady(ROOM, `s-${i}`, true);
      }
      expect(service.areAllClientsReady(ROOM)).toBe(true);
    });

    it('devrait supporter des reconnexions (même memberId, nouveau socket)', () => {
      // 50 clients rejoignent
      for (let i = 0; i < 50; i++) {
        service.addClient(ROOM, `old-${i}`, i + 1);
      }

      // 50 clients se déconnectent
      for (let i = 0; i < 50; i++) {
        service.removeClient(`old-${i}`);
      }
      expect(service.getOrCreateRoomState(ROOM).clients.size).toBe(0);

      // 50 clients se reconnectent avec de nouveaux sockets
      for (let i = 0; i < 50; i++) {
        service.addClient(ROOM, `new-${i}`, i + 1);
      }

      const state = service.getOrCreateRoomState(ROOM);
      expect(state.clients.size).toBe(50);

      // Seek + all-ready fonctionne avec les nouveaux sockets
      service.prepareForSeek(ROOM, 60);
      for (let i = 0; i < 50; i++) {
        service.setClientReady(ROOM, `new-${i}`, true);
      }
      expect(service.areAllClientsReady(ROOM)).toBe(true);
    });
  });
});
