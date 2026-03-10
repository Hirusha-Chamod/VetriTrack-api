import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './filters/exception-filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  
  app.enableCors();
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
bootstrap();