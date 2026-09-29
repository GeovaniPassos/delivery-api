import {
  Body,
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Query,
  Headers,
  ParseIntPipe,
  Header,
} from '@nestjs/common';
import { ListOrdersDto, AdvanceOrderDto } from './dto/manage-order.dto';
import { OrdersService } from './orders.service';
import { CreateOrderDto, QuoteOrderDto } from './dto/create-order.dto';
@Controller('orders')
export class OrdersController {
  constructor(private readonly service: OrdersService) {}
  @Get('tracking') @Header('Cache-Control', 'no-store') track(
    @Headers('x-order-token') token?: string,
  ) {
    return this.service.track(token);
  }
  @Get('admin') @Header('Cache-Control', 'no-store') list(
    @Query() dto: ListOrdersDto,
  ) {
    return this.service.list(dto);
  }
  @Get('admin/notifications')
  @Header('Cache-Control', 'no-store')
  notifications() {
    return this.service.notifications();
  }
  @Get('admin/:id') @Header('Cache-Control', 'no-store') detail(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.findOne(id);
  }
  @Patch('admin/:id/advance') advance(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdvanceOrderDto,
  ) {
    return this.service.advance(id, dto);
  }
  @Post('quote') quote(@Body() dto: QuoteOrderDto) {
    return this.service.quote(dto);
  }
  @Post() create(@Body() dto: CreateOrderDto) {
    return this.service.create(dto);
  }
}
