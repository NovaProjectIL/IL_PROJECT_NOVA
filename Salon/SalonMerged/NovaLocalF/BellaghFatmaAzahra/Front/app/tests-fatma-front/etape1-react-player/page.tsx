"use client";

// Test Etape 1 - React-Player + YouTube
// Objectif : verifier que la video charge et que currentTime est precis au moment du clic

import { useState, useRef, useEffect } from "react";
import ReactPlayer from "react-player";

export default function TestReactPlayer() {

  // Controle si le composant est monte cote client
  // Necessaire pour eviter l erreur d hydratation SSR de Next.js
  const [mounted, setMounted] = useState<boolean>(false);

  // Reference vers le player pour acceder a ses methodes (getCurrentTime, etc.)
  const playerRef = useRef<any>(null);

  // Stocke le timestamp capture au moment du clic sur le bouton
  const [currentTime, setCurrentTime] = useState<number>(0);

  // Stocke la duree totale de la video
  const [duration, setDuration] = useState<number>(0);

  // Passe a true quand le player est pret
  const [ready, setReady] = useState<boolean>(false);

  // Tableau de messages pour suivre ce qui se passe en temps reel
  const [log, setLog] = useState<string[]>([]);

  // useEffect s execute uniquement cote client apres le montage du composant
  // Cela evite le conflit entre le rendu serveur et le rendu client
  useEffect(() => {
    setMounted(true);
  }, []);

  // Ajoute un message horodate dans les logs
  const addLog = (msg: string) => {
    setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);
  };

  // Au clic on lit le currentTime exact du player a cet instant
  const handleCaptureTime = () => {
    const t: number = playerRef.current?.getCurrentTime() ?? 0;
    setCurrentTime(t);
    addLog(`currentTime capture : ${t.toFixed(3)}s`);
  };

  return (
    <div>
      <h2>Etape 1 - Test React-Player avec YouTube</h2>
      <p>Objectif : verifier que la video charge et que currentTime est precis</p>

      {/* On n affiche le player que si le composant est monte cote client */}
      {mounted && (
        <ReactPlayer
          ref={playerRef}
          url="https://www.youtube.com/watch?v=TtNGJGbE9t0"
          controls={true}
          width="640px"
          height="360px"
          // Se declenche quand le player est initialise et pret
          onReady={() => {
            setReady(true);
            const d: number = playerRef.current?.getDuration() ?? 0;
            setDuration(d);
            addLog("Video chargee avec succes (onReady)");
            addLog(`Duree totale : ${d.toFixed(1)}s`);
          }}
          // Se declenche periodiquement pendant la lecture
          onProgress={(state: any) => {
            if (duration === 0) {
              const d: number = playerRef.current?.getDuration() ?? 0;
              if (d > 0) {
                setDuration(d);
                addLog(`Duree totale recuperee : ${d.toFixed(1)}s`);
              }
            }
          }}
          // Se declenche si une erreur survient
          onError={(e: any) => addLog(`Erreur player : ${JSON.stringify(e)}`)}
        />
      )}

      {/* Bouton desactive tant que le player n est pas pret */}
      <button
        onClick={handleCaptureTime}
        disabled={!ready}
      >
        Capturer currentTime
      </button>

      {/* Resultats des mesures */}
      <p>Player pret : {ready ? "oui" : "non - en attente..."}</p>
      <p>Duree totale : {duration.toFixed(1)}s</p>
      <p>currentTime capture au dernier clic : {currentTime.toFixed(3)}s</p>

      {/* Zone de logs */}
      <h3>Logs</h3>
      {log.length === 0 && <p>Aucun log pour linstant</p>}
      {log.map((l, i) => (
        <p key={i}>{l}</p>
      ))}

      {/* Ce que tu dois verifier */}
      <h3>Ce que tu dois verifier</h3>
      <p>1. La video charge - tu dois voir Video chargee avec succes dans les logs</p>
      <p>2. La duree totale s affiche dans les logs</p>
      <p>3. Le currentTime capture correspond au moment ou tu cliques</p>
      <p>4. Les controles YouTube sont visibles et cliquables</p>
    </div>
  );
}