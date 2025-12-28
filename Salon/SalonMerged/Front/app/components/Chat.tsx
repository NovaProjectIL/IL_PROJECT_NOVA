"use client";

import { useEffect, useRef, useState } from "react";
import EmojiPicker, { Theme } from "emoji-picker-react";
import { GiphyFetch } from "@giphy/js-fetch-api";
import { Grid } from "@giphy/react-components";
import { MessageCircle, Send } from 'lucide-react';

type Message = {
  username: string;
  message: string | null;
  gifUrl: string | null;
  createdAt: string;
};

type ChatProps = {
  onClose: () => void;
  pseudo: string;
  userId?: number;
  onMessageReceived?: () => void;
  socket: any;
  roomCode: string;
};

const giphyApiKey = "TVQlPggmgsUzg4lyGiR2btZLfpyfw6Z1";
const gf = new GiphyFetch(giphyApiKey);

function Chat({ onClose, pseudo: initialPseudo, userId, onMessageReceived, socket, roomCode }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [pickerMode, setPickerMode] = useState<'none' | 'emoji' | 'gif'>('none');
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [gifSearch, setGifSearch] = useState("");
  const [pseudo, setPseudo] = useState(initialPseudo || "");

  const listRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // --- CONNEXION ---
  useEffect(() => {
    if (!socket) return;

    const identifyAndLoad = () => {
        console.log(`🔄 [Chat] Init pour room: ${roomCode}, socket connected: ${socket.connected}`);
        socket.emit('setUsername', { username: pseudo, userId: userId || 0 });

        if (roomCode) {
            // Rejoindre la room chat pour recevoir les messages en temps réel
            socket.emit('joinChatRoom', { codeRoom: roomCode });
            socket.emit('requestMessages', { codeRoom: roomCode });
        }
    };

    // Émettre immédiatement si déjà connecté, sinon attendre la connexion
    if (socket.connected) {
      identifyAndLoad();
    } else {
      // Écouter les événements de connexion
      socket.on('connect', identifyAndLoad);
    }

    // Ré-identifier en cas de reconnexion
    socket.on('reconnect', identifyAndLoad);

    const handleReceiveMessage = (msg: Message) => {
      console.log('📨 Message reçu:', msg);
      setMessages((prev) => [...prev, msg]);
      setTypingUsers((prev) => prev.filter((name) => name !== msg.username));
      if (onMessageReceived) onMessageReceived();
      scrollToBottom();
    };

    const handleLoadMessages = (histMessages: any[]) => {
        console.log('📚 Messages chargés:', histMessages.length);
        const formatted = histMessages.map(m => ({
            username: m.username,
            message: m.message,
            gifUrl: m.gifUrl,
            createdAt: m.createdAt
        }));
        setMessages(formatted);
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

    socket.on("receiveMessage", handleReceiveMessage);
    socket.on("loadMessages", handleLoadMessages);
    socket.on("userTyping", handleUserTyping);

    return () => {
      socket.off("connect", identifyAndLoad);
      socket.off("receiveMessage", handleReceiveMessage);
      socket.off("loadMessages", handleLoadMessages);
      socket.off("userTyping", handleUserTyping);
    };
  }, [socket, roomCode, pseudo, userId, socket?.connected]);

  const scrollToBottom = () => {
    setTimeout(() => {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    }, 100);
  };

  // --- ACTIONS ---

  const sendMessage = () => {
    if (!text.trim()) return;

    // SÉCURITÉ : On vérifie qu'on a bien le code
    if (!roomCode) {
        console.error("❌ Erreur : roomCode manquant !");
        return;
    }

    socket?.emit("sendMessage", {
        codeRoom: roomCode,
        message: text.trim(),
        userId: userId,
        username: pseudo
    });

    socket?.emit("typing", { codeRoom: roomCode, isTyping: false });
    setText("");
    setPickerMode('none');
  };

  const sendGif = (gifUrl: string) => {
    if (!roomCode) return;
    socket?.emit("sendMessage", {
        codeRoom: roomCode,
        gifUrl: gifUrl,
        userId: userId,
        username: pseudo
    });
    setPickerMode('none');
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
    if (roomCode) {
        socket?.emit("typing", { codeRoom: roomCode, isTyping: true });
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          socket?.emit("typing", { codeRoom: roomCode, isTyping: false });
        }, 2000);
    }
  };

  // --- RENDU ---
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
      <div className="chat-header-rave">
        <h4 className="m-0 fw-bold text-white" style={{ letterSpacing: '1px', fontSize: '1.2rem' }}>
          CHAT ROOM
        </h4>
        <button onClick={onClose} className="btn-icon-rave" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>

      <div className="chat-body-rave" ref={listRef}>
        {messages.length === 0 && (
          <div className="h-100 d-flex flex-column justify-content-center align-items-center text-white-50 opacity-50">
            <div style={{ marginBottom: '1rem' }}>
              <MessageCircle size={48} strokeWidth={1.5} />
            </div>
            <p className="fw-light ls-1 text-uppercase small">La conversation commence ici</p>
          </div>
        )}
        {messages.map((m, i) => {
          const isMe = m.username === pseudo;
          return (
            <div key={i} className={`chat-message-row ${isMe ? "me" : "other"}`}>
              {!isMe && <span className="username-label">{m.username}</span>}
              {m.message && <div className={`message-bubble ${isMe ? "message-me" : "message-other"}`}>{m.message}</div>}
              {m.gifUrl && <div className={`mt-2 ${isMe ? 'text-end' : 'text-start'}`}><img src={m.gifUrl} alt="GIF" className="gif-image" style={{maxHeight: '150px', maxWidth: '100%'}} /></div>}
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

      <div className="chat-input-rave position-relative">
        {pickerMode !== 'none' && (
            <div className="picker-overlay">
                <div className="picker-tabs">
                    <button className={`picker-tab ${pickerMode === 'emoji' ? 'active' : ''}`} onClick={() => setPickerMode('emoji')}>Emojis</button>
                    <button className={`picker-tab ${pickerMode === 'gif' ? 'active' : ''}`} onClick={() => setPickerMode('gif')}>GIFs</button>
                    <button className="btn-close-custom" onClick={() => setPickerMode('none')}>X</button>
                </div>
                <div className="flex-grow-1 position-relative overflow-hidden h-100">
                  {pickerMode === 'emoji' && <EmojiPicker onEmojiClick={(e) => setText((prev) => prev + e.emoji)} width="100%" height="100%" theme={Theme.DARK} previewConfig={{ showPreview: false }} style={{background: 'transparent', border: 'none'}} />}
                  {pickerMode === 'gif' && <div className="h-100 d-flex flex-column"><div className="px-3 pb-2"><input type="text" className="form-control bg-dark text-white border-secondary form-control-sm rounded-pill" placeholder="Rechercher un GIF..." value={gifSearch} onChange={(e) => setGifSearch(e.target.value)} autoFocus /></div><div className="flex-grow-1 overflow-auto px-2 pb-2 d-flex justify-content-center"><Grid fetchGifs={fetchGifs} width={340} columns={3} gutter={6} noLink={true} key={gifSearch} onGifClick={(gif, e) => { e.preventDefault(); sendGif(gif.images.original.url); }} /></div></div>}
                </div>
            </div>
        )}
        <div className="input-group-rave">
            <button className={`btn-icon-rave ${pickerMode !== 'none' ? 'text-white' : ''}`} onClick={() => setPickerMode(pickerMode === 'none' ? 'emoji' : 'none')}>+</button>
            <input type="text" className="form-control-rave" placeholder="Envoyer un message..." value={text} onChange={handleTyping} onKeyDown={(e) => e.key === "Enter" && sendMessage()} onFocus={() => setPickerMode('none')} />
            <button className="btn-send-rave" onClick={sendMessage} disabled={!text.trim()}>
              <Send size={20} />
            </button>
        </div>
      </div>
    </>
  );
}

export default Chat;
