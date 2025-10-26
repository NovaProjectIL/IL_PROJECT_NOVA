"use client";
import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { io, Socket } from "socket.io-client";

interface Message {
  username: string;
  message: string;
}

interface ChatContextProps {
  messages: Message[];
  sendMessage: (content: string) => void;
}

const ChatContext = createContext<ChatContextProps | undefined>(undefined);

export const ChatProvider = ({ children }: { children: ReactNode }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);

  // Connexion au backend socket.io
  useEffect(() => {
    const newSocket = io("http://localhost:3001", {
      transports: ["websocket"],
    });

    setSocket(newSocket);

    // 🔹 Charger l’historique des messages
    newSocket.on("loadMessages", (msgs: Message[]) => {
      setMessages(msgs);
    });

    // 🔹 Recevoir les nouveaux messages
    newSocket.on("receiveMessage", (msg: Message) => {
      setMessages((prev) => [...prev, msg]);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Envoyer un message
  const sendMessage = (content: string) => {
    if (socket && content.trim() !== "") {
      socket.emit("sendMessage", content);
    }
  };

  return (
    <ChatContext.Provider value={{ messages, sendMessage }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
};
