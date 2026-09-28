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
import { OptionalsService } from './optionals.service';
import { CreateOptionalGroupDto } from './dto/create-optional-group.dto';
@Controller('optionals')
export class OptionalsController {
  constructor(private readonly service: OptionalsService) {}
  @Get() findAll() {
    return this.service.findAll();
  }
  @Post() create(@Body() dto: CreateOptionalGroupDto) {
    return this.service.create(dto);
  }
  @Put(':id') update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateOptionalGroupDto,
  ) {
    return this.service.update(id, dto);
  }
  @Delete(':id') remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
