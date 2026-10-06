import {
  Body,
  Controller,
  Get,
  Header,
  Injectable,
  Module,
  Put,
  Patch,
} from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Column, Entity, PrimaryColumn, Repository } from 'typeorm';
import {
  ArrayMaxSize,
  IsArray,
  IsString,
  Matches,
  MaxLength,
  IsIn,
  IsOptional,
} from 'class-validator';
export class PizzeriaSettingsDto {
  @IsOptional() @IsIn(['dark', 'light']) theme?: 'dark' | 'light';
  @IsString() @MaxLength(120) name!: string;
  @IsString() @MaxLength(500) address!: string;
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  phones!: string[];
  @IsString() @MaxLength(18) cnpj!: string;
  @IsString()
  @MaxLength(60000)
  @Matches(/^(?:|data:image\/webp;base64,[A-Za-z0-9+/]+={0,2})$/)
  logo!: string;
}
export class PizzeriaThemeDto {
  @IsIn(['dark', 'light']) theme!: 'dark' | 'light';
}
@Entity('pizzeria_settings')
export class PizzeriaSettings {
  @PrimaryColumn('int') id!: number;
  @Column('jsonb') data!: object;
}
@Injectable()
export class PizzeriaSettingsService {
  constructor(
    @InjectRepository(PizzeriaSettings)
    private readonly repo: Repository<PizzeriaSettings>,
  ) {}
  async get() {
    return {
      theme: 'dark',
      ...((await this.repo.findOneBy({ id: 1 }))?.data ?? {
        name: '',
        address: '',
        phones: [],
        cnpj: '',
        logo: '',
      }),
    };
  }
  async save(data: PizzeriaSettingsDto) {
    const { theme: _theme, ...profile } = data;
    const rows = await this.repo.query(
      `INSERT INTO pizzeria_settings (id, data) VALUES (1, $1::jsonb)
       ON CONFLICT (id) DO UPDATE SET data = pizzeria_settings.data || (EXCLUDED.data - 'theme')
       RETURNING data`,
      [JSON.stringify({ ...profile, theme: 'dark' })],
    );
    return { theme: 'dark', ...rows[0].data };
  }
  async saveTheme(theme: 'dark' | 'light') {
    const rows = await this.repo.query(
      `INSERT INTO pizzeria_settings (id, data) VALUES (1, $1::jsonb)
       ON CONFLICT (id) DO UPDATE SET data = pizzeria_settings.data || jsonb_build_object('theme', $2::text)
       RETURNING data`,
      [
        JSON.stringify({
          name: '',
          address: '',
          phones: [],
          cnpj: '',
          logo: '',
          theme,
        }),
        theme,
      ],
    );
    return rows[0].data;
  }
}
@Controller('pizzeria-settings')
export class PizzeriaSettingsController {
  constructor(private readonly service: PizzeriaSettingsService) {}
  @Get() @Header('Cache-Control', 'no-store') get() {
    return this.service.get();
  }
  @Put() save(@Body() dto: PizzeriaSettingsDto) {
    return this.service.save(dto);
  }
  @Patch('theme') saveTheme(@Body() dto: PizzeriaThemeDto) {
    return this.service.saveTheme(dto.theme);
  }
}
@Module({
  imports: [TypeOrmModule.forFeature([PizzeriaSettings])],
  providers: [PizzeriaSettingsService],
  controllers: [PizzeriaSettingsController],
})
export class PizzeriaSettingsModule {}
