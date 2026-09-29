import { NeighborhoodsModule } from './neighborhoods/neighborhoods.module';
import { PaymentMethodsModule } from './payment-methods/payment-methods.module';
import { OrdersModule } from './orders/orders.module';
import { StoreSettingsModule } from './store-settings/store-settings.module';
import { OptionalsModule } from './optionals/optionals.module';
import { PizzasModule } from './pizzas/pizzas.module';
import { ProductsModule } from './products/products.module';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from './users/users.module';
import { CategoriesModule } from './categories/categories.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DATABASE_HOST'),
        port: configService.get<number>('DATABASE_PORT'),
        username: configService.get<string>('DATABASE_USER'),
        password: configService.get<string>('DATABASE_PASSWORD'),
        database: configService.get<string>('DATABASE_NAME'),
        autoLoadEntities: true,
        synchronize: true, // remover em produção para não autocriar tabelas no banco
      }),
    }),
    UsersModule,
    CategoriesModule,
    ProductsModule,
    PizzasModule,
    OptionalsModule,
    NeighborhoodsModule,
    PaymentMethodsModule,
    OrdersModule,
    StoreSettingsModule,
  ],
})
export class AppModule {}
