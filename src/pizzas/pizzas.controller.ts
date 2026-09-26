import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { PizzasService } from './pizzas.service';
import { CreatePizzaDto } from './dto/create-pizza.dto';
import { UpdatePizzaDto } from './dto/update-pizza.dto';
import {
  BulkPizzaAvailabilityDto,
  PizzaAvailabilityDto,
  PizzaIdsDto,
} from './dto/bulk-pizzas.dto';
@Controller('pizzas')
export class PizzasController {
  constructor(private readonly service: PizzasService) {}
  @Get() findAll() {
    return this.service.findAll();
  }
  @Post() create(@Body() dto: CreatePizzaDto) {
    return this.service.create(dto);
  }
  @Patch('bulk/availability') bulkAvailability(
    @Body() dto: BulkPizzaAvailabilityDto,
  ) {
    return this.service.availability(dto.ids, dto.available);
  }
  @Post('bulk/delete') bulkDelete(@Body() dto: PizzaIdsDto) {
    return this.service.remove(dto.ids);
  }
  @Get(':id') findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }
  @Patch(':id/availability') availability(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PizzaAvailabilityDto,
  ) {
    return this.service.availability([id], dto.available);
  }
  @Patch(':id') update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePizzaDto,
  ) {
    return this.service.update(id, dto);
  }
  @Delete(':id') remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove([id]);
  }
}
