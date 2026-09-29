import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Neighborhood } from './entities/neighborhood.entity';
import { NeighborhoodsService } from './neighborhoods.service';
import { NeighborhoodsController } from './neighborhoods.controller';
@Module({
  imports: [TypeOrmModule.forFeature([Neighborhood])],
  controllers: [NeighborhoodsController],
  providers: [NeighborhoodsService],
})
export class NeighborhoodsModule {}
