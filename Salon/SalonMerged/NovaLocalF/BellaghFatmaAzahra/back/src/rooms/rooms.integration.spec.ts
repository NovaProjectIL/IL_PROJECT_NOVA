import { Test, TestingModule } from '@nestjs/testing';
import { RoomsGateway } from './rooms.gateway';
import { RoomsService } from './rooms.service';
import { RoomStateService, RoomGlobalStatus } from './room-state.service';
import { WsRoomMemberGuard } from './guards/ws-room-member.guard';
import { PlayStatus } from '../entities/playback-state.entity';
import { WsException } from '@nestjs/websockets';
import { validate } from 'class-validator';
import { SeekDto } from './dto/ws-events.dto';

describe('Rooms Global Integration System', () => {
  let gateway: RoomsGateway;
  let roomStateService: RoomStateService;
  let roomsService: RoomsService;

  // Mocks de serveurs et sockets
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
    jest.useFakeTimers();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomsGateway,
        RoomStateService,
        {
          provide: RoomsService,
          useValue: {
            stateRoom: jest.fn().mockResolvedValue({ playbackState: { positionSec: 0 }, users: [] }),
            play: jest.fn().mockResolvedValue({}),
            pause: jest.fn().mockResolvedValue({}),
            seek: jest.fn().mockResolvedValue({}),
          },
        },
      ],
    }).compile();

    gateway = module.get<RoomsGateway>(RoomsGateway);
    roomStateService = module.get<RoomStateService>(RoomStateService);
    roomsService = module.get<RoomsService>(RoomsService);
    gateway.server = mockServer as any;
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  const flushPromises = () => new Promise(jest.requireActual('timers').setImmediate);

  it('SHOULD WORK WELL: 1. Full Sync Cycle, 2. Security Guard, 3. Strict Validation, 4. Safety Timeout', async () => {
    const roomCode = 'PROD-ROOM';
    const clientA = createMockSocket('user-a');
    const clientB = createMockSocket('user-b');
    const intruder = createMockSocket('intruder-x');

    // --- 1. JOIN PHASE ---
    await gateway.handleJoinRoom(clientA as any, { codeRoom: roomCode, memberId: 1 });
    await gateway.handleJoinRoom(clientB as any, { codeRoom: roomCode, memberId: 2 });
    
    expect(roomStateService.getConnectedMembers(roomCode)).toHaveLength(2);

    // --- 2. SECURITY GUARD TEST ---
    const guard = new WsRoomMemberGuard(roomStateService);
    const intruderContext = {
      switchToWs: () => ({ getClient: () => intruder, getData: () => ({ codeRoom: roomCode }) }),
    } as any;
    expect(() => guard.canActivate(intruderContext)).toThrow(WsException);

    // --- 3. STRICT VALIDATION TEST ---
    const invalidSeek = new SeekDto();
    invalidSeek.codeRoom = roomCode;
    invalidSeek.positionSec = -10;
    
    const errors = await validate(invalidSeek);
    expect(errors.length).toBeGreaterThan(0); // Prouve que le DTO bloque les valeurs négatives

    // --- 4. SYNCHRONIZED LOADING CYCLE ---
    const validSeek = { codeRoom: roomCode, positionSec: 120 };
    await gateway.handleSeek(clientA as any, validSeek);
    
    expect(roomStateService.getOrCreateRoomState(roomCode).status).toBe(RoomGlobalStatus.LOADING);

    await gateway.handleClientReady(clientA as any, { codeRoom: roomCode });
    expect(roomStateService.areAllClientsReady(roomCode)).toBe(false);

    await gateway.handleClientReady(clientB as any, { codeRoom: roomCode });
    expect(roomStateService.areAllClientsReady(roomCode)).toBe(true);
    
    expect(roomsService.play).toHaveBeenCalledWith(roomCode, 120);

    // --- 5. SAFETY TIMEOUT TEST ---
    await gateway.handleLoadingVideo(clientA as any, { codeRoom: roomCode });
    
    jest.advanceTimersByTime(8000);
    await flushPromises();

    expect(mockServer.emit).toHaveBeenCalledWith('playback-updated', expect.objectContaining({
      message: expect.stringContaining("Délai d'attente dépassé")
    }));
    expect(roomStateService.getOrCreateRoomState(roomCode).status).toBe(RoomGlobalStatus.PLAYING);
  });
});
