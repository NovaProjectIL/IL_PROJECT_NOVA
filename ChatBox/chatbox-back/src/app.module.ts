import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatModule } from './chat/chat.module';
import { User } from './chat/entities/user.entity';
import { Message } from './chat/entities/message.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'pedago.univ-avignon.fr',
      port: 5432,
      username: 'uapv2400036', 
      password: 'JcxIH9', 
      database: 'etd', 
      schema: 'uapv2400036', 
      entities: [User, Message],
      synchronize: true, 
      autoLoadEntities: true,
      logging: true,
      ssl: false,
    }),
    ChatModule,
  ],
})
export class AppModule {}
