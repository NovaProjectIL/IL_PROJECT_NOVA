// markers.controller.ts
import { Controller, Get, Post, Patch, Delete, Param, Body, ParseIntPipe, UseGuards, Res, Query, DefaultValuePipe } from '@nestjs/common';
import type { Response } from 'express';
import { MarkersService } from './markers.service';
import { CreateMarkerDto } from './dto/create-marker.dto';
import { UpdateMarkerDto } from './dto/update-marker.dto';
import { AnalystGuard } from './guards/analyst.guard';

@Controller('rooms/:roomId/markers')
export class MarkersController {
  constructor(private readonly markersService: MarkersService) {}

  // GET
 @Get()
  findAll(
    @Param('roomId', ParseIntPipe) roomId: number,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('category') category?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.markersService.findByRoom(roomId, page, limit, category, 
      from ? parseFloat(from) : undefined,
      to ? parseFloat(to) : undefined,
    );
  }

  @Get('export')
  async exportCsv(
    @Param('roomId', ParseIntPipe) roomId: number,
    @Res() res: Response,
  ) {
    const csv = await this.markersService.exportCsv(roomId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=\"markers-room-${roomId}.csv\"`);
    return res.send(csv);
  }

  // POST 
  @UseGuards(AnalystGuard)
  @Post()
  create(
    @Param('roomId', ParseIntPipe) roomId: number,
    @Body() dto: CreateMarkerDto,
  ) {
    return this.markersService.create(roomId, dto);
  }

  // PATCH 
  @UseGuards(AnalystGuard)
  @Patch(':markerId')
  update(
    @Param('markerId', ParseIntPipe) markerId: number,
    @Body() dto: UpdateMarkerDto,
  ) {
    return this.markersService.update(markerId, dto);
  }

  // DELETE 
  @UseGuards(AnalystGuard)
  @Delete(':markerId')
  remove(@Param('markerId', ParseIntPipe) markerId: number) {
    return this.markersService.remove(markerId);
  }
}
