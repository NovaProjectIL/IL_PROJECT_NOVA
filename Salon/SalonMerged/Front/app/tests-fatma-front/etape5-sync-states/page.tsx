"use client";

// Test Etape 5 - Etats de synchronisation UI
// Objectif : verifier que l interface reagit correctement aux etats
// BUFFERING / PLAYING / PAUSED que le serveur enverra via Socket.io

import { useState } from "react";

// Les trois etats possibles de synchronisation
// En vrai ces etats viendront des evenements Socket.io de Nadjib
type EtatSync = "IDLE" | "PLAYING" | "PAUSED" | "BUFFERING";

export default function TestSyncStates() {

  // Etat actuel de synchronisation
  // IDLE = aucun etat, etat initial avant toute action
  const [etat, setEtat] = useState<EtatSync>("IDLE");

  // Simule le nombre d utilisateurs prets (pour l etat BUFFERING)
  const [usersPrets, setUsersPrets] = useState<number>(0);
  const TOTAL_USERS = 5;

  // Logs
  const [log, setLog] = useState<string[]>([]);

  const addLog = (msg: string) => {
    setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);
  };

  // Simule la reception de l evenement Socket.io "force_seek" de Zineb
  // Quand le serveur envoie un seek tout le monde passe en BUFFERING
  const simulerBuffering = () => {
    setEtat("BUFFERING");
    setUsersPrets(0);
    addLog("Evenement force_seek recu - passage en BUFFERING");
    addLog("En attente que tous les utilisateurs soient prets...");
  };

  // Simule la reception de l evenement Socket.io "all_ready" de Zineb
  // Quand tous les users sont prets le serveur envoie all_ready
  const simulerAllReady = () => {
    setEtat("PLAYING");
    setUsersPrets(TOTAL_USERS);
    addLog("Evenement all_ready recu - tous les utilisateurs sont prets");
    addLog("Passage en PLAYING - lecture relancee");
  };

  // Simule un utilisateur supplementaire qui envoie l evenement "ready"
  const simulerUnUserPret = () => {
    const nouveauxUsersPrets = usersPrets + 1;
    setUsersPrets(nouveauxUsersPrets);
    addLog(`Utilisateur ${nouveauxUsersPrets}/${TOTAL_USERS} pret`);
    // Si tous les users sont prets on passe automatiquement en PLAYING
    if (nouveauxUsersPrets >= TOTAL_USERS) {
      setEtat("PLAYING");
      addLog("Tous les utilisateurs sont prets - passage automatique en PLAYING");
    }
  };

  // Simule la reception de l evenement Socket.io "pause"
  const simulerPause = () => {
    setEtat("PAUSED");
    addLog("Evenement pause recu - passage en PAUSED");
  };

  // Simule la reception de l evenement Socket.io "play"
  const simulerPlay = () => {
    setEtat("PLAYING");
    addLog("Evenement play recu - passage en PLAYING");
  };

  // Remet tout a zero
  const resetEtat = () => {
    setEtat("IDLE");
    setUsersPrets(0);
    addLog("Reset - retour a l etat IDLE");
  };

  // Retourne le message a afficher selon l etat
  const getMessageEtat = (): string => {
    switch (etat) {
      case "IDLE": return "En attente...";
      case "PLAYING": return "Lecture en cours";
      case "PAUSED": return "Video en pause";
      case "BUFFERING": return `En attente des autres utilisateurs... (${usersPrets}/${TOTAL_USERS} prets)`;
    }
  };

  // Retourne la couleur de fond selon l etat
  const getCouleurEtat = (): string => {
    switch (etat) {
      case "IDLE": return "#eee";
      case "PLAYING": return "#d4edda";
      case "PAUSED": return "#fff3cd";
      case "BUFFERING": return "#f8d7da";
    }
  };

  return (
    <div>
      <h2>Etape 5 - Etats de synchronisation UI</h2>
      <p>On simule les evenements Socket.io que Nadjib enverra cote client</p>

      {/* Zone d affichage de l etat actuel */}
      <div style={{ background: getCouleurEtat(), padding: "16px", marginBottom: "16px" }}>
        <p>Etat actuel : {etat}</p>
        <p>Message affiche : {getMessageEtat()}</p>
        {/* Barre de progression des users prets visible uniquement en BUFFERING */}
        {etat === "BUFFERING" && (
          <div>
            <p>Utilisateurs prets : {usersPrets} / {TOTAL_USERS}</p>
            <div style={{ width: "100%", background: "#ccc", height: "8px" }}>
              <div style={{
                width: `${(usersPrets / TOTAL_USERS) * 100}%`,
                background: "blue",
                height: "8px",
                // Transition pour que la barre se remplisse progressivement
                transition: "width 0.3s",
              }} />
            </div>
          </div>
        )}
      </div>

      {/* Boutons qui simulent les evenements Socket.io */}
      <h3>Simuler les evenements Socket.io</h3>

      {/* Simule force_seek - envoye par le serveur quand quelqu un clique sur un marqueur */}
      <button onClick={simulerBuffering} style={{ marginRight: "8px" }}>
        Simuler force_seek (BUFFERING)
      </button>

      {/* Simule un user qui envoie ready - disponible seulement en BUFFERING */}
      <button
        onClick={simulerUnUserPret}
        disabled={etat !== "BUFFERING"}
        style={{ marginRight: "8px" }}
      >
        Simuler un user pret ({usersPrets}/{TOTAL_USERS})
      </button>

      {/* Simule all_ready - envoye par le serveur quand tous les users sont prets */}
      <button
        onClick={simulerAllReady}
        disabled={etat !== "BUFFERING"}
        style={{ marginRight: "8px" }}
      >
        Simuler all_ready (PLAYING)
      </button>

      {/* Simule pause */}
      <button
        onClick={simulerPause}
        disabled={etat !== "PLAYING"}
        style={{ marginRight: "8px" }}
      >
        Simuler pause (PAUSED)
      </button>

      {/* Simule play */}
      <button
        onClick={simulerPlay}
        disabled={etat !== "PAUSED"}
        style={{ marginRight: "8px" }}
      >
        Simuler play (PLAYING)
      </button>

      {/* Reset */}
      <button onClick={resetEtat}>
        Reset
      </button>

      {/* Zone de logs */}
      <h3>Logs</h3>
      {log.length === 0 && <p>Aucun log pour linstant</p>}
      {log.map((l, i) => (
        <p key={i}>{l}</p>
      ))}

      {/* Ce que tu dois verifier */}
      <h3>Ce que tu dois verifier</h3>
      <p>1. Cliquer "Simuler force_seek" passe en BUFFERING - fond rouge - message en attente</p>
      <p>2. Cliquer "Simuler un user pret" plusieurs fois incremente le compteur</p>
      <p>3. Au 5eme user pret le passage en PLAYING est automatique</p>
      <p>4. Cliquer "Simuler all_ready" passe directement en PLAYING - fond vert</p>
      <p>5. Cliquer "Simuler pause" passe en PAUSED - fond jaune</p>
      <p>6. Cliquer "Simuler play" repasse en PLAYING - fond vert</p>
      <p>7. Les boutons sont bien desactives selon l etat actuel</p>
    </div>
  );
}