/**
 * ==============================================================
 *  TEST D'INTÉGRATION — Scénario complet de synchronisation
 * ==============================================================
 *
 * Ce fichier simule un scénario réaliste de bout en bout :
 *   1. Deux utilisateurs rejoignent une room
 *   2. Ils lancent la vidéo et font un seek
 *   3. Un client commence à ramer (buffering)
 *   4. Tout le monde attend, puis reprend ensemble
 *   5. La vérification de drift détecte un décalage
 *   6. Un client se déconnecte, les autres continuent
 *   7. Un intrus essaie d'agir sans être dans la room
 *
 * C'est le test "grand scénario" qui vérifie que tout
 * fonctionne ensemble, pas juste les pièces séparées.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { RoomsGateway } from './rooms.gateway';
import { RoomsService } from './rooms.service';
import { RoomStateService, RoomGlobalStatus } from './room-state.service';

describe('Scénario d\'intégration — Synchronisation vidéo complète', () => {
  let gateway: RoomsGateway;
  let stateService: RoomStateService;

  const mockServer = {
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  };

  const createMockSocket = (id: string) => ({
    id,
    join: jest.fn(),
    emit: jest.fn(),
    to: jest.fn().mockReturnThis(),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomsGateway,
        RoomStateService,
        {
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
    stateService = module.get<RoomStateService>(RoomStateService);
    gateway.server = mockServer as any;
    gateway.afterInit();
  });

  // Petite astuce : certaines méthodes du gateway sont "async".
  const flushPromises = () => new Promise(resolve => setImmediate(resolve));

  afterEach(() => {
    jest.clearAllMocks();
    if ((gateway as any).syncCheckTimer) {
      clearInterval((gateway as any).syncCheckTimer);
    }
  });

  it('Scénario complet : join → play → seek → buffering → ready → disconnect', async () => {
    const alice = createMockSocket('alice');
    const bob = createMockSocket('bob');
    const roomCode = 'SALLE-42';

    // ──────────── ÉTAPE 1 : Alice et Bob rejoignent la room ──────────
    await gateway.handleJoinRoom(alice as any, { codeRoom: roomCode, memberId: 1 });
    await gateway.handleJoinRoom(bob as any, { codeRoom: roomCode, memberId: 2 });

    expect(stateService.getConnectedMembers(roomCode.toUpperCase())).toHaveLength(2);

    // ──────────── ÉTAPE 2 : Alice lance la vidéo (play) ──────────────
    await gateway.handlePlay(alice as any, { codeRoom: roomCode, positionSec: 0 });

    const playState = stateService.getOrCreateRoomState(roomCode.toUpperCase());
    expect(playState.status).toBe(RoomGlobalStatus.PLAYING);

    // ──────────── ÉTAPE 3 : Alice fait un seek à 2 minutes ───────────
    mockServer.emit.mockClear();
    await gateway.handleSeek(alice as any, { codeRoom: roomCode, positionSec: 120 });

    // La room doit être en LOADING
    const seekState = stateService.getOrCreateRoomState(roomCode.toUpperCase());
    expect(seekState.status).toBe(RoomGlobalStatus.LOADING);
    expect(seekState.currentTimestamp).toBe(120);

    // force-seek doit avoir été envoyé à tout le monde
    expect(mockServer.emit).toHaveBeenCalledWith('force-seek', expect.objectContaining({
      timecode: 120,
    }));

    // ──────────── ÉTAPE 4 : Les deux disent "je suis prêt" ──────────
    mockServer.emit.mockClear();
    gateway.handleClientReady(alice as any, { codeRoom: roomCode });
    // Seulement Alice est prête → pas encore de reprise
    expect(mockServer.emit).not.toHaveBeenCalledWith('all-ready', expect.any(Object));

    gateway.handleClientReady(bob as any, { codeRoom: roomCode });
    await flushPromises();
    // Alice ET Bob sont prêts → all-ready !
    expect(mockServer.emit).toHaveBeenCalledWith('all-ready', expect.objectContaining({
      shouldPlay: true, // On relance la lecture
    }));

    // La room repasse en PLAYING
    const resumedState = stateService.getOrCreateRoomState(roomCode.toUpperCase());
    expect(resumedState.status).toBe(RoomGlobalStatus.PLAYING);

    // ──────────── ÉTAPE 5 : Bob rame (buffering) ─────────────────────
    // On doit attendre assez longtemps pour passer les cooldowns
    const state = stateService.getOrCreateRoomState(roomCode.toUpperCase());
    state.lastUpdateServerTime = Date.now() - 5000;
    state.lastAllReadyTime = Date.now() - 5000;

    mockServer.emit.mockClear();
    gateway.handleClientBuffering(bob as any, { codeRoom: roomCode, positionSec: 122 });

    // force-pause doit être envoyé avec l'identifiant du client qui rame
    expect(mockServer.emit).toHaveBeenCalledWith('force-pause', expect.objectContaining({
      bufferingClientId: 'bob',
    }));

    // La room doit être en LOADING
    expect(stateService.getOrCreateRoomState(roomCode.toUpperCase()).status)
      .toBe(RoomGlobalStatus.LOADING);

    // ──────────── ÉTAPE 6 : Tout le monde finit de charger ───────────
    mockServer.emit.mockClear();
    gateway.handleClientReady(alice as any, { codeRoom: roomCode });
    gateway.handleClientReady(bob as any, { codeRoom: roomCode });
    await flushPromises();

    expect(mockServer.emit).toHaveBeenCalledWith('all-ready', expect.any(Object));

    // ──────────── ÉTAPE 7 : Bob se déconnecte ────────────────────────
    // Remettre en PLAYING avec un peu de temps passé
    stateService.updateStatus(roomCode.toUpperCase(), RoomGlobalStatus.PLAYING, 130);
    mockServer.emit.mockClear();

    gateway.handleDisconnect(bob as any);

    // Bob n'est plus dans la room
    expect(stateService.isClientInRoom(roomCode.toUpperCase(), 'bob')).toBe(false);
    // Alice est toujours là
    expect(stateService.isClientInRoom(roomCode.toUpperCase(), 'alice')).toBe(true);
  });

  it('Sécurité : un intrus ne peut pas agir dans une room', async () => {
    const alice = createMockSocket('alice');
    const intrus = createMockSocket('intrus');

    // Seule Alice rejoint la room
    await gateway.handleJoinRoom(alice as any, { codeRoom: 'ROOM-X', memberId: 1 });

    // L'intrus essaie de faire play → doit être rejeté
    await gateway.handlePlay(intrus as any, { codeRoom: 'ROOM-X', positionSec: 0 });

    expect(intrus.emit).toHaveBeenCalledWith('error', expect.objectContaining({
      message: expect.stringContaining('non autorisée'),
    }));
  });

  it('Drift-check : devrait détecter un décalage entre les clients', () => {
    const roomCode = 'DRIFT-TEST';
    stateService.addClient(roomCode, 'c1', 1);
    stateService.addClient(roomCode, 'c2', 2);
    stateService.updateStatus(roomCode, RoomGlobalStatus.PLAYING, 50);

    // Les clients reportent des positions très différentes
    stateService.updateClientPosition(roomCode, 'c1', 50);
    stateService.updateClientPosition(roomCode, 'c2', 55); // 5s de décalage

    const drift = stateService.getPositionDrift(roomCode);

    expect(drift.drifted).toBe(true);
    expect(drift.maxDrift).toBe(5);
  });
});
