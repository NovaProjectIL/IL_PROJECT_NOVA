// main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as dotenv from 'dotenv';

// 🔧 CHARGER .env MANUELLEMENT POUR DEBUG
const envPath = '.env';
console.log('🔍 Recherche du fichier .env à:', envPath);

const result = dotenv.config({ path: envPath });
if (result.error) {
  console.error('❌ ERREUR chargement .env:', result.error.message);
  console.log('📁 Répertoire courant:', process.cwd());
} else {
  console.log('✅ .env chargé avec succès');
  console.log('📋 Variables chargées:', Object.keys(result.parsed || {}));
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // ✅ DEBUG DÉTAILLÉ
  console.log('\n=== 🐛 DEBUG ENVIRONNEMENT ===');
  console.log('1. YOUTUBE_API_KEY existe?', !!process.env.YOUTUBE_API_KEY);
  console.log('2. YOUTUBE_API_KEY valeur (10 premiers):', 
    process.env.YOUTUBE_API_KEY ? 
    process.env.YOUTUBE_API_KEY.substring(0, 10) + '...' : 
    'NON DÉFINIE'
  );
  console.log('3. DB_HOST:', process.env.DB_HOST || 'NON DÉFINI');
  console.log('4. DB_PORT:', process.env.DB_PORT || 'NON DÉFINI');
  console.log('5. PORT:', process.env.PORT || 'NON DÉFINI (utilise 3001)');
  
  // Vérifie si la clé ressemble à une clé API valide
  if (process.env.YOUTUBE_API_KEY) {
    if (process.env.YOUTUBE_API_KEY.startsWith('AIza')) {
      console.log('✅ Format de clé API valide (commence par AIza)');
    } else {
      console.log('⚠️ Format de clé API suspect');
    }
  }
  
  // ✅ CORS pour frontend Next.js (multiple localhost ports)
  app.enableCors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      // Allow localhost on any port
      if (origin.match(/^http:\/\/localhost:\d+$/)) {
        return callback(null, true);
      }

      // Allow specific origins if needed
      const allowedOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000'];
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error('Not allowed by CORS'));
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: 'Content-Type, Accept, Authorization',
  });
  
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  
  // ✅ MIDDLEWARE pour loguer les requêtes API YouTube
  app.use((req: any, res: any, next: any) => {
    if (req.url.includes('/youtube-info')) {
      console.log('\n🎬 Requête YouTube API reçue:');
      console.log('   URL:', req.url);
      console.log('   Clé API disponible?', !!process.env.YOUTUBE_API_KEY);
    }
    next();
  });
  
  await app.listen(3001);
  
  console.log(`\n🚀 Backend running on: http://localhost:3001`);
  console.log(`🌐 CORS enabled for: http://localhost:3000`);
  console.log(`🔗 Test YouTube API: http://localhost:3001/rooms/youtube-info?videoId=dQw4w9WgXcQ`);
  
  // Test direct de la clé API (optionnel)
  testYouTubeAPI();
}

// Fonction pour tester directement l'API YouTube
async function testYouTubeAPI() {
  const API_KEY = process.env.YOUTUBE_API_KEY;
  if (!API_KEY) {
    console.log('\n❌ TEST API: Aucune clé API disponible');
    return;
  }
  
  console.log('\n🧪 Test direct de l\'API YouTube...');
  try {
    // Test simple avec fetch
    const testUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=dQw4w9WgXcQ&key=${API_KEY}`;
    const response = await fetch(testUrl);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Clé API VALIDE');
      console.log('   Titre vidéo:', data.items?.[0]?.snippet?.title || 'Non trouvé');
    } else {
      console.log('❌ Clé API INVALIDE');
      const error = await response.text();
      console.log('   Erreur:', error.substring(0, 200));
    }
  } catch (error) {
    console.log('❌ Erreur de connexion à l\'API YouTube');
    console.log('   Détail:', error.message);
  }
}

bootstrap();