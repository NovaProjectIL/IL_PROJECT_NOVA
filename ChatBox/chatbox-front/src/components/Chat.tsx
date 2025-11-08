// Ton fichier Chat.tsx, modifié
"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

type Message = { username: string; message: string };

// On définit les Props que ce composant reçoit
type ChatProps = {
  onClose: () => void; // Une fonction pour fermer la fenêtre
};

export default function Chat({ onClose }: ChatProps) { // On récupère "onClose" ici
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const socketRef = useRef<Socket | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const s = io("http://localhost:3001", { transports: ["websocket"] });
    socketRef.current = s;

    s.on("connect", () => console.log("[Socket] connected:", s.id));

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

    // On s'assure de scroller aussi quand le composant s'ouvre
    scrollToBottom();

    return () => {
      s.disconnect();
    };
  }, []);

  // Ton code pour scroller (inchangé)
  const scrollToBottom = () => {
    // Petit délai pour laisser le DOM se mettre à jour
    setTimeout(() => {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    }, 50);
  };

  // Ton code pour envoyer (inchangé)
  const sendMessage = () => {
    if (!text.trim()) return;
    socketRef.current?.emit("sendMessage", text.trim());
    setText("");
  };

  return (
    // "chat-container-inner" permet au chat de prendre 100%
    // de la fenêtre "chat-window-container"
    <div className="chat-container-inner">
      
      {/* === DÉBUT DES AJOUTS === */}
      <div className="chat-header">
        <h3>Support en ligne</h3>
        <button onClick={onClose} className="chat-close-btn">
          &times; {/* Une simple croix pour fermer */}
        </button>
      </div>
      {/* === FIN DES AJOUTS === */}

      <div className="messages" ref={listRef}>
        {messages.length === 0 ? (
          <div className="no-messages">Aucun message</div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className="message-item">
              <b>{m.username}: </b>
              {m.message}
            </div>
          ))
        )}
      </div>

      {/* On groupe l'input et le bouton pour le style */}
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