import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Neighborhood } from './entities/neighborhood.entity';
import { SaveNeighborhoodDto } from './dto/save-neighborhood.dto';
@Injectable()
export class NeighborhoodsService {
  constructor(
    @InjectRepository(Neighborhood)
    private readonly repo: Repository<Neighborhood>,
  ) {}
  findAll() {
    return this.repo.find({ order: { name: 'ASC' } });
  }
  async save(dto: SaveNeighborhoodDto, id?: number) {
    const previous = id ? await this.repo.findOneBy({ id }) : null;
    if (id && !previous) throw new NotFoundException('Bairro não encontrado.');
    try {
      return await this.repo.save(this.repo.create({ ...previous, ...dto }));
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string }).code === '23505'
      )
        throw new ConflictException('Já existe um bairro com esse nome.');
      throw error;
    }
  }
  async remove(id: number) {
    const result = await this.repo.delete(id);
    if (!result.affected) throw new NotFoundException('Bairro não encontrado.');
  }
}
