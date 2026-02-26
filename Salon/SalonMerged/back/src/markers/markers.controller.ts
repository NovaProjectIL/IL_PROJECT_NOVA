// markers.controller.ts
import { Controller, Get, Post, Patch, Delete, Param, Body, ParseIntPipe } from '@nestjs/common';
import { MarkersService } from './markers.service';
import { CreateMarkerDto } from './dto/create-marker.dto';
import { UpdateMarkerDto } from './dto/update-marker.dto';

@Controller('rooms/:roomId/markers')
export class MarkersController {
  constructor(private readonly markersService: MarkersService) {}

  // GET
  @Get()
  findAll(@Param('roomId', ParseIntPipe) roomId: number) {
    return this.markersService.findByRoom(roomId);
  }

  // POST 
  @Post()
  create(
    @Param('roomId', ParseIntPipe) roomId: number,
    @Body() dto: CreateMarkerDto,
  ) {
    return this.markersService.create(roomId, dto);
  }

  // PATCH 
  @Patch(':markerId')
  update(
    @Param('markerId', ParseIntPipe) markerId: number,
    @Body() dto: UpdateMarkerDto,
  ) {
    return this.markersService.update(markerId, dto);
  }

  // DELETE 
  @Delete(':markerId')
  remove(@Param('markerId', ParseIntPipe) markerId: number) {
    return this.markersService.remove(markerId);
  }
}