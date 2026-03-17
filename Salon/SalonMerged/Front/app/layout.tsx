// app/layout.tsx
import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'NOVA - Plateforme de Streaming Synchronisé',
  description: 'Regardez vos vidéos YouTube préférées en parfaite synchronisation avec vos amis. Créez votre salon privé et profitez d\'une expérience de visionnage collective.',
  keywords: 'streaming, youtube, synchronisé, visionnage, groupe, amis, vidéo',
  authors: [{ name: 'NOVA Team' }],
  openGraph: {
    title: 'NOVA - Streaming Synchronisé',
    description: 'Plateforme de visionnage YouTube synchronisé entre amis',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
       

        {/* Main Content */}
        <main className="main-content">
          {children}
        </main>

        
      </body>
    </html>
  );
}
