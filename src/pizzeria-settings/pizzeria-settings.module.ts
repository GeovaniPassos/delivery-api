import {
  Body,
  Controller,
  Get,
  Header,
  Injectable,
  Module,
  Put,
} from "@nestjs/common";
import { InjectRepository, TypeOrmModule } from "@nestjs/typeorm";
import { Column, Entity, PrimaryColumn, Repository } from "typeorm";
import {
  ArrayMaxSize,
  IsArray,
  IsString,
  Matches,
  MaxLength,
} from "class-validator";
export class PizzeriaSettingsDto {
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
@Entity("pizzeria_settings")
export class PizzeriaSettings {
  @PrimaryColumn("int") id!: number;
  @Column("jsonb") data!: object;
}
@Injectable()
export class PizzeriaSettingsService {
  constructor(
    @InjectRepository(PizzeriaSettings)
    private readonly repo: Repository<PizzeriaSettings>,
  ) {}
  async get() {
    return (
      (await this.repo.findOneBy({ id: 1 }))?.data ?? {
        name: "",
        address: "",
        phones: [],
        cnpj: "",
        logo: "",
      }
    );
  }
  async save(data: PizzeriaSettingsDto) {
    await this.repo.upsert({ id: 1, data }, ["id"]);
    return data;
  }
}
@Controller("pizzeria-settings")
export class PizzeriaSettingsController {
  constructor(private readonly service: PizzeriaSettingsService) {}
  @Get() @Header("Cache-Control", "no-store") get() {
    return this.service.get();
  }
  @Put() save(@Body() dto: PizzeriaSettingsDto) {
    return this.service.save(dto);
  }
}
@Module({
  imports: [TypeOrmModule.forFeature([PizzeriaSettings])],
  providers: [PizzeriaSettingsService],
  controllers: [PizzeriaSettingsController],
})
export class PizzeriaSettingsModule {}
