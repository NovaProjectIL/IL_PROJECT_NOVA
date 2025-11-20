"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import EmojiPicker, { Theme } from "emoji-picker-react";
import { GiphyFetch } from "@giphy/js-fetch-api";
import { Grid } from "@giphy/react-components";

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
};

const giphyApiKey = "TVQlPggmgsUzg4lyGiR2btZLfpyfw6Z1";
const gf = new GiphyFetch(giphyApiKey);

export default function Chat({ onClose, pseudo, onMessageReceived }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [pickerMode, setPickerMode] = useState<'none' | 'emoji' | 'gif'>('none');
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [gifSearch, setGifSearch] = useState("");

  const socketRef = useRef<Socket | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const s = io("http://localhost:3001", { transports: ["websocket"] });
    socketRef.current = s;

    s.on("connect", () => {
      s.emit("setUser", { username: pseudo });
    });

    s.on("identity", (name: string) => setCurrentUsername(name));
    s.on("userSet", (data: { username: string }) => setCurrentUsername(data.username));

    s.on("loadMessages", (msgs: Message[]) => {
      setMessages(msgs);
      scrollToBottom();
    });

    s.on("receiveMessage", (msg: Message) => {
      setMessages((prev) => [...prev, msg]);
      setTypingUsers((prev) => prev.filter((name) => name !== msg.username));
      if (onMessageReceived) onMessageReceived();
      scrollToBottom();
    });

    s.on("userTyping", (data: { username: string; isTyping: boolean }) => {
      if (data.isTyping) {
        setTypingUsers((prev) => [...new Set([...prev, data.username])]);
      } else {
        setTypingUsers((prev) => prev.filter((name) => name !== data.username));
      }
      scrollToBottom();
    });

    return () => {
      s.disconnect();
    };
  }, [pseudo, onMessageReceived]);

  const scrollToBottom = () => {
    setTimeout(() => {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    }, 100);
  };

  const sendMessage = () => {
    if (!text.trim()) return;
    socketRef.current?.emit("sendMessage", { message: text.trim() });
    socketRef.current?.emit("typing", false);
    setText("");
    setPickerMode('none');
  };

  const sendGif = (gifUrl: string) => {
    socketRef.current?.emit("sendMessage", { gifUrl: gifUrl });
    setPickerMode('none');
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
    socketRef.current?.emit("typing", true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current?.emit("typing", false);
    }, 2000);
  };

  const fetchGifs = (offset: number) => {
    if (gifSearch.trim() === "") {
      return gf.trending({ offset, limit: 10 });
    }
    return gf.search(gifSearch, { offset, limit: 10 });
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      <div className="chat-header-rave">
        <div className="d-flex align-items-center gap-3">
           
           <img 
             src="/logo.png" 
             alt="Nova Logo" 
             className="chat-logo"
           />

           {/* Titre supprimé, on garde juste le statut Live */}
           <div className="d-flex align-items-center">
             <span className="bg-success rounded-circle me-2 shadow-sm" style={{width:'6px', height:'6px', boxShadow: '0 0 8px #28a745'}}></span>
             <small className="text-white-50 fw-bold" style={{ fontSize: '0.7rem', letterSpacing: '1px', textTransform: 'uppercase' }}>
               Live Now
             </small>
           </div>
        </div>
        <button onClick={onClose} className="btn btn-icon-rave fs-4">
          <i className="bi bi-arrow-right-circle"></i>
        </button>
      </div>

      <div className="chat-body-rave" ref={listRef}>
        {messages.length === 0 && (
          <div className="h-100 d-flex flex-column justify-content-center align-items-center text-white-50 opacity-50">
            <img src="/logo.png" alt="Logo" style={{width: '60px', opacity: 0.3, filter: 'grayscale(100%)'}} className="mb-3" />
            <p className="fw-light ls-1">START THE VIBE</p>
          </div>
        )}

        {messages.map((m, i) => {
          const isMe = currentUsername && m.username === currentUsername;
          return (
            <div key={i} className={`d-flex flex-column ${isMe ? "align-items-end" : "align-items-start"}`}>
              {!isMe && <span className="username-label">{m.username}</span>}
              
              {m.message && (
                <div className={`message-bubble ${isMe ? "message-me" : "message-other"}`}>
                  {m.message}
                </div>
              )}

              {m.gifUrl && (
                <div className={`mt-2 ${isMe ? 'text-end' : 'text-start'}`}>
                    <img 
                      src={m.gifUrl} 
                      alt="GIF" 
                      className="gif-image"
                      style={{maxHeight: '200px', maxWidth: '100%'}} 
                    />
                </div>
              )}
              
              <span className="message-time">
                {formatTime(m.createdAt)}
              </span>
            </div>
          );
        })}

        {typingUsers.length > 0 && (
          <div className="text-white-50 ms-3 fst-italic small d-flex align-items-center mt-2">
            <div className="typing-indicator me-2">
                <span style={{background: 'var(--neon-purple)'}}></span>
                <span style={{background: 'var(--neon-blue)'}}></span>
                <span style={{background: 'white'}}></span>
            </div>
            <span style={{fontSize: '0.75rem'}}>{typingUsers.length > 2 ? "Plusieurs..." : typingUsers.join(", ") + " ..."}</span>
          </div>
        )}
      </div>

      <div className="chat-input-rave position-relative">
        {pickerMode !== 'none' && (
            <div className="picker-overlay">
                <div className="picker-tabs">
                    <button 
                        className={`picker-tab ${pickerMode === 'emoji' ? 'active' : ''}`}
                        onClick={() => setPickerMode('emoji')}
                    >
                        <i className="bi bi-emoji-smile me-2"></i> Emojis
                    </button>
                    <button 
                        className={`picker-tab ${pickerMode === 'gif' ? 'active' : ''}`}
                        onClick={() => setPickerMode('gif')}
                    >
                        <i className="bi bi-filetype-gif me-2"></i> GIFs
                    </button>
                    <button className="btn-close-custom" onClick={() => setPickerMode('none')}>
                        <i className="bi bi-x-lg"></i>
                    </button>
                </div>
                
                <div className="flex-grow-1 position-relative overflow-hidden">
                  {pickerMode === 'emoji' && (
                      <div className="h-100 w-100">
                          <EmojiPicker 
                              onEmojiClick={(e) => setText((prev) => prev + e.emoji)} 
                              width="100%" 
                              height="100%"
                              theme={Theme.DARK}
                              searchDisabled={false}
                              previewConfig={{ showPreview: false }}
                              style={{background: 'transparent', border: 'none'}}
                          />
                      </div>
                  )}
                  
                  {pickerMode === 'gif' && (
                      <div className="h-100 d-flex flex-column">
                          <div className="px-3 pb-2">
                             <input 
                                  type="text" 
                                  className="form-control bg-dark text-white border-secondary form-control-sm rounded-pill" 
                                  placeholder="Search Giphy..." 
                                  value={gifSearch}
                                  onChange={(e) => setGifSearch(e.target.value)}
                                  autoFocus
                              />
                          </div>
                          <div className="flex-grow-1 overflow-auto px-2 pb-2 d-flex justify-content-center">
                              <Grid 
                                  fetchGifs={fetchGifs} 
                                  width={360} 
                                  columns={3} 
                                  gutter={6}
                                  noLink={true}
                                  key={gifSearch}
                                  onGifClick={(gif, e) => {
                                      e.preventDefault();
                                      sendGif(gif.images.original.url);
                                  }}
                              />
                          </div>
                      </div>
                  )}
                </div>
            </div>
        )}

        <div className="input-group-rave">
            <button 
                className={`btn-icon-rave ${pickerMode !== 'none' ? 'text-white' : ''}`}
                onClick={() => setPickerMode(pickerMode === 'none' ? 'emoji' : 'none')}
            >
                <i className="bi bi-plus-circle-fill fs-4"></i>
            </button>
            
            <input
                type="text"
                className="form-control-rave"
                placeholder="Envoyer un message..."
                value={text}
                onChange={handleTyping}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                onFocus={() => setPickerMode('none')}
            />
            
            <button 
                className="btn-send-rave"
                onClick={sendMessage}
                disabled={!text.trim()}
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
            </button>
        </div>
      </div>
    </>
  );
}