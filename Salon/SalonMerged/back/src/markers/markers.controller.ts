// markers.controller.ts
import { Controller, Get, Post, Patch, Delete, Param, Body, ParseIntPipe, NotFoundException } from '@nestjs/common';
import { MarkersService } from './markers.service';
import { RoomsService } from '../rooms/rooms.service';
import { CreateMarkerDto } from './dto/create-marker.dto';
import { UpdateMarkerDto } from './dto/update-marker.dto';

@Controller('rooms')
export class MarkersController {
  constructor(
    private readonly markersService: MarkersService,
    private readonly roomsService: RoomsService,
  ) {}

  /**
   * GET /rooms/:roomId/markers or /rooms/:roomCode/markers
   * Accepte les deux : roomId numérique ou roomCode string
   */
  @Get(':identifier/markers')
  async findAll(@Param('identifier') identifier: string) {
    let roomId: number;

    // Vérifier si c'est un numéro ou un code
    const parsedId = parseInt(identifier);
    
    if (!isNaN(parsedId)) {
      // C'est un ID numérique
      roomId = parsedId;
    } else {
      // C'est un code string, chercher la room
      const room = await this.roomsService.getByCode(identifier);
      if (!room) {
        throw new NotFoundException(`Room ${identifier} non trouvée`);
      }
      roomId = room.id;
    }

    return this.markersService.findByRoom(roomId);
  }

  // POST /rooms/:roomId/markers or /rooms/:roomCode/markers
  @Post(':identifier/markers')
  async create(
    @Param('identifier') identifier: string,
    @Body() dto: CreateMarkerDto,
  ) {
    let roomId: number;

    const parsedId = parseInt(identifier);
    if (!isNaN(parsedId)) {
      roomId = parsedId;
    } else {
      const room = await this.roomsService.getByCode(identifier);
      if (!room) {
        throw new NotFoundException(`Room ${identifier} non trouvée`);
      }
      roomId = room.id;
    }

    return this.markersService.create(roomId, dto);
  }

  // PATCH /rooms/:roomId/markers/:markerId
  @Patch(':identifier/markers/:markerId')
  update(
    @Param('markerId', ParseIntPipe) markerId: number,
    @Body() dto: UpdateMarkerDto,
  ) {
    return this.markersService.update(markerId, dto);
  }

  // DELETE /rooms/:roomId/markers/:markerId
  @Delete(':identifier/markers/:markerId')
  remove(@Param('markerId', ParseIntPipe) markerId: number) {
    return this.markersService.remove(markerId);
  }
}
