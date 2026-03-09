"use client";

// VideoPlayer.tsx
// Composant principal du player video synchronise
// A placer dans : Front/app/components/VideoPlayer.tsx

import { useEffect, useRef, useState } from "react";
import ReactPlayer from "react-player";
import { useSync } from "../hooks/Usesync";
import { Marqueur } from "../types/types";
import VideoTimeline from "./VideoTimeline";

type VideoPlayerProps = {
  // URL YouTube de la video a lire
  url: string;
  // Identifiant de la room courante
  roomId: string;
  // Liste des marqueurs a afficher sur la timeline
  // TODO WAFA : ces marqueurs viendront de ton API GET /markers?room_id=X
  marqueurs: Marqueur[];
  // Callback appele quand l utilisateur pose un nouveau marqueur
  // TODO WAFA : ce callback appellera ton API POST /markers
  onNouveauMarqueur?: (timecode: number) => void;
};

export default function VideoPlayer({
  url,
  roomId,
  marqueurs,
  onNouveauMarqueur,
}: VideoPlayerProps) {

  // Montage cote client uniquement pour eviter l erreur d hydratation SSR
  // Valide en Etape 1 des tests
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Reference vers le player pour acceder a getCurrentTime et seekTo
  const playerRef = useRef<any>(null);

  // Duree totale de la video en secondes
  // Passee a VideoTimeline pour calculer les positions des epingles
  const [duree, setDuree] = useState<number>(0);

  // Timecode cible lors d un seek force par le serveur
  const [seekCible, setSeekCible] = useState<number | null>(null);

  // Index du marqueur actuellement selectionne
  // Passe a VideoTimeline pour afficher le marqueur actuel en gras
  const [indexActuel, setIndexActuel] = useState<number>(-1);

  // Hook Socket.io - gere la connexion et les evenements de sync
  // TODO NADJIB : verifier que useSync correspond a ta configuration gateway
  const { etatSync, emitSeek, emitReady } = useSync(roomId);

  // Quand etatSync passe en BUFFERING suite a un force_seek
  // on applique le seek sur le player YouTube
  useEffect(() => {
    if (etatSync === "BUFFERING" && seekCible !== null && playerRef.current) {
      playerRef.current.seekTo(seekCible, "seconds");
    }
  }, [etatSync, seekCible]);

  // Appele par VideoTimeline quand l utilisateur clique sur un marqueur
  // On emet un request_seek vers le serveur via Socket.io
  // TODO ZINEB : emitSeek envoie request_seek a ton gateway NestJS
  const handleClicMarqueur = (marqueur: Marqueur, index: number) => {
    setIndexActuel(index);
    setSeekCible(marqueur.timecode);
    emitSeek(marqueur.timecode);
  };

  // Appele par VideoTimeline quand l utilisateur clique sur "Poser un marqueur"
  // On capture le currentTime precis au moment du clic
  const handlePoserMarqueur = () => {
    if (playerRef.current && onNouveauMarqueur) {
      // On lit currentTime au moment exact du clic, pas au prochain timeupdate
      // Valide en Etape 1 des tests
      const timecode = playerRef.current.getCurrentTime() ?? 0;
      onNouveauMarqueur(timecode);
    }
  };

  return (
    <div>

      {/* -------------------------------------------------- */}
      {/* ZONE PLAYER - le player YouTube sans controles natifs */}
      {/* -------------------------------------------------- */}
      {mounted && (
        <div style={{ position: "relative" }}>
          <ReactPlayer
            ref={playerRef}
            url={url}
            // controls=false pour cacher les controles natifs YouTube
            // On utilise VideoTimeline pour la navigation
            controls={false}
            width="100%"
            height="400px"
            // playing pilote par l etat de sync recu via Socket.io
            playing={etatSync === "PLAYING"}
            // Se declenche quand le player est pret
            onReady={() => {
              const d = playerRef.current?.getDuration() ?? 0;
              setDuree(d);
            }}
            // Se declenche quand le player finit de bufferiser apres un seek
            // C est ici qu on signale au serveur que ce client est pret
            // TODO ZINEB : emitReady envoie l evenement "ready" a ton gateway NestJS
            onPlay={() => {
              if (etatSync === "BUFFERING") {
                emitReady();
              }
            }}
            onError={(e: any) => console.error("Erreur player:", e)}
          />

          {/* Overlay BUFFERING - affiche pendant l attente des autres users */}
          {/* Valide en Etape 5 des tests */}
          {etatSync === "BUFFERING" && (
            <div style={{
              position: "absolute",
              top: 0, left: 0, right: 0, bottom: 0,
              background: "rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: "18px",
            }}>
              En attente des autres utilisateurs...
            </div>
          )}
        </div>
      )}

      {/* -------------------------------------------------- */}
      {/* SAFE ZONE - VideoTimeline est SOUS l iframe YouTube */}
      {/* Evite le click-jacking YouTube - valide en Etape 1 */}
      {/* TODO ZINEB : RT-03 - cette zone safe evite le blocage des overlays */}
      {/* -------------------------------------------------- */}
      <VideoTimeline
        duree={duree}
        marqueurs={marqueurs}
        indexActuel={indexActuel}
        onClicMarqueur={handleClicMarqueur}
        onPoserMarqueur={handlePoserMarqueur}
      />

    </div>
  );
}