"use client";

import { useState, useEffect, useRef } from "react";
import Chat from "./Chat";

interface ChatWidgetProps {
  pseudo?: string;
  socket: any;      // Reçu de page.tsx
  roomCode: string; // Reçu de page.tsx
}

export default function ChatWidget({ pseudo = "Invité", socket, roomCode }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  
  const [sidebarWidth, setSidebarWidth] = useState(420);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Gestion du redimensionnement de la sidebar
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

  useEffect(() => {
    if (isOpen) setUnreadCount(0);
  }, [isOpen]);

  return (
    <>
      {/* Bouton pour ouvrir (Trigger) */}
      {!isOpen && (
        <div 
          className="chat-trigger-side"
          onClick={() => setIsOpen(true)}
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

      {/* Container Latéral (Sidebar) */}
      <div 
        ref={sidebarRef}
        className={`chat-sidebar-container ${isOpen ? '' : 'closed'}`}
        style={{ width: `${sidebarWidth}px` }}
      >
        <div className="resize-handle" onMouseDown={(e) => { e.preventDefault(); setIsResizing(true); }}>
            <div className="resize-line"></div>
        </div>

        <div className="chat-panel">
          <Chat 
            onClose={() => setIsOpen(false)} 
            pseudo={pseudo} 
            onMessageReceived={handleMessageReceived}
            socket={socket}
            roomCode={roomCode}
          />
        </div>
      </div>
    </>
  );
}