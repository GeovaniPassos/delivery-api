import { Body, Controller, Get, Injectable, Module, Post, Query, ConflictException } from '@nestjs/common';
import { TypeOrmModule, InjectRepository } from '@nestjs/typeorm';
import { IsString, Length, Matches } from 'class-validator';
import { Repository, ILike } from 'typeorm';
import { Customer } from './customer.entity';

class CreateCustomerDto {
  @IsString() @Length(2, 120) name!: string;
  @IsString() @Matches(/^(?:55)?\d{10,11}$/) phone!: string;
}

@Injectable()
export class CustomersService {
  constructor(@InjectRepository(Customer) private readonly repo: Repository<Customer>) {}
  list(search?: string) {
    const term = search?.trim();
    const digits = term?.replace(/\D/g, '');
    return this.repo.find({
      where: term ? [ { name: ILike(`%${term}%`) }, ...(digits ? [{ phone: ILike(`%${digits}%`) }] : []) ] : {},
      order: { name: 'ASC' }, take: 100,
    });
  }
  async create(dto: CreateCustomerDto) {
    const phone = dto.phone.replace(/\D/g, '');
    if (await this.repo.findOneBy({ phone })) throw new ConflictException('Já existe um cliente com este telefone.');
    return this.repo.save(this.repo.create({ name: dto.name.trim(), phone, address: null }));
  }
}

@Controller('customers')
class CustomersController {
  constructor(private readonly service: CustomersService) {}
  @Get() list(@Query('search') search?: string) { return this.service.list(search); }
  @Post() create(@Body() dto: CreateCustomerDto) { return this.service.create(dto); }
}

@Module({ imports: [TypeOrmModule.forFeature([Customer])], controllers: [CustomersController], providers: [CustomersService], exports: [CustomersService] })
export class CustomersModule {}
