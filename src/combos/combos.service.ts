import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Category } from '../categories/entities/category.entity';
import { Product } from '../products/entities/product.entity';
import { Combo } from './entities/combo.entity';
import { CreateComboDto } from './dto/create-combo.dto';
import { UpdateComboDto } from './dto/update-combo.dto';

@Injectable()
export class CombosService {
  constructor(
    @InjectRepository(Combo) private readonly combos: Repository<Combo>,
    @InjectRepository(Category) private readonly categories: Repository<Category>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
  ) {}
  findAll() { return this.combos.find({ order: { id: 'ASC' } }); }
  private async validate(dto: Partial<CreateComboDto>) {
    const categoryIds = dto.categoryIds ?? [];
    const productIds = dto.productIds ?? [];
    if (!categoryIds.length && !productIds.length) throw new BadRequestException('Selecione ao menos uma categoria ou produto.');
    if (categoryIds.length) {
      const categories = await this.categories.find({ where: { id: In(categoryIds) } });
      if (categories.length !== new Set(categoryIds).size) throw new BadRequestException('Uma ou mais categorias não foram encontradas.');
      if (dto.allowHalfAndHalf && !categories.some((category) => category.isPizza)) throw new BadRequestException('Meio a meio só pode ser ativado para categorias de pizza.');
      if (dto.allowHalfAndHalf && (dto.maxPizzaFlavors ?? 1) < 2) throw new BadRequestException('Escolha pelo menos dois sabores para permitir meio a meio.');
      if (dto.allowHalfAndHalf === false && dto.maxPizzaFlavors !== undefined && dto.maxPizzaFlavors !== 1) throw new BadRequestException('Sem meio a meio, o combo deve permitir apenas um sabor.');
    }
    if (productIds.length) {
      const products = await this.products.find({ where: { id: In(productIds) } });
      if (products.length !== new Set(productIds).size) throw new BadRequestException('Um ou mais produtos não foram encontrados.');
    }
    if (dto.optionalSource === 'custom' && dto.optionalsEnabled && !dto.customOptionals?.length) throw new BadRequestException('Cadastre ao menos um opcional para este combo.');
  }
  async create(dto: CreateComboDto) {
    await this.validate(dto);
    return this.combos.save(this.combos.create(dto));
  }
  async update(id: number, dto: UpdateComboDto) {
    const combo = await this.combos.findOneBy({ id });
    if (!combo) throw new NotFoundException('Combo não encontrado.');
    const updated = Object.assign(combo, dto);
    await this.validate(updated);
    return this.combos.save(updated);
  }
  async remove(id: number) {
    const combo = await this.combos.findOneBy({ id });
    if (!combo) throw new NotFoundException('Combo não encontrado.');
    await this.combos.remove(combo);
  }
}
