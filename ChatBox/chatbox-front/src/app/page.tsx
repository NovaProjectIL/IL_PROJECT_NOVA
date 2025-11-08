import Head from 'next/head';
import Chat from '../components/Chat';


export default function Home() {
return (
<>
<Head>
<title>Chat — Frontend</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
</Head>
<main className="page">
<h1 className="title">Chat</h1>
<Chat />
</main>
</>
);
}