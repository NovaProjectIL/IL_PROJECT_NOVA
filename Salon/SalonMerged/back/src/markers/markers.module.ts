// markers.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Marker } from '../entities/marker.entity';
import { User } from '../entities/user.entity';
import { MarkersService } from './markers.service';
import { MarkersController } from './markers.controller';
import { AnalystGuard } from './guards/analyst.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Marker, User]),
  ],
  controllers: [MarkersController],
  providers: [MarkersService, AnalystGuard],
  exports: [MarkersService], 
})
export class MarkersModule {}
