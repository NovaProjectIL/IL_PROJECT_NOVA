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
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
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
    setShowEmojiPicker(false);
    setShowGifPicker(false);
  };

  const sendGif = (gifUrl: string) => {
    socketRef.current?.emit("sendMessage", { gifUrl: gifUrl });
    setShowEmojiPicker(false);
    setShowGifPicker(false);
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

  return (
    <>
      <div className="chat-header-rave">
        <div className="d-flex align-items-center gap-3">
           <div className="rounded-circle d-flex align-items-center justify-content-center" 
                style={{width:'40px', height:'40px', background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.1)'}}>
             <i className="bi bi-people-fill text-white"></i>
           </div>
           <div>
             <h6 className="m-0 fw-bold text-white" style={{letterSpacing: '0.5px'}}>Salon Général</h6>
             <div className="d-flex align-items-center">
               <span className="bg-success rounded-circle me-2" style={{width:'6px', height:'6px'}}></span>
               <small className="text-white-50" style={{ fontSize: '0.75rem' }}>
                 {currentUsername || 'Connexion...'}
               </small>
             </div>
           </div>
        </div>
        <button onClick={onClose} className="btn btn-icon-rave fs-5" title="Masquer le chat">
          <i className="bi bi-chevron-right"></i>
        </button>
      </div>

      <div className="chat-body-rave" ref={listRef}>
        {messages.length === 0 && (
          <div className="h-100 d-flex flex-column justify-content-center align-items-center text-white-50">
            <i className="bi bi-chat-dots fs-1 mb-3 opacity-50"></i>
            <p className="small">La conversation commence ici.</p>
          </div>
        )}

        {messages.map((m, i) => {
          const isMe = currentUsername && m.username === currentUsername;
          return (
            <div key={i} className={`d-flex flex-column ${isMe ? "align-items-end" : "align-items-start"}`}>
              {!isMe && <span className="username-label">{m.username}</span>}
              <div className={`message-bubble ${isMe ? "message-me" : "message-other"}`}>
                {m.message && <span>{m.message}</span>}
                {m.gifUrl && (
                    <div className="rounded overflow-hidden mt-1">
                        <img src={m.gifUrl} alt="GIF" className="img-fluid" style={{maxHeight: '180px'}} />
                    </div>
                )}
              </div>
            </div>
          );
        })}

        {typingUsers.length > 0 && (
          <div className="text-white-50 ms-3 fst-italic small d-flex align-items-center">
            <div className="typing-indicator me-2">
                <span></span><span></span><span></span>
            </div>
            {typingUsers.length > 2 ? "Plusieurs personnes..." : typingUsers.join(", ") + " ..."}
          </div>
        )}
      </div>

      <div className="chat-input-rave position-relative">
        {(showEmojiPicker || showGifPicker) && (
            <div className="picker-overlay">
                <div className="d-flex justify-content-between align-items-center px-3 py-2 border-bottom border-secondary" style={{background: 'rgba(20,20,30,0.95)'}}>
                    <span className="fw-bold text-white small text-uppercase ls-1">
                        {showEmojiPicker ? "Émojis" : "GIFs"}
                    </span>
                    <button 
                        className="btn-close btn-close-white small" 
                        onClick={() => { setShowEmojiPicker(false); setShowGifPicker(false); }}
                    ></button>
                </div>

                <div className="picker-content h-100 w-100 bg-dark">
                  {showEmojiPicker && (
                      <EmojiPicker 
                          onEmojiClick={(e) => setText((prev) => prev + e.emoji)} 
                          width="100%" 
                          height="100%"
                          theme={Theme.DARK}
                          searchDisabled={false}
                          previewConfig={{ showPreview: false }}
                      />
                  )}
                  
                  {showGifPicker && (
                      <div className="d-flex flex-column h-100" style={{background: '#121212'}}>
                          <div className="p-2 border-bottom border-secondary">
                             <input 
                                  type="text" 
                                  className="form-control bg-dark text-white border-secondary form-control-sm" 
                                  placeholder="Rechercher..." 
                                  value={gifSearch}
                                  onChange={(e) => setGifSearch(e.target.value)}
                                  autoFocus
                              />
                          </div>
                          <div className="flex-grow-1 overflow-auto p-2 d-flex justify-content-center">
                              <Grid 
                                  fetchGifs={fetchGifs} 
                                  width={320} 
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
                className={`btn-icon-rave ${showEmojiPicker ? 'text-white' : ''}`}
                onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowGifPicker(false); }}
                title="Emojis"
            >
                <i className="bi bi-emoji-smile fs-5"></i>
            </button>
            <button 
                className={`btn-icon-rave ${showGifPicker ? 'text-white' : ''}`}
                onClick={() => { setShowGifPicker(!showGifPicker); setShowEmojiPicker(false); }}
                title="GIFs"
            >
                <i className="bi bi-filetype-gif fs-5"></i>
            </button>
            
            <input
                type="text"
                className="form-control-rave"
                placeholder="Envoyer un message..."
                value={text}
                onChange={handleTyping}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                onFocus={() => { setShowEmojiPicker(false); setShowGifPicker(false); }}
            />
            
            <button 
                className="btn-send-rave"
                onClick={sendMessage}
                disabled={!text.trim()}
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
            </button>
        </div>
      </div>
    </>
  );
}