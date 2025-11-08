// Dans un nouveau fichier, ex: components/ChatWidget.tsx
"use client";

import { useState } from "react";
import Chat from "./Chat"; // Assure-toi que le chemin est correct
import "../app/globals.css"; // On va créer ce fichier CSS juste après

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);

  // Si le chat est fermé, on affiche juste la "bulle"
  if (!isOpen) {
    return (
      <button
        className="chat-toggle-button"
        onClick={() => setIsOpen(true)}
      >
        💬 Des questions ?
      </button>
    );
  }

  // Si le chat est ouvert, on affiche la fenêtre complète
  return (
    <div className="chat-window-container">
      {/* On passe la fonction "setIsOpen" à ton composant Chat
        pour qu'il puisse se fermer de l'intérieur.
      */}
      <Chat onClose={() => setIsOpen(false)} />
    </div>
  );
}