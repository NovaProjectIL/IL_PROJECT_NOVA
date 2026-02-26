import { Test, TestingModule } from '@nestjs/testing';
import { WsRoomMemberGuard } from './ws-room-member.guard';
import { RoomStateService } from '../room-state.service';
import { WsException } from '@nestjs/websockets';

describe('WsRoomMemberGuard', () => {
  let guard: WsRoomMemberGuard;
  let roomStateService: RoomStateService;

  const mockContext = (clientId: string, codeRoom: string) => ({
    switchToWs: () => ({
      getClient: () => ({ id: clientId }),
      getData: () => ({ codeRoom }),
    }),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WsRoomMemberGuard,
        {
          provide: RoomStateService,
          useValue: {
            isClientInRoom: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<WsRoomMemberGuard>(WsRoomMemberGuard);
    roomStateService = module.get<RoomStateService>(RoomStateService);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow access if client is in room', () => {
    jest.spyOn(roomStateService, 'isClientInRoom').mockReturnValue(true);
    
    const context = mockContext('client1', 'ROOM1') as any;
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw WsException if client is NOT in room', () => {
    jest.spyOn(roomStateService, 'isClientInRoom').mockReturnValue(false);
    
    const context = mockContext('intruder', 'ROOM1') as any;
    expect(() => guard.canActivate(context)).toThrow(WsException);
    expect(() => guard.canActivate(context)).toThrow('Vous ne faites pas partie de la room ROOM1');
  });

  it('should throw WsException if codeRoom is missing', () => {
    const context = {
      switchToWs: () => ({
        getClient: () => ({ id: 'client1' }),
        getData: () => ({}), // Pas de codeRoom
      }),
    } as any;

    expect(() => guard.canActivate(context)).toThrow(WsException);
    expect(() => guard.canActivate(context)).toThrow('Code de room manquant');
  });
});
