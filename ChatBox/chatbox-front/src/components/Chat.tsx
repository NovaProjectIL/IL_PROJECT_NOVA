"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

type Message = { username: string; message: string };

export default function Chat() {
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

    return () => {
      s.disconnect();
    };
  }, []);

  const scrollToBottom = () => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  };

  const sendMessage = () => {
    if (!text.trim()) return;
    socketRef.current?.emit("sendMessage", text.trim());
    setText("");
  };

  return (
    <div className="chat">
      <div className="messages" ref={listRef}>
        {messages.length === 0 ? (
          <div>Aucun message</div>
        ) : (
          messages.map((m, i) => (
            <div key={i}>
              <b>{m.username}: </b>
              {m.message}
            </div>
          ))
        )}
      </div>

      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        placeholder="Écris ton message..."
      />
      <button onClick={sendMessage}>Envoyer</button>
    </div>
  );
}
