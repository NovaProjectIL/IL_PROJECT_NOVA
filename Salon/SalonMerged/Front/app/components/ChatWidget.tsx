"use client";

import { useState, useEffect, useRef } from "react";
import Chat from "./Chat";

// 1. On définit les props acceptées par le Widget
interface ChatWidgetProps {
  pseudo?: string; // Optionnel : si tu ne le donnes pas, ce sera "Invité"
}

// 2. On récupère le pseudo via les props (avec "Invité" comme valeur par défaut)
export default function ChatWidget({ pseudo = "Invité" }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  
  const [sidebarWidth, setSidebarWidth] = useState(420);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

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

  return (
    <>
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

      <div 
        ref={sidebarRef}
        className={`chat-sidebar-container ${isOpen ? '' : 'closed'}`}
        style={{ width: `${sidebarWidth}px` }}
      >
        <div className="resize-handle" onMouseDown={(e) => { e.preventDefault(); setIsResizing(true); }}>
            <div className="resize-line"></div>
        </div>

        <div className="chat-panel">
          {/* 3. On passe le pseudo dynamique au composant Chat */}
          <Chat 
            onClose={() => setIsOpen(false)} 
            pseudo={pseudo} 
            onMessageReceived={handleMessageReceived}
          />
        </div>
      </div>
    </>
  );
}