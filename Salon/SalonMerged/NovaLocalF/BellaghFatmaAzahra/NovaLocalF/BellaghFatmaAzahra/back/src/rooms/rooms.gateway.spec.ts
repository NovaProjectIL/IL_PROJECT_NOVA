import { Test, TestingModule } from '@nestjs/testing';
import { RoomsGateway } from './rooms.gateway';
import { RoomsService } from './rooms.service';
import { RoomStateService, RoomGlobalStatus } from './room-state.service';
import { PlayStatus } from '../entities/playback-state.entity';

describe('RoomsGateway', () => {
  let gateway: RoomsGateway;
  let roomsService: RoomsService;
  let roomStateService: RoomStateService;

  const mockServer = {
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  };

  const mockSocket = {
    id: 'socket-id',
    join: jest.fn(),
    emit: jest.fn(),
    to: jest.fn().mockReturnThis(),
  };

  const flushPromises = () => new Promise(jest.requireActual('timers').setImmediate);

  beforeEach(async () => {
    jest.useFakeTimers();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomsGateway,
        {
          provide: RoomsService,
          useValue: {
            stateRoom: jest.fn(),
            play: jest.fn(),
            pause: jest.fn(),
            seek: jest.fn(),
            getRoomByCode: jest.fn(),
            getPlaybackState: jest.fn(),
          },
        },
        {
          provide: RoomStateService,
          useValue: {
            addClient: jest.fn(),
            removeClient: jest.fn(),
            updateStatus: jest.fn(),
            updateTimestamp: jest.fn(),
            setClientReady: jest.fn(),
            areAllClientsReady: jest.fn(),
            getAdjustedTimestamp: jest.fn(),
            getOrCreateRoomState: jest.fn(),
            prepareForSeek: jest.fn(),
          },
        },
      ],
    }).compile();

    gateway = module.get<RoomsGateway>(RoomsGateway);
    roomsService = module.get<RoomsService>(RoomsService);
    roomStateService = module.get<RoomStateService>(RoomStateService);
    gateway.server = mockServer as any;
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('Loading Timeout Mechanism', () => {
    const roomCode = 'ROOM1';

    it('should force resume playback after 8 seconds of loading', async () => {
      jest.spyOn(roomStateService, 'getOrCreateRoomState').mockReturnValue({
        roomCode,
        status: RoomGlobalStatus.LOADING,
        currentTimestamp: 50,
      } as any);
      jest.spyOn(roomStateService, 'getAdjustedTimestamp').mockReturnValue(50);

      await gateway.handleLoadingVideo(mockSocket as any, { codeRoom: roomCode });

      // Avancer le temps
      jest.advanceTimersByTime(8000);
      await flushPromises();

      // Vérifier que la lecture est forcée
      expect(roomsService.play).toHaveBeenCalledWith(roomCode, 50);
      expect(mockServer.emit).toHaveBeenCalledWith('playback-updated', expect.objectContaining({
        action: 'play',
        loading: false,
        message: expect.stringContaining('Délai d\'attente dépassé')
      }));
    });

    it('should clear timeout if everyone becomes ready before 8 seconds', async () => {
      jest.spyOn(roomStateService, 'areAllClientsReady').mockReturnValue(true);
      jest.spyOn(roomStateService, 'getAdjustedTimestamp').mockReturnValue(50);
      
      await gateway.handleLoadingVideo(mockSocket as any, { codeRoom: roomCode });
      
      // Simuler que tout le monde est prêt
      await gateway.handleClientReady(mockSocket as any, { codeRoom: roomCode });
      await flushPromises();

      // Avancer le temps pour voir si le timeout se déclenche quand même
      jest.advanceTimersByTime(8000);
      await flushPromises();

      // Play doit avoir été appelé exactement 1 fois (par handleClientReady)
      expect(roomsService.play).toHaveBeenCalledTimes(1);
      // Le message de timeout ne doit PAS être présent dans les appels d'émission
      const timeoutCall = mockServer.emit.mock.calls.find(call => 
        call[1] && call[1].message && call[1].message.includes('Délai d\'attente dépassé')
      );
      expect(timeoutCall).toBeUndefined();
    });
  });
});
