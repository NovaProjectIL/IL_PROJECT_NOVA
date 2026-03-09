"use client";

// VideoPlayer.tsx
// Composant principal du player video synchronise
// A placer dans : Front/app/components/VideoPlayer.tsx

import { useEffect, useRef, useState } from "react";
import ReactPlayer from "react-player";
import { useSync } from "../hooks/Usesync";
import { Marqueur } from "../types/types";

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

// Seuil en secondes pour le clustering visuel
// Deux marqueurs a moins de 10s l un de l autre sont groupes
const SEUIL_CLUSTERING = 10;

// Type pour un groupe de marqueurs (clustering)
type Groupe = {
  marqueurs: Marqueur[];
  timecodeRepresentant: number;
};

// Groupe les marqueurs proches selon le seuil de clustering
const grouperMarqueurs = (marqueurs: Marqueur[]): Groupe[] => {
  const tries = [...marqueurs].sort((a, b) => a.timecode - b.timecode);
  const groupes: Groupe[] = [];
  let i = 0;
  while (i < tries.length) {
    const groupe: Marqueur[] = [tries[i]];
    let j = i + 1;
    while (j < tries.length && tries[j].timecode - tries[i].timecode < SEUIL_CLUSTERING) {
      groupe.push(tries[j]);
      j++;
    }
    groupes.push({ marqueurs: groupe, timecodeRepresentant: tries[i].timecode });
    i = j;
  }
  return groupes;
};

