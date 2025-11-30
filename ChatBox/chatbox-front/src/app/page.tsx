import Head from 'next/head';
import ChatWidget from '../components/ChatWidget'; 

export default function Home() {
  return (
    <>
      <Head>
        <title>TEST CHAT VERSION 1.8 </title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main className="page">
        <h1 className="title">TEST CHAT VERSION 1.8 </h1>
        <ChatWidget />
      </main>
    </>
  );
}