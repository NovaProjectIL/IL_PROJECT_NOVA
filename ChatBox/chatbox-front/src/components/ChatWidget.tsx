"use client";

import { useState } from "react";
import Chat from "./Chat";

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const handleMessageReceived = () => {
    if (!isOpen) {
      setUnreadCount((prev) => prev + 1);
    }
  };

  const handleOpenChat = () => {
    setIsOpen(true);
    setUnreadCount(0);
  };

  return (
    <>
      <div className={`chat-widget-container ${isOpen ? 'd-none' : ''}`}>
        <button
          className="btn btn-mauve rounded-pill px-4 py-3 shadow-lg d-flex align-items-center gap-2 position-relative"
          onClick={handleOpenChat}
        >
          <i className="bi bi-chat-dots-fill fs-4"></i>
          <span className="fw-bold">Live Chat</span>

          {unreadCount > 0 && (
            <span className="badge bg-danger rounded-pill ms-2 shadow-sm animate-bounce">
              {unreadCount > 9 ? "+9" : unreadCount}
            </span>
          )}
        </button>
      </div>

      <div className={`chat-widget-container ${!isOpen ? 'd-none' : ''}`}>
        <div className="chat-card">
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