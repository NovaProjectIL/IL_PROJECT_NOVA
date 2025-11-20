"use client";

import { useState } from "react";
import Chat from "./Chat";

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(true); 
  const [unreadCount, setUnreadCount] = useState(0);

  const handleMessageReceived = () => {
    if (!isOpen) {
      setUnreadCount((prev) => prev + 1);
    }
  };

  const toggleChat = () => {
    setIsOpen(!isOpen);
    if (!isOpen) setUnreadCount(0);
  };

  return (
    <>
      {!isOpen && (
        <div 
          className="chat-trigger-side"
          onClick={toggleChat}
          title="Ouvrir le chat"
        >
          <span className="chat-trigger-text">Chat</span>
          
          {unreadCount > 0 && (
            <span className="badge-notification animate-bounce">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </div>
      )}

      <div className={`chat-sidebar-container ${isOpen ? '' : 'closed'}`}>
        <div className="chat-panel">
          <Chat 
            onClose={() => setIsOpen(false)} 
            pseudo="Invité" 
            onMessageReceived={handleMessageReceived}
          />
        </div>
      </div>
    </>
  );
}
