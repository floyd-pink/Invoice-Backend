import { ValidationPipe } from '@nestjs/common'; // 1. Import ValidationPipe
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 2. Add this exact line right here before app.listen()
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Automatically strips out fields that are NOT in your DTO
      forbidNonWhitelisted: true, // Throws an error if extra unapproved fields are sent
      transform: true, // Automatically transforms payloads to match DTO instances
    }),
  );

  await app.listen(3001);
}
bootstrap();
