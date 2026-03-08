"use client";

import { useState, useEffect, useRef } from "react";
import Chat from "./Chat";

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  
  const [sidebarWidth, setSidebarWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const stopResizing = () => setIsResizing(false);
    const resize = (e: MouseEvent) => {
      if (isResizing) {
        const newWidth = window.innerWidth - e.clientX;
        if (newWidth > 300 && newWidth < 800) {
          setSidebarWidth(newWidth);
        }
      }
    };

    if (isResizing) {
      window.addEventListener("mousemove", resize);
      window.addEventListener("mouseup", stopResizing);
    }

    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [isResizing]);

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
            <span className="badge-notification animate-jump">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </div>
      )}

      <div 
        ref={sidebarRef}
        className={`chat-sidebar-container ${isOpen ? '' : 'closed'}`}
        style={{ width: `${sidebarWidth}px` }}
      >
        <div className="resize-handle" onMouseDown={startResizing}>
            <div className="resize-line"></div>
        </div>

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