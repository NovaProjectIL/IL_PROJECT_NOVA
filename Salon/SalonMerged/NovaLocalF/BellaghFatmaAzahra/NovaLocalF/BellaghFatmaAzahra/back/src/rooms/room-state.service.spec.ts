import { Test, TestingModule } from '@nestjs/testing';
import { RoomStateService, RoomGlobalStatus } from './room-state.service';

describe('RoomStateService', () => {
  let service: RoomStateService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RoomStateService],
    }).compile();

    service = module.get<RoomStateService>(RoomStateService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Room State Management', () => {
    const roomCode = 'TEST-ROOM';

    it('should create a new room state if it does not exist', () => {
      const state = service.getOrCreateRoomState(roomCode);
      expect(state).toBeDefined();
      expect(state.roomCode).toBe(roomCode);
      expect(state.status).toBe(RoomGlobalStatus.PAUSED);
    });

    it('should update status and timestamp', () => {
      service.updateStatus(roomCode, RoomGlobalStatus.PLAYING, 10);
      const state = service.getOrCreateRoomState(roomCode);
      expect(state.status).toBe(RoomGlobalStatus.PLAYING);
      expect(state.currentTimestamp).toBe(10);
    });

    it('should calculate adjusted timestamp when playing', async () => {
      service.updateStatus(roomCode, RoomGlobalStatus.PLAYING, 10);
      
      // Wait for a small amount of time to simulate playback
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const adjusted = service.getAdjustedTimestamp(roomCode);
      expect(adjusted).toBeGreaterThan(10);
      expect(adjusted).toBeLessThan(11);
    });
  });

  describe('Client Management', () => {
    const roomCode = 'TEST-ROOM';
    const clientId = 'client-1';
    const memberId = 123;

    it('should add and remove clients', () => {
      service.addClient(roomCode, clientId, memberId);
      let connected = service.getConnectedMembers(roomCode);
      expect(connected).toContain(memberId);

      service.removeClient(clientId);
      connected = service.getConnectedMembers(roomCode);
      expect(connected).not.toContain(memberId);
    });

    it('should manage ready states', () => {
      service.addClient(roomCode, 'c1', 1);
      service.addClient(roomCode, 'c2', 2);

      expect(service.areAllClientsReady(roomCode)).toBe(false);

      service.setClientReady(roomCode, 'c1', true);
      expect(service.areAllClientsReady(roomCode)).toBe(false);

      service.setClientReady(roomCode, 'c2', true);
      expect(service.areAllClientsReady(roomCode)).toBe(true);
    });
  });

  describe('Reset and Full State', () => {
    const roomCode = 'TEST-ROOM';

    it('should reset room state', () => {
      service.addClient(roomCode, 'c1', 1);
      service.setClientReady(roomCode, 'c1', true);
      service.updateStatus(roomCode, RoomGlobalStatus.PLAYING, 50);

      service.resetRoomState(roomCode);

      const state = service.getOrCreateRoomState(roomCode);
      expect(state.status).toBe(RoomGlobalStatus.PAUSED);
      expect(state.currentTimestamp).toBe(0);
      expect(state.clients.get('c1')?.isReady).toBe(false);
    });

    it('should return full state summary', () => {
      service.addClient(roomCode, 'c1', 1);
      service.updateStatus(roomCode, RoomGlobalStatus.PAUSED, 20);
      
      const summary = service.getFullState(roomCode);
      expect(summary.roomCode).toBe(roomCode);
      expect(summary.currentTimestamp).toBe(20);
      expect(summary.connectedCount).toBe(1);
    });
  });
});
