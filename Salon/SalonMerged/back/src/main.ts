// main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as dotenv from 'dotenv';

// ===== LOAD ENV =====
dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  console.log('\n=== DEBUG ENVIRONNEMENT ===');
  console.log('YOUTUBE_API_KEY existe ?', !!process.env.YOUTUBE_API_KEY);
  console.log('PORT:', process.env.PORT || 3001);

  // ===== CORS FIX PROPRE =====
  const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://novail.vercel.app', // frontend production
    process.env.FRONTEND_URL, // optionnel si défini
  ].filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      // requêtes serveur / curl / postman
      if (!origin) return callback(null, true);

      // localhost ports dynamiques
      if (/^http:\/\/localhost:\d+$/.test(origin)) {
        return callback(null, true);
      }

      if (/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) {
        return callback(null, true);
      }

      // ngrok (change souvent → autoriser wildcard)
      if (origin.includes('.ngrok-free.dev')) {
        return callback(null, true);
      }

      // production whitelist
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.log('CORS BLOQUÉ →', origin);
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'ngrok-skip-browser-warning',
    ],
  });

  // ===== VALIDATION =====
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  // ===== DEBUG REQUESTS =====
  app.use((req: any, res: any, next: any) => {
    if (req.url.includes('/youtube-info')) {
      console.log('\nRequête YouTube API:', req.url);
      console.log('Clé API dispo ?', !!process.env.YOUTUBE_API_KEY);
    }
    next();
  });

  const port = process.env.PORT || 3001;

  await app.listen(port, '0.0.0.0');

  console.log(`\nBackend running on http://localhost:${port}`);
  console.log('CORS actif pour localhost / vercel / ngrok');

  testYouTubeAPI();
}

// ===== TEST YOUTUBE API =====
async function testYouTubeAPI() {
  const API_KEY = process.env.YOUTUBE_API_KEY;
  if (!API_KEY) return console.log('Pas de clé API YouTube');

  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=dQw4w9WgXcQ&key=${API_KEY}`
    );

    if (res.ok) {
      const data = await res.json();
      console.log('Clé API YouTube OK');
      console.log('Titre:', data.items?.[0]?.snippet?.title);
    } else {
      console.log('Clé API invalide');
    }
  } catch (err: any) {
    console.log('Erreur test YouTube:', err.message);
  }
}

bootstrap();