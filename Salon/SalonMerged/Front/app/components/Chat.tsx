"use client";

import { useEffect, useRef, useState } from "react";
import EmojiPicker, { Theme } from "emoji-picker-react";
import { GiphyFetch } from "@giphy/js-fetch-api";
import { Grid } from "@giphy/react-components";

// Types
type Message = {
  username: string;
  message: string | null;
  gifUrl: string | null;
  createdAt: string;
};

type ChatProps = {
  onClose: () => void;
  pseudo: string;
  onMessageReceived?: () => void;
  socket: any;      // Reçoit le socket de la page
  roomCode: string; // Reçoit le code de la room
};

const giphyApiKey = "TVQlPggmgsUzg4lyGiR2btZLfpyfw6Z1"; // Ta clé
const gf = new GiphyFetch(giphyApiKey);

export default function Chat({ onClose, pseudo, onMessageReceived, socket, roomCode }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [pickerMode, setPickerMode] = useState<'none' | 'emoji' | 'gif'>('none');
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [gifSearch, setGifSearch] = useState("");

  const listRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!socket) return;

    const handleReceiveMessage = (msg: Message) => {
      setMessages((prev) => [...prev, msg]);
      setTypingUsers((prev) => prev.filter((name) => name !== msg.username));
      if (onMessageReceived) onMessageReceived();
      scrollToBottom();
    };

    const handleUserTyping = (data: { username: string; isTyping: boolean }) => {
      if (data.isTyping) {
        setTypingUsers((prev) => [...new Set([...prev, data.username])]);
      } else {
        setTypingUsers((prev) => prev.filter((name) => name !== data.username));
      }
      scrollToBottom();
    };

    // Écoute les événements
    socket.on("receiveMessage", handleReceiveMessage);
    socket.on("userTyping", handleUserTyping);

    // Nettoyage des écouteurs uniquement (pas de disconnect ici)
    return () => {
      socket.off("receiveMessage", handleReceiveMessage);
      socket.off("userTyping", handleUserTyping);
    };
  }, [socket, onMessageReceived, roomCode]);

  const scrollToBottom = () => {
    setTimeout(() => {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    }, 100);
  };

  const sendMessage = () => {
    if (!text.trim()) return;
    
    // Envoi au serveur avec le code de la room
    socket?.emit("sendMessage", { 
        roomCode, 
        message: text.trim(), 
        username: pseudo 
    });
    
    socket?.emit("typing", { roomCode, isTyping: false, username: pseudo });
    setText("");
    setPickerMode('none');
  };

  const sendGif = (gifUrl: string) => {
    socket?.emit("sendMessage", { 
        roomCode, 
        gifUrl: gifUrl, 
        username: pseudo 
    });
    setPickerMode('none');
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
    
    socket?.emit("typing", { roomCode, isTyping: true, username: pseudo });
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket?.emit("typing", { roomCode, isTyping: false, username: pseudo });
    }, 2000);
  };

  const fetchGifs = (offset: number) => {
    return gifSearch.trim() === "" 
      ? gf.trending({ offset, limit: 10 })
      : gf.search(gifSearch, { offset, limit: 10 });
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      {/* Header avec la classe CSS du fichier globals.css */}
      <div className="chat-header-rave">
        <h4 className="m-0 fw-bold text-white" style={{ letterSpacing: '1px', fontSize: '1.2rem' }}>
          CHAT ROOM
        </h4>
        <button 
            onClick={onClose} 
            className="btn-icon-rave" 
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      {/* Zone des messages */}
      <div className="chat-body-rave" ref={listRef}>
        {messages.length === 0 && (
          <div className="h-100 d-flex flex-column justify-content-center align-items-center text-white-50 opacity-50">
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💬</div>
            <p className="fw-light ls-1 text-uppercase small">La conversation commence ici</p>
          </div>
        )}

        {messages.map((m, i) => {
          const isMe = m.username === pseudo;
          return (
            <div key={i} className={`chat-message-row ${isMe ? "me" : "other"}`}>
              {!isMe && <span className="username-label">{m.username}</span>}
              
              {m.message && (
                <div className={`message-bubble ${isMe ? "message-me" : "message-other"}`}>
                  {m.message}
                </div>
              )}

              {m.gifUrl && (
                <div className={`mt-2 ${isMe ? 'text-end' : 'text-start'}`}>
                    <img src={m.gifUrl} alt="GIF" className="gif-image" style={{maxHeight: '150px', maxWidth: '100%'}} />
                </div>
              )}
              
              <span className="message-time">{formatTime(m.createdAt)}</span>
            </div>
          );
        })}

        {typingUsers.length > 0 && (
          <div className="text-white-50 ms-3 fst-italic small mt-2">
            <span className="spinner-grow spinner-grow-sm me-2" role="status" aria-hidden="true"></span>
            {typingUsers.length > 2 ? "Plusieurs personnes écrivent..." : typingUsers.join(", ") + " écrit..."}
          </div>
        )}
      </div>

      {/* Input Zone */}
      <div className="chat-input-rave position-relative">
        {pickerMode !== 'none' && (
            <div className="picker-overlay">
                <div className="picker-tabs">
                    <button className={`picker-tab ${pickerMode === 'emoji' ? 'active' : ''}`} onClick={() => setPickerMode('emoji')}>Emojis</button>
                    <button className={`picker-tab ${pickerMode === 'gif' ? 'active' : ''}`} onClick={() => setPickerMode('gif')}>GIFs</button>
                    <button className="btn-close-custom" onClick={() => setPickerMode('none')}>X</button>
                </div>
                
                <div className="flex-grow-1 position-relative overflow-hidden h-100">
                  {pickerMode === 'emoji' && (
                      <EmojiPicker 
                          onEmojiClick={(e) => setText((prev) => prev + e.emoji)} 
                          width="100%" height="100%" theme={Theme.DARK}
                          previewConfig={{ showPreview: false }}
                          style={{background: 'transparent', border: 'none'}}
                      />
                  )}
                  {pickerMode === 'gif' && (
                      <div className="h-100 d-flex flex-column">
                          <div className="px-3 pb-2">
                             <input 
                                  type="text" 
                                  className="form-control bg-dark text-white border-secondary form-control-sm rounded-pill" 
                                  placeholder="Rechercher un GIF..." 
                                  value={gifSearch}
                                  onChange={(e) => setGifSearch(e.target.value)}
                                  autoFocus
                              />
                          </div>
                          <div className="flex-grow-1 overflow-auto px-2 pb-2 d-flex justify-content-center">
                              <Grid 
                                  fetchGifs={fetchGifs} width={340} columns={3} gutter={6} noLink={true} key={gifSearch}
                                  onGifClick={(gif, e) => { e.preventDefault(); sendGif(gif.images.original.url); }}
                              />
                          </div>
                      </div>
                  )}
                </div>
            </div>
        )}

        <div className="input-group-rave">
            <button className={`btn-icon-rave ${pickerMode !== 'none' ? 'text-white' : ''}`} onClick={() => setPickerMode(pickerMode === 'none' ? 'emoji' : 'none')}>+</button>
            <input
                type="text" className="form-control-rave" placeholder="Envoyer un message..."
                value={text} onChange={handleTyping}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                onFocus={() => setPickerMode('none')}
            />
            <button className="btn-send-rave" onClick={sendMessage} disabled={!text.trim()}>➜</button>
        </div>
      </div>
    </>
  );
}