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
      username: 'uapv2400036', // ton identifiant étudiant
      password: 'JcxIH9', // ton mot de passe pédagogique
      database: 'etd', // ✅ CORRECTION : base partagée des étudiants
      schema: 'uapv2400036', // ✅ ton schéma personnel dans la base etd
      entities: [User, Message],
      synchronize: true, // crée automatiquement les tables (en dev)
      autoLoadEntities: true,
      logging: true,
      ssl: false,
    }),
    ChatModule,
  ],
})
export class AppModule {}
