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
  // ID YouTube de la video (ex: "dQw4w9WgXcQ")
  // Compatibilite avec l existant qui passe youtubeId et non url
  youtubeId: string;
  // Etat de lecture pilote par la room
  isPlaying: boolean;
  // Position courante en secondes pilotee par la room
  currentTime: number;
  // Identifiant de la room courante
  // TODO NADJIB : ce roomId sera utilise par useSync pour rejoindre le bon namespace Socket.io
  roomId: string;
  // Liste des marqueurs a afficher sur la timeline
  // TODO WAFA : ces marqueurs viendront de ton API GET /markers?room_id=X
  marqueurs: Marqueur[];
  // Callbacks existants pour compatibilite avec RoomPage
  onProgress: (time: number) => void;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onDuration: (duration: number) => void;
  // Callback appele quand l utilisateur pose un nouveau marqueur
  // TODO WAFA : ce callback appellera ton API POST /markers
  onNouveauMarqueur?: (timecode: number) => void;
};

export default function VideoPlayer({
  youtubeId,
  isPlaying,
  currentTime,
  roomId,
  marqueurs,
  onProgress,
  onPlay,
  onPause,
  onSeek,
  onDuration,
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

  // Timecode cible lors d un seek force par le serveur Socket.io
  const [seekCible, setSeekCible] = useState<number | null>(null);

  // Index du marqueur actuellement selectionne
  // Passe a VideoTimeline pour afficher le marqueur actuel en gras
  const [indexActuel, setIndexActuel] = useState<number>(-1);

  // Hook Socket.io - gere la connexion et les evenements de sync
  // TODO NADJIB : verifier que useSync correspond a ta configuration gateway
  // TODO ZINEB : verifier que les evenements force_seek et all_ready sont bien emis par ton gateway
  const { etatSync, emitSeek, emitReady } = useSync(roomId);

  // Quand etatSync passe en BUFFERING suite a un force_seek du serveur
  // on applique le seek sur le player YouTube
  useEffect(() => {
    if (etatSync === "BUFFERING" && seekCible !== null && playerRef.current) {
      playerRef.current.seekTo(seekCible, "seconds");
    }
  }, [etatSync, seekCible]);

  // Synchro avec la position recue depuis RoomPage
  // Quand RoomPage met a jour currentTime via socket playback-updated
  // on seek le player si l ecart est trop grand (> 2s)
  useEffect(() => {
    if (playerRef.current && duree > 0) {
      const diff = Math.abs(playerRef.current.getCurrentTime() - currentTime);
      if (diff > 2) {
        playerRef.current.seekTo(currentTime, "seconds");
      }
    }
  }, [currentTime, duree]);

  // Appele par VideoTimeline quand l utilisateur clique sur un marqueur
  // On emet un request_seek vers le serveur via Socket.io
  // TODO ZINEB : emitSeek envoie request_seek a ton gateway NestJS
  const handleClicMarqueur = (marqueur: Marqueur, index: number) => {
    setIndexActuel(index);
    setSeekCible(marqueur.timecode);
    emitSeek(marqueur.timecode);
    // On notifie aussi RoomPage pour garder la position synchronisee
    onSeek(marqueur.timecode);
  };

  // Appele par VideoTimeline quand l utilisateur clique sur "Poser un marqueur"
  // On capture le currentTime precis au moment du clic
  // Valide en Etape 1 des tests
  const handlePoserMarqueur = () => {
    if (playerRef.current && onNouveauMarqueur) {
      const timecode = playerRef.current.getCurrentTime() ?? 0;
      onNouveauMarqueur(timecode);
    }
  };

  // Construction de l URL YouTube complete a partir de l ID
  const url = `https://www.youtube.com/watch?v=${youtubeId}`;

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
            // On utilise VideoTimeline et les boutons de RoomPage pour la navigation
            controls={false}
            width="100%"
            height="400px"
            // playing pilote par isPlaying venant de RoomPage
            playing={isPlaying}
            // Se declenche quand le player est pret
            onReady={() => {
              const d = playerRef.current?.getDuration() ?? 0;
              setDuree(d);
              onDuration(d);
            }}
            // Se declenche periodiquement pendant la lecture
            onProgress={(state: any) => {
              onProgress(state.playedSeconds);
            }}
            // Se declenche quand l utilisateur clique sur play
            onPlay={() => {
              // Si on est en BUFFERING c est qu on vient de finir un seek
              // On signale au serveur que ce client est pret
              // TODO ZINEB : emitReady envoie l evenement "ready" a ton gateway NestJS
              if (etatSync === "BUFFERING") {
                emitReady();
              }
              onPlay();
            }}
            onPause={onPause}
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
      {/* Evite le click-jacking YouTube */}
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