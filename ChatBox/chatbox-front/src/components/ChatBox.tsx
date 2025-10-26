"use client";
import React from "react";
import "../styles/chat.css";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";

export default function ChatBox() {
  return (
    <div className="chat-container">
      <div className="chat-header">💬 Chat en direct</div>
      <div className="chat-messages">
        <MessageList />
      </div>
      <div className="chat-input">
        <MessageInput />
      </div>
    </div>
  );
}
