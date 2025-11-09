"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

// Le type Message est correct pour le backend
type Message = {
  username: string;
  message: string | null;
  gifUrl: string | null;
  createdAt: string;
};

type ChatProps = {
  onClose: () => void;
};

// --- BASE DE DONNÉES LOCALE D'EMOJIS (Version complète) ---
const emojiCategories = {
  "Smileys & Émotions": [ '😊', '😂', '❤️', '👍', '🙏', '😢', '🎉', '🤔', '🔥', '👏', '😮', '😍', '😄', '😁', '😆', '😅', '🤣', '😇', '😉', '😌', '😘', '🥰', '😗', '😙', '😚', '😋', '😛', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '😣', '😖', '😫', '😩', '🥺', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠' ],
  "Objets & Nourriture": [ '🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒', '🍑', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶', '🌽', '🥕', '🧄', '🧅', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟', '🍕', '🥪', '🥙', '🧆', '🌮', '🌯', '🥗', '🥘', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🍯', '🥛', '🍼', '☕️', '🍵', '🧃', '🥤', '🍶', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🧉', '🍾', '🧊', '🥄', '🍴', '🍽', '🥣', '🥡', '🥢', '🧂' ],
  "Animaux": [ '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛' ],
};
// -----------------------------------------------------------------

// --- BASE DE DONNÉES LOCALE DE GIFs (avec recherche) ---
const preselectedGifs = [
  { name: 'OK', url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3Y1bW10d2tqYjBpd3E2bDRqcG04Mmt0dG0yM2lqZzNqdTJ6MmVhZyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/10kAB0nIqV1sMU/giphy.gif' },
  { name: 'Merci Thank You', url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcmVlYzhka3VkcDR0bmdqOHRtcjN4cHlxNmY5a2U1OW1kMmVvYmNnYSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3oEdva9BUHPIs2SkGk/giphy.gif' },
  { name: 'LOL Haha', url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHQzbWFzMGR4bWZxOWw0aWNmYmI0bWw2eHFzY2Q0bXV1cGJ2eWJpcyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/l36kU80xPf0ojG0Erg/giphy.gif' },
  { name: 'Oui Yes', url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExenFkMXhpY3I0NWNpZ21lbnV4enN0N2ppc3M2bGlkNW9xNWx4N2llaiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o7abGQa0aRBUHgqDC/giphy.gif' },
  { name: 'Clap Applaudir', url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExZDZvMDcycTYyNmJkcnRjeDFoOWM1am02bWgzbTNxZWNuMHY2NnZ6eCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/nbvFVPiEiJH68/giphy.gif' },
];
// -----------------------------------------------------------------


export default function Chat({ onClose }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifSearch, setGifSearch] = useState("");
  
  // --- NOUVEAU : État pour le nom d'utilisateur et le panneau d'options ---
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [showExtraButtons, setShowExtraButtons] = useState(false);
  // --------------------------------------------------

  const socketRef = useRef<Socket | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const s = io("http://localhost:3001", { transports: ["websocket"] });
    socketRef.current = s;
    
    s.on("connect", () => console.log("[Socket] connected:", s.id));

    // --- CORRECTION : Écouter l'événement 'identity' du backend ---
    s.on('identity', (name: string) => {
      console.log(`[Socket] Mon nom est: ${name}`);
      setCurrentUsername(name);
    });
    // ------------------------------------------------------

    s.on("loadMessages", (msgs: Message[]) => {
      console.log("[Socket] loadMessages:", msgs);
      setMessages(msgs);
      scrollToBottom();
    });
    s.on("receiveMessage", (msg: Message) => {
      console.log("[Socket] receiveMessage:", msg);
      setMessages((prev) => [...prev, msg]);
      scrollToBottom();
    });
    scrollToBottom();
    return () => {
      s.disconnect();
    };
  }, []);

  const scrollToBottom = () => {
    setTimeout(() => {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    }, 50);
  };

  // Fonction d'envoi de TEXTE
  const sendMessage = () => {
    const messageContent = text.trim();
    if (!messageContent) {
      setText(""); 
      return;
    }
    socketRef.current?.emit("sendMessage", { message: messageContent });
    setText("");
    setShowEmojiPicker(false);
    setShowGifPicker(false); 
  };
  
  // Fonction d'envoi de GIF
  const sendGif = (gifUrl: string) => {
    socketRef.current?.emit("sendMessage", { gifUrl: gifUrl });
    setShowEmojiPicker(false);
    setShowGifPicker(false);
    setShowExtraButtons(false); // Ferme aussi le panneau d'options
  };
  // ------------------------------------

  // Fonction pour ajouter un emoji au texte
  const onEmojiClick = (emoji: string) => {
    setText((prevText) => prevText + emoji);
  };
  
  // Logique de filtrage des GIFs
  const filteredGifs = preselectedGifs.filter(gif => 
    gif.name.toLowerCase().includes(gifSearch.toLowerCase())
  );
  // ----------------------------------------

  return (
    <div className="chat-container-inner">
      <div className="chat-header">
        <h3>Support en ligne</h3>
        <button onClick={onClose} className="chat-close-btn">
          &times;
        </button>
      </div>

      {/* --- ZONE DES MESSAGES (Avec logique .me / .other) --- */}
      <div className="messages" ref={listRef}>
        {messages.length === 0 ? (
          <div className="no-messages">Aucun message</div>
        ) : (
          messages.map((m, i) => {
            // CORRECTION : On vérifie si le message vient de "moi"
            const isMe = currentUsername && m.username === currentUsername;
            
            return (
              <div 
                key={`${m.createdAt}-${i}`} // Clé unique
                className={`message-item ${isMe ? 'me' : 'other'}`}
              >
                {/* On n'affiche le nom que si ce n'est pas "moi" */}
                {!isMe && <b className="message-username">{m.username}</b>}
                
                <div className="message-bubble">
                  {m.message && <div>{m.message}</div>}
                  {m.gifUrl && (
                    <img
                      src={m.gifUrl}
                      alt="gif"
                      className="chat-gif"
                    />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
      {/* --- FIN ZONE DES MESSAGES --- */}

      {/* --- ZONE DES PICKERS (Emojis + GIFs) --- */}
      <div className="picker-container">
        {/* Sélecteur d'Emojis (version complète) */}
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

        {/* Sélecteur de GIFs (avec recherche) */}
        {showGifPicker && (
          <div className="gif-picker">
            <input
              type="text"
              className="gif-search-bar"
              placeholder="Rechercher parmi les GIFs populaires..."
              value={gifSearch}
              onChange={(e) => setGifSearch(e.target.value)}
            />
            <div className="gif-grid-scroll">
              <div className="gif-grid">
                {filteredGifs.length > 0 ? (
                  filteredGifs.map((gif) => (
                    <button
                      key={gif.url}
                      className="gif-item"
                      onClick={() => sendGif(gif.url)}
                    >
                      <img src={gif.url} alt={gif.name} />
                    </button>
                  ))
                ) : (
                  <div className="no-messages">Aucun GIF trouvé.</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      {/* --- FIN ZONE PICKERS --- */}

      {/* --- NOUVELLE ZONE DE SAISIE (Moderne) --- */}
      <div className="chat-input-area">
        
        {/* Panneau d'options qui s'ouvre avec le [+] */}
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

        {/* Bouton [+] pour ouvrir les options */}
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
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Écris ton message..."
          // Ferme les pickers quand on clique sur l'input
          onFocus={() => {
            setShowEmojiPicker(false);
            setShowGifPicker(false);
            setShowExtraButtons(false);
          }}
        />
        
        {/* Le bouton Envoyer n'apparaît que si on a écrit du texte */}
        {text.trim().length > 0 ? (
          <button onClick={sendMessage} className="chat-send-btn" title="Envoyer">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          </button>
        ) : (
          // Bouton "Pouce" par défaut (ou un autre)
          <button onClick={() => onEmojiClick('👍')} className="chat-icon-btn chat-like-btn" title="Envoyer un 'J'aime'">
            👍
          </button>
        )}
      </div>
    </div>
  );
}