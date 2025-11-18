"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import EmojiPicker from "emoji-picker-react";
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
      <div className="chat-header-gradient d-flex justify-content-between align-items-center shadow-sm">
        <div className="d-flex align-items-center gap-2">
          <div className="bg-white bg-opacity-25 rounded-circle p-2 d-flex justify-content-center align-items-center" style={{width: '40px', height: '40px'}}>
             <i className="bi bi-chat-fill text-white fs-5"></i>
          </div>
          <div>
            <h6 className="m-0 fw-bold">Chat Mauve</h6>
            <small className="text-white-50" style={{ fontSize: '0.8rem' }}>
              {currentUsername ? `En ligne: ${currentUsername}` : 'Connexion...'}
            </small>
          </div>
        </div>
        <button onClick={onClose} className="btn btn-sm text-white opacity-75">
          <i className="bi bi-x-lg fs-5"></i>
        </button>
      </div>

      <div className="flex-grow-1 bg-white overflow-auto p-3 d-flex flex-column gap-2" ref={listRef}>
        {messages.length === 0 && (
          <div className="h-100 d-flex flex-column justify-content-center align-items-center text-muted opacity-50">
            <i className="bi bi-chat-heart fs-1 mb-2"></i>
            <p>Dites bonjour !</p>
          </div>
        )}

        {messages.map((m, i) => {
          const isMe = currentUsername && m.username === currentUsername;
          return (
            <div key={i} className={`d-flex flex-column w-100 ${isMe ? "align-items-end" : "align-items-start"}`}>
              {!isMe && <small className="text-secondary ms-2 mb-1" style={{fontSize: '0.75rem'}}>{m.username}</small>}
              <div className={`message-bubble shadow-sm ${isMe ? "message-me" : "message-other"}`}>
                {m.message && <span>{m.message}</span>}
                {m.gifUrl && (
                    <div className="rounded overflow-hidden">
                        <img src={m.gifUrl} alt="GIF" className="img-fluid" style={{maxHeight: '150px'}} />
                    </div>
                )}
              </div>
            </div>
          );
        })}

        {typingUsers.length > 0 && (
          <div className="ms-2 mb-2 text-muted fst-italic small typing-indicator">
            {typingUsers.length > 2 ? "Plusieurs personnes écrivent" : typingUsers.join(", ") + " écrit"}
            <span></span><span></span><span></span>
          </div>
        )}
      </div>

      <div className="position-relative">
        {/* --- ZONES DE SELECTION (GIF / EMOJI) --- */}
        {(showEmojiPicker || showGifPicker) && (
            <div className="picker-overlay shadow-sm" style={{ height: '380px' }}>
                
                {/* En-tête du picker */}
                <div className="d-flex justify-content-between align-items-center px-3 py-2 bg-light border-bottom">
                    <span className="fw-bold text-primary small text-uppercase ls-1">
                        {showEmojiPicker ? "😄 Émojis" : "🎬 GIFs Giphy"}
                    </span>
                    <button 
                        className="btn-close small" 
                        onClick={() => { setShowEmojiPicker(false); setShowGifPicker(false); }}
                    ></button>
                </div>
                
                {/* Contenu Emoji */}
                {showEmojiPicker && (
                    <div className="h-100 w-100">
                        <EmojiPicker 
                            onEmojiClick={(e) => setText((prev) => prev + e.emoji)} 
                            width="100%" 
                            height="100%"
                            searchDisabled={false}
                            previewConfig={{ showPreview: false }}
                        />
                    </div>
                )}
                
                {/* Contenu GIF (Nouveau Design) */}
                {showGifPicker && (
                    <div className="h-100 d-flex flex-column bg-white">
                        <div className="p-2 bg-light border-bottom">
                             <div className="input-group input-group-sm">
                                <span className="input-group-text bg-white border-end-0 text-muted">
                                    <i className="bi bi-search"></i>
                                </span>
                                <input 
                                    type="text" 
                                    className="form-control border-start-0 ps-0" 
                                    placeholder="Rechercher un GIF..." 
                                    value={gifSearch}
                                    onChange={(e) => setGifSearch(e.target.value)}
                                />
                             </div>
                        </div>
                        
                        {/* Grille centrée et contenue */}
                        <div className="flex-grow-1 overflow-auto p-2 d-flex justify-content-center bg-white">
                            <div style={{ width: '340px' }}> {/* Conteneur fixe pour la grille */}
                                <Grid 
                                    fetchGifs={fetchGifs} 
                                    width={340} 
                                    columns={3} 
                                    gutter={8}
                                    noLink={true}
                                    key={gifSearch}
                                    onGifClick={(gif, e) => {
                                        e.preventDefault();
                                        sendGif(gif.images.original.url);
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )}

        {/* Zone de saisie */}
        <div className="p-3 bg-white border-top">
            <div className="input-group bg-light border rounded-pill shadow-sm overflow-hidden">
                <button 
                    className={`btn border-0 px-3 ${showEmojiPicker ? 'text-primary bg-white shadow-sm' : 'text-secondary'}`}
                    onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowGifPicker(false); }}
                    title="Emojis"
                >
                    <i className="bi bi-emoji-smile fs-5"></i>
                </button>
                <button 
                    className={`btn border-0 px-3 ${showGifPicker ? 'text-primary bg-white shadow-sm' : 'text-secondary'}`}
                    onClick={() => { setShowGifPicker(!showGifPicker); setShowEmojiPicker(false); }}
                    title="GIFs"
                >
                    <i className="bi bi-filetype-gif fs-5"></i>
                </button>
                
                <input
                    type="text"
                    className="form-control border-0 bg-transparent shadow-none"
                    placeholder="Votre message..."
                    value={text}
                    onChange={handleTyping}
                    onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                    onFocus={() => { setShowEmojiPicker(false); setShowGifPicker(false); }}
                />
                
                <button 
                    className="btn border-0 px-3 text-primary hover-scale"
                    onClick={sendMessage}
                    disabled={!text.trim()}
                >
                    <i className="bi bi-send-fill fs-5"></i>
                </button>
            </div>
        </div>
      </div>
    </>
  );
}