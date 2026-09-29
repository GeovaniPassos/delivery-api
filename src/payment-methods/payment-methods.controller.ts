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
import { PaymentMethodsService } from './payment-methods.service';
import { SavePaymentMethodDto } from './dto/save-payment-method.dto';
@Controller('payment-methods')
export class PaymentMethodsController {
  constructor(private readonly service: PaymentMethodsService) {}
  @Get() findAll() {
    return this.service.findAll();
  }
  @Post() create(@Body() dto: SavePaymentMethodDto) {
    return this.service.save(dto);
  }
  @Put(':id') update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SavePaymentMethodDto,
  ) {
    return this.service.save(dto, id);
  }
  @Delete(':id') remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
