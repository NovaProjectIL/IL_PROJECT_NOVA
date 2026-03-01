'use client';

import React, { useEffect, useState, useRef } from 'react';
import { socketService } from '@/app/lib/socket';
import { Send, ChevronDown } from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: { id: number; name: string };
  content: string;
  timeSec?: number; // ✅ Timecode when message was sent
  timestamp: number;
}

interface ChatWidgetProps {
  roomCode: string;
  memberId: number;
  memberName: string;
  currentTime: number;
  onSeek?: (time: number) => void;
}

export default function ChatWidget({
  roomCode,
  memberId,
  memberName,
  currentTime,
  onSeek,
}: ChatWidgetProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ✅ Scroll au dernier message
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // ✅ Écouter les messages reçus
  useEffect(() => {
    socketService.onReceiveMessage((data: any) => {
      const msg: ChatMessage = {
        id: Date.now().toString(),
        sender: data.sender || { id: 0, name: 'Anonymous' },
        content: data.content,
        timeSec: data.timeSec,
        timestamp: data.timestamp || Date.now(),
      };
      setMessages((prev) => [...prev, msg]);
    });

    socketService.onUserTyping((data: any) => {
      // Optional: afficher "X est en train d'écrire..."
      console.log(`${data.sender?.name} is typing...`);
    });
  }, []);

  // ✅ Envoyer message avec timecode
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const message = {
      content: input.trim(),
      sender: { id: memberId, name: memberName },
      timeSec: Math.floor(currentTime), // ✅ Capture le timecode actuel
      timestamp: Date.now(),
    };

    // Ajouter localement
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        ...message,
      },
    ]);

    // Envoyer via socket
    socketService.sendMessage(roomCode, message);
    setInput('');
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: '#f8f9fa',
        borderRadius: '12px',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          backgroundColor: '#fff',
          borderBottom: '1px solid #e0e0e0',
          cursor: 'pointer',
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>💬 Chat</h3>
        <ChevronDown
          size={20}
          style={{
            transform: isExpanded ? 'rotate(0)' : 'rotate(180deg)',
            transition: 'transform 0.3s',
          }}
        />
      </div>

      {/* Messages Area */}
      {isExpanded && (
        <>
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            {messages.length === 0 ? (
              <div style={{textAlign: 'center', color: '#999', marginTop: '16px'}}>
                Pas de messages pour le moment
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    backgroundColor: msg.sender.id === memberId ? '#e3f2fd' : '#fff',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #e0e0e0',
                  }}
                >
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px'}}>
                    <span style={{fontSize: '12px', fontWeight: 600, color: '#333'}}>
                      {msg.sender.name}
                    </span>
                    {msg.timeSec !== undefined && (
                      <button
                        onClick={() => onSeek?.(msg.timeSec || 0)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#1976d2',
                          fontSize: '11px',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          padding: 0,
                        }}
                      >
                        @ {Math.floor(msg.timeSec)}s
                      </button>
                    )}
                  </div>
                  <p style={{margin: '4px 0 0 0', fontSize: '13px', color: '#333'}}>
                    {msg.content}
                  </p>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Form */}
          <form
            onSubmit={handleSendMessage}
            style={{
              display: 'flex',
              gap: '8px',
              padding: '12px',
              backgroundColor: '#fff',
              borderTop: '1px solid #e0e0e0',
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Votre message..."
              style={{
                flex: 1,
                padding: '8px 12px',
                border: '1px solid #e0e0e0',
                borderRadius: '6px',
                fontSize: '13px',
                outline: 'none',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#1976d2';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#e0e0e0';
              }}
            />
            <button
              type="submit"
              disabled={!input.trim()}
              style={{
                padding: '8px',
                backgroundColor: input.trim() ? '#1976d2' : '#ccc',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: input.trim() ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Send size={16} />
            </button>
          </form>
        </>
      )}
    </div>
  );
}