export default function VideoPlayer({ url, roomId, marqueurs, onNouveauMarqueur }: VideoPlayerProps) {

  // Montage cote client uniquement pour eviter l erreur d hydratation SSR
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Reference vers le player pour acceder a getCurrentTime et seekTo
  const playerRef = useRef<any>(null);

  // Duree totale de la video en secondes
  const [duree, setDuree] = useState<number>(0);

  // Timecode cible lors d un seek force par le serveur
  const [seekCible, setSeekCible] = useState<number | null>(null);

  // Groupe de marqueurs dont la liste est depliee
  const [groupeDeplie, setGroupeDeplie] = useState<number | null>(null);

  // Index du marqueur actuellement selectionne pour la navigation
  const [indexActuel, setIndexActuel] = useState<number>(-1);

  // Hook Socket.io - gere la connexion et les evenements de sync
  const { etatSync, emitSeek, emitReady } = useSync(roomId);

  // Quand etatSync passe en BUFFERING suite a un force_seek
  // on applique le seek sur le player YouTube
  useEffect(() => {
    if (etatSync === "BUFFERING" && seekCible !== null && playerRef.current) {
      // On applique le seek au bon timecode
      playerRef.current.seekTo(seekCible, "seconds");
    }
  }, [etatSync, seekCible]);

  // Calcule la position en pourcentage sur la timeline
  const calculerPosition = (timecode: number): number => {
    if (duree === 0) return 0;
    return (timecode / duree) * 100;
  };

  // Quand l utilisateur clique sur une epingle ou un marqueur de la liste
  // On emet un request_seek vers le serveur via Socket.io
  const handleClicMarqueur = (marqueur: Marqueur, index: number) => {
    setIndexActuel(index);
    setSeekCible(marqueur.timecode);
    // TODO ZINEB : emitSeek envoie request_seek a ton gateway NestJS
    emitSeek(marqueur.timecode);
  };

  // Navigation vers le marqueur suivant
  const handleSuivant = () => {
    const marqueursTriees = [...marqueurs].sort((a, b) => a.timecode - b.timecode);
    const nouvelIndex = indexActuel < marqueursTriees.length - 1 ? indexActuel + 1 : indexActuel;
    if (nouvelIndex !== indexActuel) {
      handleClicMarqueur(marqueursTriees[nouvelIndex], nouvelIndex);
    }
  };

  // Navigation vers le marqueur precedent
  const handlePrecedent = () => {
    const nouvelIndex = indexActuel > 0 ? indexActuel - 1 : 0;
    if (nouvelIndex !== indexActuel) {
      const marqueursTriees = [...marqueurs].sort((a, b) => a.timecode - b.timecode);
      handleClicMarqueur(marqueursTriees[nouvelIndex], nouvelIndex);
    }
  };

  // Quand l utilisateur clique sur "Poser un marqueur"
  // On capture le currentTime precis au moment du clic
  const handlePoserMarqueur = () => {
    if (playerRef.current && onNouveauMarqueur) {
      // On lit currentTime au moment exact du clic, pas au prochain timeupdate
      const timecode = playerRef.current.getCurrentTime() ?? 0;
      onNouveauMarqueur(timecode);
    }
  };

  const groupes = grouperMarqueurs(marqueurs);
  const marqueursTriees = [...marqueurs].sort((a, b) => a.timecode - b.timecode);

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
            // On utilise notre propre interface de controle
            controls={false}
            width="100%"
            height="400px"
            // playing pilote par l etat de sync
            playing={etatSync === "PLAYING"}
            // Se declenche quand le player est pret
            onReady={() => {
              const d = playerRef.current?.getDuration() ?? 0;
              setDuree(d);
            }}
            // Se declenche quand le player finit de bufferiser apres un seek
            // C est ici qu on signale au serveur que ce client est pret
            onPlay={() => {
              if (etatSync === "BUFFERING") {
                // TODO ZINEB : emitReady envoie l evenement "ready" a ton gateway NestJS
                emitReady();
              }
            }}
            onError={(e: any) => console.error("Erreur player:", e)}
          />

          {/* Indicateur d etat de synchronisation */}
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
      {/* SAFE ZONE - tout ce qui suit est SOUS l iframe YouTube */}
      {/* Les controles et la timeline sont ici pour eviter le click-jacking */}
      {/* TODO ZINEB : RT-03 - cette zone safe evite le blocage des overlays YouTube */}
      {/* -------------------------------------------------- */}

      {/* Bouton pour poser un marqueur au timestamp actuel */}
      <button
        onClick={handlePoserMarqueur}
        disabled={duree === 0}
      >
        Poser un marqueur ici
      </button>

      {/* Navigation precedent / suivant */}
      <button
        onClick={handlePrecedent}
        disabled={indexActuel <= 0}
        style={{ marginLeft: "8px" }}
      >
        Precedent
      </button>

      <button
        onClick={handleSuivant}
        disabled={indexActuel >= marqueursTriees.length - 1}
        style={{ marginLeft: "8px" }}
      >
        Suivant
      </button>

      {/* -------------------------------------------------- */}
      {/* TIMELINE avec epingles et clustering */}
      {/* -------------------------------------------------- */}
      <div style={{
        position: "relative",
        width: "100%",
        height: "8px",
        background: "#ccc",
        marginTop: "30px",
        marginBottom: "40px",
      }}>
        {groupes.map((groupe, index) => {
          const position = calculerPosition(groupe.timecodeRepresentant);
          const estGroupe = groupe.marqueurs.length > 1;
          const estDeplie = groupeDeplie === index;

          return (
            <div key={index}>
              {/* Epingle ou pastille de groupe */}
              <div
                onClick={() => {
                  if (estGroupe) {
                    setGroupeDeplie(estDeplie ? null : index);
                  } else {
                    const idx = marqueursTriees.findIndex(m => m.id === groupe.marqueurs[0].id);
                    handleClicMarqueur(groupe.marqueurs[0], idx);
                  }
                }}
                title={estGroupe ? `${groupe.marqueurs.length} marqueurs` : groupe.marqueurs[0].label}
                style={{
                  position: "absolute",
                  left: `${position}%`,
                  transform: "translateX(-50%)",
                  top: "-10px",
                  width: estGroupe ? "28px" : "20px",
                  height: estGroupe ? "28px" : "20px",
                  borderRadius: "50%",
                  background: estGroupe ? "orange" : "blue",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontSize: "11px",
                  fontWeight: "bold",
                }}
              >
                {estGroupe ? groupe.marqueurs.length : ""}
              </div>

              {/* Liste depliee pour les groupes */}
              {estGroupe && estDeplie && (
                <div style={{
                  position: "absolute",
                  left: `${position}%`,
                  top: "20px",
                  background: "white",
                  border: "1px solid black",
                  padding: "4px",
                  zIndex: 10,
                  minWidth: "180px",
                  color: "black",
                }}>
                  {groupe.marqueurs.map((m) => {
                    const idx = marqueursTriees.findIndex(mm => mm.id === m.id);
                    return (
                      <div
                        key={m.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClicMarqueur(m, idx);
                          setGroupeDeplie(null);
                        }}
                        style={{ cursor: "pointer", padding: "2px" }}
                      >
                        {m.label} ({m.timecode}s)
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Liste complete des marqueurs */}
      <h3>Marqueurs</h3>
      {marqueursTriees.length === 0 && <p>Aucun marqueur pour linstant</p>}
      {marqueursTriees.map((m, index) => (
        <p
          key={m.id}
          onClick={() => handleClicMarqueur(m, index)}
          style={{
            cursor: "pointer",
            fontWeight: index === indexActuel ? "bold" : "normal",
            color: "black",
          }}
        >
          {index === indexActuel ? ">> " : ""}{m.label} - {m.timecode}s - {m.categorie}
        </p>
      ))}

    </div>
  );
}