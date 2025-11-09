"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

// ... (tous vos imports et types restent les mêmes) ...
type Message = {
  username: string;
  message: string | null;
  gifUrl: string | null;
  createdAt: string;
};

type ChatProps = {
  onClose: () => void;
  pseudo: string; // Le pseudo choisi dans le Widget
};

// ... (toutes vos constantes d'emoji et GIPHY restent les mêmes) ...
const emojiCategories = {
// ... (contenu des emojis inchangé) ...
  "Smileys & Émotions": [ '😊', '😂', '❤️', '👍', '🙏', '😢', '🎉', '🤔', '🔥', '👏', '😮', '😍', '😄', '😁', '😆', '😅', '🤣', '😇', '😉', '😌', '😘', '🥰', '😗', '😙', '😚', '😋', '😛', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '😣', '😖', '😫', '😩', '🥺', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠' ],
  "Objets & Nourriture": [ '🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒', '🍑', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶', '🌽', '🥕', '🧄', '🧅', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟', '🍕', '🥪', '🥙', '🧆', '🌮', '🌯', '🥗', '🥘', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🍯', '🥛', '🍼', '☕️', '🍵', '🧃', '🥤', '🍶', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🧉', '🍾', '🧊', '🥄', '🍴', '🍽', '🥣', '🥡', '🥢', '🧂' ],
  "Animaux": [ '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛' ],
};
const giphyApiKey = "TVQlPggmgsUzg4lyGiR2btZLfpyfw6Z1"; 
type GiphyGif = {
  id: string;
  title: string;
  images: {
    fixed_width: { url: string; }
  }
};
// ------------------------------------------------

export default function Chat({ onClose, pseudo }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifSearch, setGifSearch] = useState("");
  const [gifResults, setGifResults] = useState<GiphyGif[]>([]);
  const [isGiphyLoading, setIsGiphyLoading] = useState(false);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [showExtraButtons, setShowExtraButtons] = useState(false);

  // --- NOUVEAU : États pour l'indicateur de frappe ---
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingSentRef = useRef(false); // Pour éviter d'envoyer 'typing' à chaque frappe
  // -------------------------------------------------

  const socketRef = useRef<Socket | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const s = io("http://localhost:3001", { transports: ["websocket"] });
    socketRef.current = s;
    
    s.on("connect", () => {
      console.log("[Socket] connected:", s.id);
      s.emit("setUser", { username: pseudo });
    });

    const handleIdentity = (name: string) => {
      console.log(`[Socket] Mon nom est: ${name}`);
      setCurrentUsername(name);
    };
    
    s.on('identity', handleIdentity);
    s.on('userSet', (data: { username: string }) => {
      handleIdentity(data.username);
    });

    s.on("loadMessages", (msgs: Message[]) => {
      setMessages(msgs);
      scrollToBottom();
    });
    s.on("receiveMessage", (msg: Message) => {
      setMessages((prev) => [...prev, msg]);
      // --- AJOUT : Si un message arrive, la personne ne tape plus ---
      setTypingUsers(prev => prev.filter(name => name !== msg.username));
      // ---------------------------------------------------------
      scrollToBottom();
    });

    // --- NOUVEAU : Listener pour 'userTyping' ---
    s.on('userTyping', (data: { username: string, isTyping: boolean }) => {
      if (data.isTyping) {
        // Ajoute l'utilisateur à la liste (sans doublons)
        setTypingUsers(prev => [...new Set([...prev, data.username])]);
      } else {
        // Retire l'utilisateur de la liste
        setTypingUsers(prev => prev.filter(name => name !== data.username));
      }
    });
    // -----------------------------------------

    scrollToBottom();
    return () => {
      // --- AJOUT : Nettoyage du listener ---
      s.off('userTyping');
      // -----------------------------------
      s.disconnect();
    };
  }, [pseudo]); 

  // ... (les useEffect pour GIPHY restent inchangés) ...
  useEffect(() => {
    if (showGifPicker && gifSearch.trim() === '' && gifResults.length === 0) {
      setIsGiphyLoading(true);
      fetch(`https://api.giphy.com/v1/gifs/trending?api_key=${giphyApiKey}&limit=30&rating=g`)
        .then(res => res.json())
        .then(data => { setGifResults(data.data); setIsGiphyLoading(false); })
        .catch(err => { console.error("Erreur fetch GIPHY (Trending):", err); setIsGiphyLoading(false); });
    }
  }, [showGifPicker, gifSearch]);
  useEffect(() => {
    if (gifSearch.trim() === '') {
      setGifResults([]);
      return;
    }
    const handler = setTimeout(() => {
      setIsGiphyLoading(true);
      const url = `https://api.giphy.com/v1/gifs/search?api_key=${giphyApiKey}&q=${encodeURIComponent(gifSearch)}&limit=30&rating=g`;
      fetch(url)
        .then(res => res.json())
        .then(data => { setGifResults(data.data); setIsGiphyLoading(false); })
        .catch(err => { console.error("Erreur fetch GIPHY (Search):", err); setIsGiphyLoading(false); });
    }, 500); 
    return () => clearTimeout(handler);
  }, [gifSearch]);
  
  const scrollToBottom = () => {
    setTimeout(() => {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    }, 50);
  };

  // --- MODIFIÉ : 'sendMessage' envoie 'typing(false)' ---
  const sendMessage = () => {
    const messageContent = text.trim();
    if (!messageContent) {
      setText(""); 
      return;
    }
    socketRef.current?.emit("sendMessage", { message: messageContent });
    
    // --- AJOUT : Arrêter l'indicateur de frappe ---
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (typingSentRef.current) {
      socketRef.current?.emit('typing', false);
      typingSentRef.current = false;
    }
    // ------------------------------------------

    setText("");
    setShowEmojiPicker(false);
    setShowGifPicker(false); 
  };
  
  const sendGif = (gifUrl: string) => {
    socketRef.current?.emit("sendMessage", { gifUrl: gifUrl });
    setShowEmojiPicker(false);
    setShowGifPicker(false);
    setShowExtraButtons(false); 
  };

  const onEmojiClick = (emoji: string) => {
    setText((prevText) => prevText + emoji);
  };
  
  // --- NOUVEAU : Logique de "debouncing" pour la frappe ---
  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newText = e.target.value;
    setText(newText);
    
    // 1. Envoyer "typing: true" si ce n'est pas déjà fait
    if (socketRef.current && !typingSentRef.current) {
      socketRef.current.emit('typing', true);
      typingSentRef.current = true;
    }
    
    // 2. Nettoyer l'ancien timer "stop typing"
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // 3. Créer un nouveau timer pour envoyer "typing: false" après 2s d'inactivité
    typingTimeoutRef.current = setTimeout(() => {
      if (socketRef.current) {
        socketRef.current.emit('typing', false);
        typingSentRef.current = false; // Prêt à renvoyer "true" à la prochaine frappe
      }
    }, 2000); // 2 secondes
  };
  // ----------------------------------------------------

  return (
    <div className="chat-container-inner">
      <div className="chat-header">
        <h3>Connecté: <b>{currentUsername || '...'}</b></h3>
        <button onClick={onClose} className="chat-close-btn">
          &times;
        </button>
      </div>

      {/* Zone des messages (inchangée) */}
      <div className="messages" ref={listRef}>
        {messages.length === 0 ? (
          <div className="no-messages">Aucun message</div>
        ) : (
          messages.map((m, i) => {
            const isMe = currentUsername && m.username === currentUsername;
            return (
              <div 
                key={`${m.createdAt}-${i}`} 
                className={`message-item ${isMe ? 'me' : 'other'}`}
              >
                {!isMe && <b className="message-username">{m.username}</b>}
                <div className="message-bubble">
                  {m.message && <div>{m.message}</div>}
                  {m.gifUrl && (
                    <img src={m.gifUrl} alt="gif" className="chat-gif" />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
      {/* --- FIN ZONE DES MESSAGES --- */}

      {/* --- NOUVEAU : Indicateur de Frappe --- */}
      <div className="typing-indicator-container">
        {typingUsers.length > 0 && (
          <div className="typing-indicator">
            {/* Limite à 2 noms pour ne pas surcharger */}
            {typingUsers.slice(0, 2).join(', ')} 
            {typingUsers.length > 2 ? ' et d\'autres...' : ''}
            {typingUsers.length === 1 ? ' est' : ' sont'} en train d'écrire
            <span className="dot-flashing"></span>
          </div>
        )}
      </div>
      {/* ----------------------------------------------- */}

      {/* Zone des pickers (inchangée) */}
      <div className="picker-container">
        {showEmojiPicker && (
          <div className="emoji-picker-scroll">
            {Object.entries(emojiCategories).map(([category, emojis]) => (
              <div key={category} className="emoji-category">
                <h4>{category}</h4>
                <div className="emoji-grid">
                  {emojis.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => onEmojiClick(emoji)}
                      title={emoji}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {showGifPicker && (
          <div className="gif-picker">
            <input
              type="text"
              className="gif-search-bar"
              placeholder="Rechercher sur GIPHY..."
              value={gifSearch}
              onChange={(e) => setGifSearch(e.target.value)}
            />
            <div className="gif-grid-scroll">
              {isGiphyLoading && <div className="no-messages">Chargement...</div>}
              {!isGiphyLoading && gifResults.length === 0 && (
                <div className="no-messages">Aucun GIF trouvé.</div>
              )}
              <div className="gif-grid">
                {!isGiphyLoading && gifResults.map((gif) => (
                  <button
                    key={gif.id}
                    className="gif-item"
                    onClick={() => sendGif(gif.images.fixed_width.url)}
                  >
                    <img src={gif.images.fixed_width.url} alt={gif.title} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* --- MODIFIÉ : Zone de saisie --- */}
      <div className="chat-input-area">
        {showExtraButtons && (
          <div className="chat-extra-buttons">
            <button
              className="chat-icon-btn"
              onClick={() => {
                setShowEmojiPicker(true);
                setShowGifPicker(false);
                setShowExtraButtons(false);
              }}
              title="Emojis"
            >
              😊
            </button>
            <button
              className="chat-icon-btn"
              onClick={() => {
                setShowGifPicker(true);
                setShowEmojiPicker(false);
                setShowExtraButtons(false);
              }}
              title="GIFs"
            >
              🖼️
            </button>
          </div>
        )}

        <button
          className="chat-icon-btn chat-plus-btn"
          onClick={() => {
            setShowExtraButtons(!showExtraButtons);
            setShowEmojiPicker(false);
            setShowGifPicker(false);
          }}
          title="Options"
        >
          {showExtraButtons ? '✕' : '＋'}
        </button>

        <input
          value={text}
          // --- MODIFICATION : 'onChange' appelle 'handleTyping' ---
          onChange={handleTyping}
          // ----------------------------------------------------
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Écris ton message..."
          onFocus={() => {
            setShowEmojiPicker(false);
            setShowGifPicker(false);
            setShowExtraButtons(false);
          }}
        />
        
        <button 
          onClick={sendMessage} 
          className="chat-send-btn" 
          title="Envoyer"
          disabled={text.trim().length === 0}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </div>
    </div>
  );
}