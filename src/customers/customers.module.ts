import {
  Body,
  ConflictException,
  Controller,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { TypeOrmModule, InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { Customer } from './customer.entity';

class CustomerAddressDto {
  @IsOptional() @IsString() @MaxLength(200) street?: string;
  @IsOptional() @IsString() @MaxLength(40) number?: string;
  @IsOptional() @IsString() @MaxLength(20) postalCode?: string;
  @IsOptional() @IsInt() neighborhoodId?: number;
  @IsOptional() @IsString() @MaxLength(120) neighborhoodName?: string;
  @IsOptional() @IsString() @MaxLength(200) complement?: string;
  @IsOptional() @IsNumber() deliveryFee?: number;
}

class CreateCustomerDto {
  @IsString() @Length(2, 120) name!: string;
  @IsOptional() @IsString() @MaxLength(120) phone?: string | null;
  @IsOptional() @ValidateNested() @Type(() => CustomerAddressDto)
  address?: CustomerAddressDto | null;
}

class UpdateCustomerDto {
  @IsOptional() @IsString() @Length(2, 120) name?: string;
  @IsOptional() @IsString() @MaxLength(120) phone?: string | null;
  @IsOptional() @ValidateNested() @Type(() => CustomerAddressDto)
  address?: CustomerAddressDto | null;
}

@Injectable()
export class CustomersService {
  constructor(@InjectRepository(Customer) private readonly repo: Repository<Customer>) {}

  async list(search?: string) {
    const term = search?.trim();
    const digits = term?.replace(/\D/g, '');
    const customers = await this.repo.find({
      where: term
        ? [{ name: ILike(`%${term}%`) }, ...(digits ? [{ phone: ILike(`%${digits}%`) }] : [])]
        : {},
      order: { name: 'ASC' },
      take: 100,
    });
    return customers.map((customer) => this.present(customer));
  }

  async create(dto: CreateCustomerDto) {
    const phone = dto.phone?.trim() || null;
    if (phone && await this.repo.findOneBy({ phone })) {
      throw new ConflictException('Já existe um cliente com este telefone.');
    }
    const customer = this.repo.create({
      name: dto.name.trim(),
      phone,
      address: dto.address ?? null,
    });
    return this.present(await this.repo.save(customer));
  }

  async update(id: number, dto: UpdateCustomerDto) {
    const customer = await this.repo.findOneBy({ id });
    if (!customer) throw new NotFoundException('Cliente não encontrado.');

    if (dto.name !== undefined) customer.name = dto.name.trim();
    if (dto.phone !== undefined) {
      const phone = dto.phone?.trim() || null;
      if (phone) {
        const duplicate = await this.repo.findOneBy({ phone });
        if (duplicate && duplicate.id !== customer.id) {
          throw new ConflictException('Já existe um cliente com este telefone.');
        }
      }
      customer.phone = phone;
    }
    if (dto.address !== undefined) customer.address = dto.address;
    return this.present(await this.repo.save(customer));
  }

  private present(customer: Customer) {
    return { ...customer, phone: customer.phone ?? '' };
  }
}

@Controller('customers')
class CustomersController {
  constructor(private readonly service: CustomersService) {}

  @Get() list(@Query('search') search?: string) { return this.service.list(search); }
  @Post() create(@Body() dto: CreateCustomerDto) { return this.service.create(dto); }
  @Put(':id') update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.service.update(Number(id), dto);
  }
  @Patch(':id') patch(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.service.update(Number(id), dto);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([Customer])],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
