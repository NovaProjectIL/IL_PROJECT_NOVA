"use client";
import React from "react";
import { useChat } from "../context/ChatContext";

export default function MessageList() {
  const { messages } = useChat();

  return (
    <div className="p-3 border rounded" style={{ height: "300px", overflowY: "auto" }}>
      {messages.map((msg, index) => (
        <div key={index}>
          <strong>{msg.username}:</strong> {msg.message}
        </div>
      ))}
    </div>
  );
}
