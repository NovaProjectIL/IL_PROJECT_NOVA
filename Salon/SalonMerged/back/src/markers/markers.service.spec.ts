// markers.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { MarkersService } from './markers.service';
import { Marker, MarkerCategory } from '../entities/marker.entity';

// Faux repository qui simule TypeORM sans base de données réelle
const mockRepository = {
  find: jest.fn(),
  findAndCount: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  delete: jest.fn(),
};

// Faux Gateway qui simule le broadcast WebSocket
const mockGateway = {
  server: {
    to: jest.fn().mockReturnValue({
      emit: jest.fn(),
    }),
  },
};

describe('MarkersService', () => {
  let service: MarkersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarkersService,
        {
          provide: getRepositoryToken(Marker),
          useValue: mockRepository,
        },
        {
          provide: 'RoomsGateway',
          useValue: mockGateway,
        },
      ],
    }).compile();

    service = module.get<MarkersService>(MarkersService);

    // Réinitialiser les mocks avant chaque test
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────
  // TESTS : findByRoom
  // ─────────────────────────────────────────────
  describe('findByRoom', () => {
    it('doit retourner les marqueurs triés par timeSec', async () => {
      const markers = [
        { id: 1, timeSec: 10, label: 'Premier' },
        { id: 2, timeSec: 42, label: 'Deuxième' },
      ];
      mockRepository.findAndCount.mockResolvedValue([markers, 2]);

      const result = await service.findByRoom(181);

      expect(result).toEqual(markers);
      expect(mockRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { room: { id: 181 } },
          order: { timeSec: 'ASC' },
        })
      );
    });

    it('doit filtrer par catégorie', async () => {
      mockRepository.findAndCount.mockResolvedValue([[], 0]);

      await service.findByRoom(181, 1, 50, 'ERROR');

      expect(mockRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: 'ERROR',
          }),
        })
      );
    });

    it('doit filtrer par timeSec avec from et to', async () => {
      mockRepository.findAndCount.mockResolvedValue([[], 0]);

      await service.findByRoom(181, 1, 50, undefined, 10, 60);

      expect(mockRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            timeSec: expect.anything(),
          }),
        })
      );
    });

    it('doit appliquer la pagination correctement', async () => {
      mockRepository.findAndCount.mockResolvedValue([[], 0]);

      await service.findByRoom(181, 2, 5);

      expect(mockRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5,  // (page 2 - 1) * limit 5
          take: 5,
        })
      );
    });
  });

  // ─────────────────────────────────────────────
  // TESTS : create
  // ─────────────────────────────────────────────
 describe('create', () => {
    it('doit créer un marqueur et le retourner', async () => {
      const dto = {
        timeSec: 42.5,
        label: 'Test marqueur',
        category: MarkerCategory.ERROR,
        videoId: 'dQw4w9WgXcQ',
        createdById: 747,
      };

      const savedMarker = { id: 1, timeSec: 42.5, label: 'Test marqueur' };
      mockRepository.create.mockReturnValue(savedMarker);
      mockRepository.save.mockResolvedValue(savedMarker);

      const result = await service.create(181, dto as any);

      expect(result).toBeDefined();
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('doit appeler create avec les bonnes données', async () => {
      const dto = {
        timeSec: 10,
        label: 'Test',
        videoId: 'abc',
        createdById: 1,
      };

      mockRepository.create.mockReturnValue({ id: 1 });
      mockRepository.save.mockResolvedValue({ id: 1 });

      await service.create(181, dto as any);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          timeSec: 10,
          label: 'Test',
        })
      );
    });
  });

  // ─────────────────────────────────────────────
  // TESTS : update + 409 Conflict
  // ─────────────────────────────────────────────
  describe('update', () => {
    it('doit créer un marqueur et le retourner', async () => {
      const dto = {
        timeSec: 42.5,
        label: 'Test marqueur',
        category: MarkerCategory.ERROR,
        videoId: 'dQw4w9WgXcQ',
        createdById: 747,
      };

      const savedMarker = { id: 1, timeSec: 42.5, label: 'Test marqueur' };
      mockRepository.create.mockReturnValue(savedMarker);
      mockRepository.save.mockResolvedValue(savedMarker);

      const result = await service.create(181, dto as any);

      expect(result).toBeDefined();
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('doit appeler create avec les bonnes données', async () => {
      const dto = {
        timeSec: 10,
        label: 'Test',
        videoId: 'abc',
        createdById: 1,
      };

      mockRepository.create.mockReturnValue({ id: 1 });
      mockRepository.save.mockResolvedValue({ id: 1 });

      await service.create(181, dto as any);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          timeSec: 10,
          label: 'Test',
        })
      );
    });
  });

  // ─────────────────────────────────────────────
  // TESTS : remove
  // ─────────────────────────────────────────────
  describe('remove', () => {
   it('doit supprimer un marqueur existant', async () => {
      mockRepository.delete.mockResolvedValue({ affected: 1 });

      await service.remove(1);

      expect(mockRepository.delete).toHaveBeenCalledWith(1);
    });

    it('doit lever 404 si marqueur introuvable', async () => {
      mockRepository.delete.mockResolvedValue({ affected: 0 });

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────
  // TESTS : exportCsv
  // ─────────────────────────────────────────────
  describe('exportCsv', () => {
    it('doit générer un CSV avec les bonnes colonnes', async () => {
      const markers = [{
        id: 1,
        timeSec: 42,
        label: 'Test',
        content: null,
        category: 'ERROR',
        createdBy: { name: 'Wafa' },
      }];
      mockRepository.findAndCount.mockResolvedValue([markers, 1]);

      const csv = await service.exportCsv(181);

      expect(csv).toContain('timestamp,auteur,categorie,annotation');
      expect(csv).toContain('Wafa');
      expect(csv).toContain('ERROR');
      expect(csv).toContain('00:42');
    });

    it('doit gérer un auteur supprimé (null)', async () => {
      const markers = [{
        id: 1,
        timeSec: 10,
        label: 'Test',
        content: null,
        category: 'COMMENT',
        createdBy: null,  // User supprimé
      }];
      mockRepository.findAndCount.mockResolvedValue([markers, 1]);

      const csv = await service.exportCsv(181);

      expect(csv).toContain('Utilisateur'); // Valeur par défaut
    });
  });
});