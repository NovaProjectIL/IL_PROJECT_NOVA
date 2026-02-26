// markers.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Marker } from '../entities/marker.entity';
import { MarkersService } from './markers.service';
import { MarkersController } from './markers.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Marker]),
  ],
  controllers: [MarkersController],
  providers: [MarkersService],
  exports: [MarkersService], 
})
export class MarkersModule {}