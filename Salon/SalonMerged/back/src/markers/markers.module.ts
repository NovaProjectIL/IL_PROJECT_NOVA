// markers.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Marker } from '../entities/marker.entity';
import { MarkersService } from './markers.service';
import { MarkersController } from './markers.controller';
import { RoomsModule } from '../rooms/rooms.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Marker]),
    RoomsModule,  // ← Importer RoomsModule pour accéder à RoomsService
  ],
  controllers: [MarkersController],
  providers: [MarkersService],
  exports: [MarkersService], 
})
export class MarkersModule {}