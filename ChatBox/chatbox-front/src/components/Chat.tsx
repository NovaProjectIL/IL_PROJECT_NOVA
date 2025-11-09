"use client";

import { useEffect, useRef, useState } from "react"; // Retrait de useContext
import { io, Socket } from "socket.io-client";

// --- RETRAIT DES IMPORTS (pour corriger les erreurs) ---
// import EmojiPicker, { EmojiClickData } from "emoji-picker-react";
// import { GiphyFetch } from "@giphy/js-fetch-api";
// ... (et tous les imports de @giphy/react-components)
// --- FIN DU RETRAIT ---

// Le type Message est correct
type Message = {
  username: string;
  message: string | null;
  gifUrl: string | null;
  createdAt: string;
};

type ChatProps = {
  onClose: () => void;
};

// --- RÉINTRODUCTION DE LA BASE DE DONNÉES LOCALE D'EMOJIS ---
const emojiCategories = {
  "Smileys & Émotions": [ '😊', '😂', '❤️', '👍', '🙏', '😢', '🎉', '🤔', '🔥', '👏', '😮', '😍', '😄', '😁', '😆', '😅', '🤣', '😇', '😉', '😌', '😘', '🥰', '😗', '😙', '😚', '😋', '😛', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '😣', '😖', '😫', '😩', '🥺', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠' ],
  "Objets & Nourriture": [ '🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒', '🍑', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶', '🌽', '🥕', '🧄', '🧅', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟', '🍕', '🥪', '🥙', '🧆', '🌮', '🌯', '🥗', '🥘', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🍯', '🥛', '🍼', '☕️', '🍵', '🧃', '🥤', '🍶', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🧉', '🍾', '🧊', '🥄', '🍴', '🍽', '🥣', '🥡', '🥢', '🧂' ],
  "Animaux": [ '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛' ],
};
// -----------------------------------------------------------------

// --- CONFIGURATION GIPHY (avec votre clé) ---
const giphyApiKey = "TVQlPggmgsUzg4lyGiR2btZLfpyfw6Z1"; 
// -------------------------

// --- NOUVEAU : Type pour les résultats de GIPHY ---
type GiphyGif = {
  id: string;
  title: string;
  images: {
    fixed_width: { // On utilise une taille fixe pour la grille
      url: string;
    }
  }
};
// ------------------------------------------------

export default function Chat({ onClose }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  
  // --- MODIFIÉ : États pour le GIPHY fetch ---
  const [gifSearch, setGifSearch] = useState("");
  const [gifResults, setGifResults] = useState<GiphyGif[]>([]);
  const [isGiphyLoading, setIsGiphyLoading] = useState(false);
  // ----------------------------------------
  
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [showExtraButtons, setShowExtraButtons] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const s = io("http://localhost:3001", { transports: ["websocket"] });
    socketRef.current = s;
    
    s.on("connect", () => console.log("[Socket] connected:", s.id));

    // Écoute l'événement 'identity' du backend (pour les bulles bleues/grises)
    s.on('identity', (name: string) => {
      console.log(`[Socket] Mon nom est: ${name}`);
      setCurrentUsername(name);
    });

    s.on("loadMessages", (msgs: Message[]) => {
      setMessages(msgs);
      scrollToBottom();
    });
    s.on("receiveMessage", (msg: Message) => {
      setMessages((prev) => [...prev, msg]);
      scrollToBottom();
    });
    scrollToBottom();
    return () => {
      s.disconnect();
    };
  }, []);

  // --- NOUVEAU : Hook pour fetch les GIFs (Trending) ---
  useEffect(() => {
    // S'active seulement si le picker est ouvert ET qu'il n'y a pas de recherche
    if (showGifPicker && gifSearch.trim() === '' && gifResults.length === 0) {
      setIsGiphyLoading(true);
      fetch(`https://api.giphy.com/v1/gifs/trending?api_key=${giphyApiKey}&limit=30&rating=g`)
        .then(res => res.json())
        .then(data => {
          setGifResults(data.data);
          setIsGiphyLoading(false);
        })
        .catch(err => {
          console.error("Erreur fetch GIPHY (Trending):", err);
          setIsGiphyLoading(false);
        });
    }
  }, [showGifPicker, gifSearch]); // Déclenché à l'ouverture du picker

  // --- NOUVEAU : Hook pour fetch les GIFs (Recherche) ---
  useEffect(() => {
    // Ne pas chercher si le champ est vide
    if (gifSearch.trim() === '') {
      // Si on efface la recherche, on pourrait re-afficher les trending
      setGifResults([]); // Ou `fetchTrending()`
      return;
    }

    // "Debounce" : attend 500ms après la fin de la frappe
    const handler = setTimeout(() => {
      setIsGiphyLoading(true);
      const url = `https://api.giphy.com/v1/gifs/search?api_key=${giphyApiKey}&q=${encodeURIComponent(gifSearch)}&limit=30&rating=g`;
      
      fetch(url)
        .then(res => res.json())
        .then(data => {
          setGifResults(data.data);
          setIsGiphyLoading(false);
        })
        .catch(err => {
          console.error("Erreur fetch GIPHY (Search):", err);
          setIsGiphyLoading(false);
        });
    }, 500); // Délai de 500ms

    // Nettoyage du timer si l'utilisateur re-tape
    return () => clearTimeout(handler);
    
  }, [gifSearch]); // Déclenché à chaque frappe dans le champ de recherche
  
  // ----------------------------------------------------
  
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
    setShowExtraButtons(false); 
  };

  // --- MODIFIÉ : Fonction pour le clic Emoji (version locale) ---
  const onEmojiClick = (emoji: string) => {
    setText((prevText) => prevText + emoji);
  };
  
  // --- RETRAIT : Composant interne GiphyGrid ---
  // (n'est plus nécessaire, on fait le map directement)

  return (
    <div className="chat-container-inner">
      <div className="chat-header">
        <h3>Support en ligne</h3>
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

      {/* --- MODIFIÉ : ZONE DES PICKERS (avec listes locales) --- */}
      <div className="picker-container">
        {/* Sélecteur d'Emojis (version locale) */}
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

        {/* Sélecteur de GIFs (version fetch API) */}
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
      {/* --- FIN ZONE PICKERS --- */}

      {/* Zone de saisie (inchangée) */}
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
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Écris ton message..."
          onFocus={() => {
            setShowEmojiPicker(false);
            setShowGifPicker(false);
            setShowExtraButtons(false);
          }}
        />
        
        {/* Le bouton Envoyer (avion) est TOUJOURS visible */}
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