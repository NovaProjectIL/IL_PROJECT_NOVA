/**
 * ==============================================================
 *  TESTS UNITAIRES — RoomsGateway (WebSocket sync events)
 * ==============================================================
 *
 * Ce fichier teste le Gateway WebSocket qui orchestre
 * la synchronisation vidéo entre tous les clients connectés.
 *
 * On utilise des "mocks" : ce sont des faux objets qui imitent
 * le vrai service pour qu'on puisse tester le gateway tout seul,
 * sans avoir besoin de la base de données ni de vrais sockets.
 *
 * Fonctionnalités testées :
 *   1. Sécurité : validation des payloads (room code, membership)
 *   2. Play / Pause : gestion des commandes de lecture
 *   3. Seek : saut dans la vidéo + déclenchement du LOADING
 *   4. Client-buffering : un client rame → tout le monde attend
 *   5. Client-ready / all-ready : reprise quand tout le monde est prêt
 *   6. Timeout LOADING 8s : reprise forcée si ça bloque trop longtemps
 *   7. Déconnexion : gestion propre quand un client quitte
 *   8. Position-report : réponse au sync-check périodique
 */

import { Test, TestingModule } from '@nestjs/testing';
import { RoomsGateway } from './rooms.gateway';
import { RoomsService } from './rooms.service';
import { RoomStateService, RoomGlobalStatus } from './room-state.service';

