import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { NeighborhoodsService } from './neighborhoods.service';
import { SaveNeighborhoodDto } from './dto/save-neighborhood.dto';
@Controller('neighborhoods')
export class NeighborhoodsController {
  constructor(private readonly service: NeighborhoodsService) {}
  @Get() findAll() {
    return this.service.findAll();
  }
  @Post() create(@Body() dto: SaveNeighborhoodDto) {
    return this.service.save(dto);
  }
  @Put(':id') update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SaveNeighborhoodDto,
  ) {
    return this.service.save(dto, id);
  }
  @Delete(':id') remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
