import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../categories/entities/category.entity';
import { Product } from './entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(Category)
    private readonly categories: Repository<Category>,
  ) {}

  findAll() {
    return this.products.find({
      relations: { category: true },
      order: { id: 'ASC' },
    });
  }
  async findOne(id: number) {
    const product = await this.products.findOne({
      where: { id },
      relations: { category: true },
    });
    if (!product) throw new NotFoundException('Produto não encontrado.');
    return product;
  }
  private async validate(product: Product) {
    const category = await this.categories.findOneBy({
      id: product.categoryId,
    });
    if (!category) throw new BadRequestException('Categoria não encontrada.');
    if (
      product.promotionalPrice != null &&
      product.promotionalPrice >= product.price
    ) {
      throw new BadRequestException(
        'O valor promocional deve ser menor que o valor do produto.',
      );
    }
    product.category = category;
  }
  async create(dto: CreateProductDto) {
    const product = this.products.create({
      description: '',
      photo: null,
      promotionalPrice: null,
      available: true,
      ...dto,
    });
    await this.validate(product);
    return this.products.save(product);
  }
  async update(id: number, dto: UpdateProductDto) {
    const product = Object.assign(await this.findOne(id), dto);
    await this.validate(product);
    return this.products.save(product);
  }
  async remove(id: number) {
    await this.products.remove(await this.findOne(id));
  }
  async updateStatus(id: number) {
    const product = await this.findOne(id);
    product.available = !product.available;
    return this.products.save(product);
  }
}
