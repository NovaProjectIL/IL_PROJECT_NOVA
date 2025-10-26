"use client";
import React, { useState } from "react";
import { useChat } from "../context/ChatContext";

export default function MessageInput() {
  const { sendMessage } = useChat();
  const [content, setContent] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(content);
    setContent("");
  };

  return (
    <form onSubmit={handleSubmit} className="d-flex mt-3">
      <input
        type="text"
        className="form-control me-2"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Écris ton message..."
      />
      <button className="btn btn-primary" type="submit">
        Envoyer
      </button>
    </form>
  );
}
