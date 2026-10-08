import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { AuthService } from './auth/auth.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.setGlobalPrefix('api');
  await app.get(AuthService).ensureSupportUser();
  app.enableCors({
    origin: ['http://localhost:4200', 'http://localhost:4201'],
  });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
