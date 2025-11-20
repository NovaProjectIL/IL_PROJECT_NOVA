import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: "*",
    credentials: false,
  });

  await app.listen(3001);
  console.log(" NestJS backend is running on port 3001");
}
bootstrap();
