import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { CombosService } from './combos.service';
import { CreateComboDto } from './dto/create-combo.dto';
import { UpdateComboDto } from './dto/update-combo.dto';

@Controller('combos')
export class CombosController {
  constructor(private readonly combos: CombosService) {}
  @Get() findAll() { return this.combos.findAll(); }
  @Post() create(@Body() dto: CreateComboDto) { return this.combos.create(dto); }
  @Patch(':id') update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateComboDto) { return this.combos.update(id, dto); }
  @Delete(':id') remove(@Param('id', ParseIntPipe) id: number) { return this.combos.remove(id); }
}