describe('RoomsGateway', () => {
  let gateway: RoomsGateway;
  let roomsService: Partial<Record<string, jest.Mock>>;
  let stateService: RoomStateService;

  // ── Faux serveur Socket.io (mock) ────────────────────────────────

  const mockServer = {
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  };

  // ── Faux client Socket.io (mock) ─────────────────────────────────

  const createMockSocket = (id = 'socket-1') => ({
    id,
    join: jest.fn(),
    emit: jest.fn(),
    to: jest.fn().mockReturnThis(),
  });

  // Petite astuce : certaines méthodes du gateway sont "async".
  // On doit "vider la file d'attente" des promises pour voir leurs résultats.
  const flushPromises = () => new Promise(resolve => setImmediate(resolve));

  // ── Mise en place avant chaque test ──────────────────────────────

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomsGateway,
        // On utilise le VRAI RoomStateService (pas un mock)
        // car il est léger (juste de la mémoire) et ça rend les tests plus fiables
        RoomStateService,
        {
          // Par contre, le RoomsService (qui accède à la DB) est un mock
          provide: RoomsService,
          useValue: {
            stateRoom: jest.fn().mockResolvedValue({
              playbackState: { status: 'PAUSED', positionSec: 0, playbackRate: 1 },
              users: [],
            }),
            play: jest.fn().mockResolvedValue({
              playback: { status: 'PLAYING', positionSec: 0, serverTimeRef: new Date() },
            }),
            pause: jest.fn().mockResolvedValue({}),
            seek: jest.fn().mockResolvedValue({
              playback: { positionSec: 0, serverTimeRef: new Date() },
            }),
            getRoomByCode: jest.fn().mockResolvedValue({ id: 1 }),
            getPlaybackState: jest.fn().mockResolvedValue({ positionSec: 0 }),
          },
        },
      ],
    }).compile();

    gateway = module.get<RoomsGateway>(RoomsGateway);
    roomsService = module.get(RoomsService);
    stateService = module.get<RoomStateService>(RoomStateService);

    // Injecter le faux serveur
    gateway.server = mockServer as any;

    // Initialiser le gateway (enregistre le callback timeout + sync-check)
    gateway.afterInit();
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Nettoyer le timer périodique du sync-check
    if ((gateway as any).syncCheckTimer) {
      clearInterval((gateway as any).syncCheckTimer);
    }
  });

  // ──────────────────────────────────────────────────────────────────
  //  1. SÉCURITÉ — Validation des payloads
  // ──────────────────────────────────────────────────────────────────

  describe('Sécurité — validation des payloads', () => {
    it('devrait rejeter un play avec un codeRoom vide', async () => {
      const socket = createMockSocket();

      await gateway.handlePlay(socket as any, { codeRoom: '', positionSec: 10 });

      // Le serveur ne doit PAS avoir envoyé de playback-updated
      expect(mockServer.emit).not.toHaveBeenCalled();
    });

    it('devrait rejeter un play si le client n\'est pas membre de la room', async () => {
      const socket = createMockSocket('intrus');
      // On ne l'ajoute PAS à la room → il n'est pas membre

      await gateway.handlePlay(socket as any, { codeRoom: 'ROOM1', positionSec: 10 });

      // Le client doit recevoir une erreur
      expect(socket.emit).toHaveBeenCalledWith('error', expect.objectContaining({
        message: expect.any(String),
      }));
    });

    it('devrait rejeter un seek avec une position négative', async () => {
      const socket = createMockSocket();
      stateService.addClient('ROOM1', 'socket-1', 1);

      await gateway.handleSeek(socket as any, {
        codeRoom: 'ROOM1',
        positionSec: -5,  // invalide !
      });

      // Le client reçoit une erreur de seek
      expect(socket.emit).toHaveBeenCalledWith('seek-error', expect.any(Object));
    });

    it('devrait rejeter un seek avec une position non-numérique', async () => {
      const socket = createMockSocket();
      stateService.addClient('ROOM1', 'socket-1', 1);

      await gateway.handleSeek(socket as any, {
        codeRoom: 'ROOM1',
        positionSec: 'abc' as any,  // pas un nombre !
      });

      expect(socket.emit).toHaveBeenCalledWith('seek-error', expect.any(Object));
    });
  });

  // ──────────────────────────────────────────────────────────────────
  //  2. PLAY / PAUSE — Commandes de lecture
  // ──────────────────────────────────────────────────────────────────

  describe('Play / Pause', () => {
    it('devrait émettre playback-updated avec action "play"', async () => {
      const socket = createMockSocket();
      stateService.addClient('ROOM1', socket.id, 1);

      await gateway.handlePlay(socket as any, { codeRoom: 'ROOM1', positionSec: 10 });

      // Le serveur doit broadcaster à toute la room
      expect(mockServer.to).toHaveBeenCalledWith('ROOM1');
      expect(mockServer.emit).toHaveBeenCalledWith('playback-updated', expect.objectContaining({
        action: 'play',
      }));
    });

    it('devrait émettre playback-updated avec action "pause"', async () => {
      const socket = createMockSocket();
      stateService.addClient('ROOM1', socket.id, 1);

      await gateway.handlePause(socket as any, { codeRoom: 'ROOM1', positionSec: 15 });

      expect(mockServer.to).toHaveBeenCalledWith('ROOM1');
      expect(mockServer.emit).toHaveBeenCalledWith('playback-updated', expect.objectContaining({
        action: 'pause',
      }));
    });

    it('devrait IGNORER un play si la room est en LOADING', async () => {
      const socket = createMockSocket();
      stateService.addClient('ROOM1', socket.id, 1);
      stateService.prepareForSeek('ROOM1', 30); // La room est en LOADING

      await gateway.handlePlay(socket as any, { codeRoom: 'ROOM1', positionSec: 30 });

      // play doit être ignoré pendant le LOADING
      expect(roomsService.play).not.toHaveBeenCalled();
    });

    it('devrait IGNORER un pause si la room est en LOADING', async () => {
      const socket = createMockSocket();
      stateService.addClient('ROOM1', socket.id, 1);
      stateService.prepareForSeek('ROOM1', 30);

      await gateway.handlePause(socket as any, { codeRoom: 'ROOM1', positionSec: 30 });

      expect(roomsService.pause).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────
  //  3. SEEK — Saut dans la vidéo + LOADING
  // ──────────────────────────────────────────────────────────────────

  describe('Seek (saut dans la vidéo)', () => {
    it('devrait émettre force-seek à toute la room', async () => {
      const socket = createMockSocket();
      stateService.addClient('ROOM1', socket.id, 1);

      await gateway.handleSeek(socket as any, { codeRoom: 'ROOM1', positionSec: 60 });

      expect(mockServer.to).toHaveBeenCalledWith('ROOM1');
      expect(mockServer.emit).toHaveBeenCalledWith('force-seek', expect.objectContaining({
        timecode: 60,
      }));
    });

    it('devrait passer la room en LOADING après un seek', async () => {
      const socket = createMockSocket();
      stateService.addClient('ROOM1', socket.id, 1);

      await gateway.handleSeek(socket as any, { codeRoom: 'ROOM1', positionSec: 60 });

      const state = stateService.getOrCreateRoomState('ROOM1');
      expect(state.status).toBe(RoomGlobalStatus.LOADING);
    });

    it('devrait remettre tous les clients en not-ready après un seek', async () => {
      const socket1 = createMockSocket('s1');
      const socket2 = createMockSocket('s2');
      stateService.addClient('ROOM1', 's1', 1);
      stateService.addClient('ROOM1', 's2', 2);
      stateService.setClientReady('ROOM1', 's1', true);
      stateService.setClientReady('ROOM1', 's2', true);

      await gateway.handleSeek(socket1 as any, { codeRoom: 'ROOM1', positionSec: 60 });

      // Tout le monde doit être remis en not-ready
      expect(stateService.areAllClientsReady('ROOM1')).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────
  //  4. CLIENT-BUFFERING — Un client rame, tout le monde attend
  // ──────────────────────────────────────────────────────────────────

  describe('Client-buffering (un client rame)', () => {
    it('devrait émettre force-pause avec le bufferingClientId', () => {
      const socket = createMockSocket('slow-client');
      stateService.addClient('ROOM1', 'slow-client', 1);
      stateService.updateStatus('ROOM1', RoomGlobalStatus.PLAYING, 30);
      // Il faut que lastUpdateServerTime soit > 1s pour passer le cooldown
      const state = stateService.getOrCreateRoomState('ROOM1');
      state.lastUpdateServerTime = Date.now() - 2000;

      gateway.handleClientBuffering(socket as any, {
        codeRoom: 'ROOM1',
        positionSec: 30,
      });

      expect(mockServer.to).toHaveBeenCalledWith('ROOM1');
      expect(mockServer.emit).toHaveBeenCalledWith('force-pause', expect.objectContaining({
        reason: 'client-buffering',
        bufferingClientId: 'slow-client',
      }));
    });

    it('devrait IGNORER le buffering si la room n\'est pas en PLAYING', () => {
      const socket = createMockSocket();
      stateService.addClient('ROOM1', socket.id, 1);
      stateService.updateStatus('ROOM1', RoomGlobalStatus.PAUSED, 10);

      gateway.handleClientBuffering(socket as any, {
        codeRoom: 'ROOM1',
        positionSec: 10,
      });

      // Pas de force-pause car la room est déjà en pause
      expect(mockServer.emit).not.toHaveBeenCalled();
    });

    it('devrait IGNORER le buffering pendant le cooldown anti-cascade (3s)', () => {
      const socket = createMockSocket();
      stateService.addClient('ROOM1', socket.id, 1);
      stateService.updateStatus('ROOM1', RoomGlobalStatus.PLAYING, 10);
      // Simuler un all-ready récent (il y a 1 seconde)
      stateService.setLastAllReadyTime('ROOM1');

      gateway.handleClientBuffering(socket as any, {
        codeRoom: 'ROOM1',
        positionSec: 10,
      });

      // Le buffering doit être ignoré car il y a eu un all-ready récemment
      expect(mockServer.emit).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────
  //  5. CLIENT-READY / ALL-READY — Reprise synchronisée
  // ──────────────────────────────────────────────────────────────────

  describe('Client-ready → all-ready', () => {
    it('ne devrait PAS émettre all-ready si tous les clients ne sont pas prêts', () => {
      stateService.addClient('ROOM1', 's1', 1);
      stateService.addClient('ROOM1', 's2', 2);
      stateService.prepareForSeek('ROOM1', 60);

      const socket1 = createMockSocket('s1');
      gateway.handleClientReady(socket1 as any, { codeRoom: 'ROOM1' });

      // Seul s1 est prêt, s2 ne l'est pas → pas encore de all-ready
      const allReadyEmitted = mockServer.emit.mock.calls.some(
        (call: any[]) => call[0] === 'all-ready',
      );
      expect(allReadyEmitted).toBe(false);
    });

    it('devrait émettre all-ready quand TOUS les clients sont prêts', async () => {
      stateService.addClient('ROOM1', 's1', 1);
      stateService.addClient('ROOM1', 's2', 2);
      stateService.updateStatus('ROOM1', RoomGlobalStatus.PLAYING, 10);
      stateService.prepareForSeek('ROOM1', 60);

      const socket1 = createMockSocket('s1');
      const socket2 = createMockSocket('s2');

      gateway.handleClientReady(socket1 as any, { codeRoom: 'ROOM1' });
      gateway.handleClientReady(socket2 as any, { codeRoom: 'ROOM1' });
      await flushPromises();

      // Les deux sont prêts → all-ready doit être émis
      expect(mockServer.emit).toHaveBeenCalledWith('all-ready', expect.objectContaining({
        positionSec: expect.any(Number),
        shouldPlay: true, // On était en PLAYING avant le seek
      }));
    });

    it('devrait reprendre en PAUSED si on était en pause avant le seek', async () => {
      stateService.addClient('ROOM1', 's1', 1);
      stateService.updateStatus('ROOM1', RoomGlobalStatus.PAUSED, 10);
      stateService.prepareForSeek('ROOM1', 60);

      const socket1 = createMockSocket('s1');
      gateway.handleClientReady(socket1 as any, { codeRoom: 'ROOM1' });
      await flushPromises();

      // On était en PAUSED → shouldPlay doit être false
      expect(mockServer.emit).toHaveBeenCalledWith('all-ready', expect.objectContaining({
        shouldPlay: false,
      }));
    });
  });

  // ──────────────────────────────────────────────────────────────────
  //  6. TIMEOUT LOADING 8s — Reprise forcée
  // ──────────────────────────────────────────────────────────────────

  describe('Timeout LOADING (8 secondes)', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('devrait forcer la reprise après 8 secondes de LOADING', async () => {
      stateService.addClient('ROOM1', 's1', 1);
      stateService.addClient('ROOM1', 's2', 2);
      stateService.updateStatus('ROOM1', RoomGlobalStatus.PLAYING, 10);

      // Un seek déclenche le LOADING + le timer de 8s
      stateService.prepareForSeek('ROOM1', 60);

      // Avancer de 8 secondes
      jest.advanceTimersByTime(8000);

      // Laisser les promises async se résoudre
      await Promise.resolve();
      await Promise.resolve();

      // Le serveur doit avoir envoyé all-ready avec la raison "loading-timeout"
      expect(mockServer.emit).toHaveBeenCalledWith('all-ready', expect.objectContaining({
        shouldPlay: true,
        reason: 'loading-timeout',
      }));
    });
  });

  // ──────────────────────────────────────────────────────────────────
  //  7. DÉCONNEXION — Gestion quand un client quitte
  // ──────────────────────────────────────────────────────────────────

  describe('Déconnexion d\'un client', () => {
    it('devrait retirer le client de la room', () => {
      stateService.addClient('ROOM1', 'leaving', 1);
      stateService.addClient('ROOM1', 'staying', 2);

      const socket = createMockSocket('leaving');
      gateway.handleDisconnect(socket as any);

      expect(stateService.isClientInRoom('ROOM1', 'leaving')).toBe(false);
      expect(stateService.isClientInRoom('ROOM1', 'staying')).toBe(true);
    });

    it('devrait émettre force-pause si la room était en PLAYING', () => {
      stateService.addClient('ROOM1', 'leaving', 1);
      stateService.addClient('ROOM1', 'staying', 2);
      stateService.updateStatus('ROOM1', RoomGlobalStatus.PLAYING, 30);

      const socket = createMockSocket('leaving');
      gateway.handleDisconnect(socket as any);

      expect(mockServer.emit).toHaveBeenCalledWith('force-pause', expect.objectContaining({
        reason: 'client-disconnect',
      }));
    });

    it('devrait vérifier all-ready si la room était en LOADING', async () => {
      stateService.addClient('ROOM1', 'leaving', 1);
      stateService.addClient('ROOM1', 'staying', 2);
      stateService.updateStatus('ROOM1', RoomGlobalStatus.PLAYING, 10);
      stateService.prepareForSeek('ROOM1', 60);

      // "staying" est prêt, "leaving" ne l'est pas
      stateService.setClientReady('ROOM1', 'staying', true);

      // Quand "leaving" se déconnecte, il reste seulement "staying" (qui est prêt)
      const socket = createMockSocket('leaving');
      gateway.handleDisconnect(socket as any);
      await flushPromises();

      // → Tout le monde restant est prêt → all-ready doit être émis
      expect(mockServer.emit).toHaveBeenCalledWith('all-ready', expect.any(Object));
    });
  });

  // ──────────────────────────────────────────────────────────────────
  //  8. POSITION-REPORT — Réponse au sync-check
  // ──────────────────────────────────────────────────────────────────

  describe('Position-report (sync-check)', () => {
    it('devrait mettre à jour la position du client', () => {
      stateService.addClient('ROOM1', 'socket-1', 1);

      const socket = createMockSocket('socket-1');
      gateway.handlePositionReport(socket as any, {
        codeRoom: 'ROOM1',
        positionSec: 42.5,
      });

      // Vérifier que la position a été enregistrée
      const state = stateService.getOrCreateRoomState('ROOM1');
      const client = state.clients.get('socket-1');
      expect(client?.reportedPosition).toBe(42.5);
    });

    it('devrait rejeter une position invalide', () => {
      stateService.addClient('ROOM1', 'socket-1', 1);

      const socket = createMockSocket('socket-1');
      gateway.handlePositionReport(socket as any, {
        codeRoom: 'ROOM1',
        positionSec: -10, // invalide
      });

      // La position ne doit PAS avoir été mise à jour
      const state = stateService.getOrCreateRoomState('ROOM1');
      const client = state.clients.get('socket-1');
      expect(client?.reportedPosition).toBe(0); // valeur par défaut
    });

    it('devrait rejeter le report si le client n\'est pas membre', () => {
      const socket = createMockSocket('intrus');

      gateway.handlePositionReport(socket as any, {
        codeRoom: 'ROOM1',
        positionSec: 42,
      });

      // Le client intrus doit recevoir une erreur
      expect(socket.emit).toHaveBeenCalledWith('error', expect.any(Object));
    });
  });

  // ──────────────────────────────────────────────────────────────────
  //  9. CHARGE — Beaucoup d'utilisateurs dans un salon
  // ──────────────────────────────────────────────────────────────────
  //
  // Ces tests vérifient que le gateway ne crash pas et reste
  // fonctionnel quand il y a beaucoup de clients dans un même salon.
  // On simule 50 clients qui font des actions simultanées.
  //

  describe('Charge — 50 clients dans un salon', () => {
    const ROOM = 'BIG-ROOM';
    const NUM_CLIENTS = 50;
    let sockets: ReturnType<typeof createMockSocket>[];

    beforeEach(() => {
      // Créer et enregistrer 50 clients dans la room
      sockets = [];
      for (let i = 0; i < NUM_CLIENTS; i++) {
        const socket = createMockSocket(`client-${i}`);
        sockets.push(socket);
        stateService.addClient(ROOM, `client-${i}`, i + 1);
      }
    });

    it('devrait gérer un seek suivi de 50 client-ready sans crash', async () => {
      stateService.updateStatus(ROOM, RoomGlobalStatus.PLAYING, 10);

      // Un client fait un seek
      await gateway.handleSeek(sockets[0] as any, {
        codeRoom: ROOM,
        positionSec: 120,
      });

      // La room est en LOADING
      expect(stateService.getOrCreateRoomState(ROOM).status).toBe(RoomGlobalStatus.LOADING);

      mockServer.emit.mockClear();

      // Les 50 clients envoient client-ready un par un
      for (let i = 0; i < NUM_CLIENTS; i++) {
        gateway.handleClientReady(sockets[i] as any, { codeRoom: ROOM });
      }
      await flushPromises();

      // Tout le monde est prêt → all-ready doit être émis exactement 1 fois
      const allReadyCalls = mockServer.emit.mock.calls.filter(
        (call: any[]) => call[0] === 'all-ready',
      );
      expect(allReadyCalls.length).toBe(1);
      expect(allReadyCalls[0][1]).toEqual(expect.objectContaining({
        shouldPlay: true,
        positionSec: expect.any(Number),
      }));
    });

    it('devrait supporter 50 position-reports simultanés', () => {
      stateService.updateStatus(ROOM, RoomGlobalStatus.PLAYING, 50);

      // Les 50 clients envoient leur position
      for (let i = 0; i < NUM_CLIENTS; i++) {
        gateway.handlePositionReport(sockets[i] as any, {
          codeRoom: ROOM,
          positionSec: 50 + i * 0.1, // positions très proches
        });
      }

      // Vérifier que toutes les positions ont été enregistrées
      const drift = stateService.getPositionDrift(ROOM);
      expect(drift.positions.length).toBe(NUM_CLIENTS);
      // Drift max ≈ 4.9s → drifted = true (seuil 3s)
      expect(drift.drifted).toBe(true);
    });

    it('devrait gérer le buffering d\'un client parmi 50 sans crash', () => {
      stateService.updateStatus(ROOM, RoomGlobalStatus.PLAYING, 100);
      // Faire passer le cooldown
      const state = stateService.getOrCreateRoomState(ROOM);
      state.lastUpdateServerTime = Date.now() - 5000;
      state.lastAllReadyTime = Date.now() - 5000;

      // Un client commence à ramer
      gateway.handleClientBuffering(sockets[25] as any, {
        codeRoom: ROOM,
        positionSec: 100,
      });

      // La room doit passer en LOADING
      expect(stateService.getOrCreateRoomState(ROOM).status).toBe(RoomGlobalStatus.LOADING);

      // force-pause doit être envoyé avec le bon bufferingClientId
      expect(mockServer.emit).toHaveBeenCalledWith('force-pause', expect.objectContaining({
        bufferingClientId: 'client-25',
      }));
    });

    it('devrait gérer des déconnexions en série pendant un LOADING', async () => {
      stateService.updateStatus(ROOM, RoomGlobalStatus.PLAYING, 10);
      stateService.prepareForSeek(ROOM, 60);

      // 45 clients se déconnectent pendant le LOADING
      for (let i = 0; i < 45; i++) {
        gateway.handleDisconnect(sockets[i] as any);
      }
      await flushPromises();

      // 5 clients restants
      const state = stateService.getOrCreateRoomState(ROOM);
      expect(state.clients.size).toBe(5);

      // Les 5 clients restants disent qu'ils sont prêts
      mockServer.emit.mockClear();
      for (let i = 45; i < NUM_CLIENTS; i++) {
        gateway.handleClientReady(sockets[i] as any, { codeRoom: ROOM });
      }
      await flushPromises();

      // all-ready doit être émis pour les 5 restants
      expect(mockServer.emit).toHaveBeenCalledWith('all-ready', expect.any(Object));
    });

    it('devrait ignorer les play/pause de 50 clients si la room est en LOADING', async () => {
      stateService.prepareForSeek(ROOM, 30);

      // 50 clients essaient de faire play et pause en même temps
      for (let i = 0; i < NUM_CLIENTS; i++) {
        await gateway.handlePlay(sockets[i] as any, { codeRoom: ROOM, positionSec: 30 });
        await gateway.handlePause(sockets[i] as any, { codeRoom: ROOM, positionSec: 30 });
      }

      // Aucun appel à roomsService.play ou roomsService.pause ne doit avoir eu lieu
      expect(roomsService.play).not.toHaveBeenCalled();
      expect(roomsService.pause).not.toHaveBeenCalled();
    });

    it('devrait rejeter les actions des non-membres même avec 50 membres existants', async () => {
      const intrus = createMockSocket('hacker');

      await gateway.handlePlay(intrus as any, { codeRoom: ROOM, positionSec: 0 });
      await gateway.handlePause(intrus as any, { codeRoom: ROOM, positionSec: 0 });
      await gateway.handleSeek(intrus as any, { codeRoom: ROOM, positionSec: 100 });

      // L'intrus reçoit des erreurs
      expect(intrus.emit).toHaveBeenCalledWith('error', expect.any(Object));
      // play et pause du service NE sont PAS appelés
      expect(roomsService.play).not.toHaveBeenCalled();
    });
  });
});
