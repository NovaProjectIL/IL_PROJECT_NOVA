import Head from 'next/head';
// 1. On importe ChatWidget au lieu de Chat
import ChatWidget from '../components/ChatWidget'; 

export default function Home() {
  return (
    <>
      <Head>
        <title>Chat — Frontend</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main className="page">
        <h1 className="title">Chat</h1>
        
        {/* 2. On appelle notre nouveau widget ici.
          Il va s'afficher tout seul en bas à droite.
        */}
        <ChatWidget />

      </main>
    </>
  );
}