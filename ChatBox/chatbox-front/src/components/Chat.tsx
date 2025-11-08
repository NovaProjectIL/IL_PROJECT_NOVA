"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

// 1. MISE À JOUR DU TYPE MESSAGE
// Le backend envoie maintenant plus d'infos
type Message = {
  username: string;
  message: string | null; // Le message peut être null si c'est un GIF
  gifUrl: string | null;  // Le GIF peut être null si c'est un message
  createdAt: string;    // Pratique pour une clé unique
};

type ChatProps = {
  onClose: () => void; // Une fonction pour fermer la fenêtre
};

export default function Chat({ onClose }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const socketRef = useRef<Socket | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const s = io("http://localhost:3001", { transports: ["websocket"] });
    socketRef.current = s;

    s.on("connect", () => console.log("[Socket] connected:", s.id));

    // Ces écouteurs sont maintenant compatibles avec le nouveau type Message
    s.on("loadMessages", (msgs: Message[]) => {
      console.log("[Socket] loadMessages:", msgs);
      setMessages(msgs);
      scrollToBottom();
    });

    s.on("receiveMessage", (msg: Message) => {
      console.log("[Socket] receiveMessage:", msg);
      setMessages((prev) => [...prev, msg]);
      scrollToBottom();
    });

    scrollToBottom();

    return () => {
      s.disconnect();
    };
  }, []);

  const scrollToBottom = () => {
    setTimeout(() => {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    }, 50);
  };

  // 2. MISE À JOUR DE SENDMESSAGE
  const sendMessage = () => {
    const messageContent = text.trim();
    if (!messageContent) return; // Ne rien envoyer si c'est vide

    // Le backend attend un objet { message?: string, gifUrl?: string }
    // On envoie donc un objet avec la clé "message"
    socketRef.current?.emit("sendMessage", { message: messageContent });
    
    setText("");
  };

  return (
    <div className="chat-container-inner">
      <div className="chat-header">
        <h3>Support en ligne</h3>
        <button onClick={onClose} className="chat-close-btn">
          &times;
        </button>
      </div>

      <div className="messages" ref={listRef}>
        {messages.length === 0 ? (
          <div className="no-messages">Aucun message</div>
        ) : (
          // 3. MISE À JOUR DE L'AFFICHAGE
          // On gère le texte ET les GIFs
          messages.map((m, i) => (
            <div key={`${m.createdAt}-${i}`} className="message-item">
              <b>{m.username}: </b>
              
              {/* Afficher le texte s'il existe */}
              {m.message && <div>{m.message}</div>}
              
              {/* Afficher le GIF s'il existe */}
              {m.gifUrl && (
                <img
                  src={m.gifUrl}
                  alt="gif"
                  style={{
                    maxWidth: '250px', // Limiter la taille du GIF
                    borderRadius: '8px',
                    // Ajouter un espace si y'a aussi du texte
                    marginTop: m.message ? '8px' : '0',
                  }}
                />
              )}
            </div>
          ))
        )}
      </div>

      <div className="chat-input-area">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Écris ton message..."
        />
        <button onClick={sendMessage}>Envoyer</button>
      </div>
    </div>
  );
}