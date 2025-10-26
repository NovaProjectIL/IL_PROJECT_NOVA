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
      username: 'uapv2400036',  // ton user postgres
      password: 'JcxIH9', // ton mot de passe
      database: 'PROJET_IL_SERVER',     // nom de ta base
      entities: [User, Message],
      synchronize: true,      // true pour dev (crée tables automatiquement)
    }),
    ChatModule,
  ],
})
export class AppModule {}
