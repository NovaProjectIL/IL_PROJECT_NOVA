"use client";

// VideoTimeline.tsx
// Composant de la timeline partagee avec epingles, clustering et navigation
// A placer dans : Front/app/components/VideoTimeline.tsx

import { useState } from "react";
import { Marqueur } from "../types/types";

type VideoTimelineProps = {
  // Duree totale de la video en secondes
  // Recue depuis VideoPlayer via playerRef.current.getDuration()
  duree: number;
  // Liste des marqueurs a afficher
  // TODO WAFA : ces marqueurs viendront de ton API GET /markers?room_id=X
  marqueurs: Marqueur[];
  // Index du marqueur actuellement selectionne
  indexActuel: number;
  // Callback appele quand l utilisateur clique sur un marqueur
  // Declenche un request_seek via Socket.io dans VideoPlayer
  onClicMarqueur: (marqueur: Marqueur, index: number) => void;
  // Callback appele quand l utilisateur clique sur "Poser un marqueur"
  // TODO WAFA : ce callback appellera ton API POST /markers
  onPoserMarqueur: () => void;
};

// Seuil en secondes pour le clustering visuel
// Deux marqueurs a moins de 10s l un de l autre sont groupes
const SEUIL_CLUSTERING = 10;

// Type pour un groupe de marqueurs
type Groupe = {
  marqueurs: Marqueur[];
  timecodeRepresentant: number;
};

// Groupe les marqueurs proches selon le seuil de clustering
// Valide en Etape 3 des tests
const grouperMarqueurs = (marqueurs: Marqueur[]): Groupe[] => {
  const tries = [...marqueurs].sort((a, b) => a.timecode - b.timecode);
  const groupes: Groupe[] = [];
  let i = 0;
  while (i < tries.length) {
    const groupe: Marqueur[] = [tries[i]];
    let j = i + 1;
    while (
      j < tries.length &&
      tries[j].timecode - tries[i].timecode < SEUIL_CLUSTERING
    ) {
      groupe.push(tries[j]);
      j++;
    }
    groupes.push({
      marqueurs: groupe,
      timecodeRepresentant: tries[i].timecode,
    });
    i = j;
  }
  return groupes;
};

export default function VideoTimeline({
  duree,
  marqueurs,
  indexActuel,
  onClicMarqueur,
  onPoserMarqueur,
}: VideoTimelineProps) {

  // Groupe de marqueurs dont la liste est depliee
  const [groupeDeplie, setGroupeDeplie] = useState<number | null>(null);

  // Calcule la position en pourcentage sur la timeline
  // Formule validee en Etape 2 des tests
  const calculerPosition = (timecode: number): number => {
    if (duree === 0) return 0;
    return (timecode / duree) * 100;
  };

  const groupes = grouperMarqueurs(marqueurs);
  const marqueursTriees = [...marqueurs].sort((a, b) => a.timecode - b.timecode);

  return (
    <div>

      {/* -------------------------------------------------- */}
      {/* SAFE ZONE - tout ce composant est SOUS l iframe YouTube */}
      {/* Les controles sont ici pour eviter le click-jacking YouTube */}
      {/* TODO ZINEB : RT-03 - cette zone safe evite le blocage des overlays */}
      {/* -------------------------------------------------- */}

      {/* Bouton pour poser un marqueur au timestamp actuel */}
      <button
        onClick={onPoserMarqueur}
        disabled={duree === 0}
      >
        Poser un marqueur ici
      </button>

      {/* Boutons de navigation precedent / suivant */}
      {/* Valides en Etape 4 des tests */}
      <button
        onClick={() => {
          if (indexActuel > 0) {
            onClicMarqueur(marqueursTriees[indexActuel - 1], indexActuel - 1);
          }
        }}
        disabled={indexActuel <= 0}
        style={{ marginLeft: "8px" }}
      >
        Precedent
      </button>

      <button
        onClick={() => {
          if (indexActuel < marqueursTriees.length - 1) {
            onClicMarqueur(marqueursTriees[indexActuel + 1], indexActuel + 1);
          }
        }}
        disabled={indexActuel >= marqueursTriees.length - 1}
        style={{ marginLeft: "8px" }}
      >
        Suivant
      </button>

      {/* -------------------------------------------------- */}
      {/* BARRE DE TIMELINE avec epingles et clustering */}
      {/* -------------------------------------------------- */}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "8px",
          background: "#ccc",
          marginTop: "30px",
          marginBottom: "40px",
        }}
      >
        {groupes.map((groupe, index) => {
          const position = calculerPosition(groupe.timecodeRepresentant);
          const estGroupe = groupe.marqueurs.length > 1;
          const estDeplie = groupeDeplie === index;

          return (
            <div key={index}>

              {/* Epingle simple ou pastille de groupe */}
              <div
                onClick={() => {
                  if (estGroupe) {
                    // Groupe : on deplie ou replie la liste
                    setGroupeDeplie(estDeplie ? null : index);
                  } else {
                    // Epingle simple : on navigue directement
                    const idx = marqueursTriees.findIndex(
                      (m) => m.id === groupe.marqueurs[0].id
                    );
                    onClicMarqueur(groupe.marqueurs[0], idx);
                  }
                }}
                title={
                  estGroupe
                    ? `${groupe.marqueurs.length} marqueurs groupes`
                    : groupe.marqueurs[0].label
                }
                style={{
                  position: "absolute",
                  left: `${position}%`,
                  // On centre l epingle sur sa position
                  transform: "translateX(-50%)",
                  top: "-10px",
                  width: estGroupe ? "28px" : "20px",
                  height: estGroupe ? "28px" : "20px",
                  borderRadius: "50%",
                  // Orange si groupe, bleu si epingle isolee
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
                {/* Nombre de marqueurs affiché seulement si groupe */}
                {estGroupe ? groupe.marqueurs.length : ""}
              </div>

              {/* Liste depliee quand on clique sur une pastille de groupe */}
              {estGroupe && estDeplie && (
                <div
                  style={{
                    position: "absolute",
                    left: `${position}%`,
                    top: "20px",
                    background: "white",
                    border: "1px solid black",
                    padding: "4px",
                    zIndex: 10,
                    minWidth: "180px",
                    color: "black",
                  }}
                >
                  {groupe.marqueurs.map((m) => {
                    const idx = marqueursTriees.findIndex(
                      (mm) => mm.id === m.id
                    );
                    return (
                      <div
                        key={m.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onClicMarqueur(m, idx);
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

      {/* -------------------------------------------------- */}
      {/* LISTE COMPLETE des marqueurs avec marqueur actuel en gras */}
      {/* -------------------------------------------------- */}
      <h3>Marqueurs</h3>
      {marqueursTriees.length === 0 && <p>Aucun marqueur pour linstant</p>}
      {marqueursTriees.map((m, index) => (
        <p
          key={m.id}
          onClick={() => onClicMarqueur(m, index)}
          style={{
            cursor: "pointer",
            // Marqueur actuel en gras
            fontWeight: index === indexActuel ? "bold" : "normal",
            color: "black",
          }}
        >
          {index === indexActuel ? ">> " : ""}
          {m.label} - {m.timecode}s - {m.categorie}
        </p>
      ))}
    </div>
  );
}