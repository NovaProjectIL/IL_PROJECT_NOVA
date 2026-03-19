"use client";

// VideoTimeline.tsx
// Composant de la timeline partagee avec epingles, clustering et navigation
// A placer dans : Front/app/components/VideoTimeline.tsx

import { useState } from "react";
import { Marqueur } from "../types/types";
import styles from './VideoTimeline.module.css';

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
  onModifierMarqueur?: (marqueur: Marqueur, data: { label?: string; timecode?: number; categorie?: Marqueur["categorie"] }) => Promise<void>;
  onSupprimerMarqueur?: (marqueur: Marqueur) => Promise<void>;
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
  onModifierMarqueur,
  onSupprimerMarqueur,
}: VideoTimelineProps) {

  // Groupe de marqueurs dont la liste est depliee
  const [groupeDeplie, setGroupeDeplie] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState("");
  const [draftTime, setDraftTime] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Calcule la position en pourcentage sur la timeline
  // Formule validee en Etape 2 des tests
  const calculerPosition = (timecode: number): number => {
    if (duree === 0) return 0;
    return (timecode / duree) * 100;
  };

  const formatTime = (seconds: number) => {
    const totalSeconds = Math.max(0, Math.floor(seconds));
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const parseTimeInput = (value: string): number | null => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parts = trimmed.split(":");
    if (parts.length === 1) {
      const s = Number(parts[0]);
      if (Number.isNaN(s)) return null;
      return Math.max(0, s);
    }
    if (parts.length === 2) {
      const m = Number(parts[0]);
      const s = Number(parts[1]);
      if (Number.isNaN(m) || Number.isNaN(s)) return null;
      return Math.max(0, m * 60 + s);
    }
    return null;
  };

  const startEdit = (m: Marqueur) => {
    setEditingId(m.id);
    setDraftLabel(m.label);
    setDraftTime(formatTime(m.timecode));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraftLabel("");
    setDraftTime("");
  };

  const handleSave = async (m: Marqueur) => {
    if (!onModifierMarqueur) return;
    const nextLabel = draftLabel.trim() || m.label;
    const parsedTime = parseTimeInput(draftTime);
    const nextTime = parsedTime === null ? m.timecode : parsedTime;
    setIsSaving(true);
    try {
      await onModifierMarqueur(m, { label: nextLabel, timecode: nextTime });
      cancelEdit();
    } finally {
      setIsSaving(false);
    }
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

      {/* Marker Navigation Controls - Modern Purple Design */}
      <div className={styles.markerControls}>
        <button
          onClick={onPoserMarqueur}
          disabled={duree === 0}
          className={styles.markerButton}
          title="Poser un marqueur ici"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" height="20" width="20">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
        </button>

        <button
          onClick={() => {
            if (indexActuel > 0) {
              onClicMarqueur(marqueursTriees[indexActuel - 1], indexActuel - 1);
            }
          }}
          disabled={indexActuel <= 0}
          className={styles.markerNavButton}
          title="Précédent"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" height="24" width="24">
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
          </svg>
        </button>

        <button
          onClick={() => {
            if (indexActuel < marqueursTriees.length - 1) {
              onClicMarqueur(marqueursTriees[indexActuel + 1], indexActuel + 1);
            }
          }}
          disabled={indexActuel >= marqueursTriees.length - 1}
          className={styles.markerNavButton}
          title="Suivant"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" height="24" width="24">
            <path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/>
          </svg>
        </button>
      </div>


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
                        {m.label || `Marker ${idx + 1}`} — {formatTime(m.timecode)}
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
      <div className={styles.markerListContainer}>
        <div className={styles.markerListHeader}>Marqueurs</div>
        {marqueursTriees.length === 0 && (
          <div className={styles.markerEmpty}>Aucun marqueur pour linstant</div>
        )}
        {marqueursTriees.map((m, index) => {
          const isEditing = editingId === m.id;
          return (
            <div
              key={m.id}
              onClick={() => {
                if (!isEditing) onClicMarqueur(m, index);
              }}
              className={`${styles.markerRow} ${index === indexActuel ? styles.markerRowActive : ""}`}
              role="button"
              tabIndex={0}
            >
              {isEditing ? (
                <div className={styles.markerEditForm} onClick={(e) => e.stopPropagation()}>
                  <input
                    className={styles.markerInput}
                    value={draftLabel}
                    onChange={(e) => setDraftLabel(e.target.value)}
                    placeholder="Titre du marqueur"
                    type="text"
                  />
                  <input
                    className={styles.markerInputTime}
                    value={draftTime}
                    onChange={(e) => setDraftTime(e.target.value)}
                    placeholder="MM:SS"
                    type="text"
                  />
                  <div className={styles.markerActions}>
                    <button
                      className={styles.markerActionPrimary}
                      onClick={() => handleSave(m)}
                      disabled={isSaving}
                      type="button"
                    >
                      Enregistrer
                    </button>
                    <button
                      className={styles.markerActionGhost}
                      onClick={cancelEdit}
                      type="button"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className={styles.markerRowContent}>
                    <span className={styles.markerName}>{m.label || `Marker ${index + 1}`}</span>
                    <span className={styles.markerTime}>{formatTime(m.timecode)}</span>
                  </div>
                  <div className={styles.markerActions} onClick={(e) => e.stopPropagation()}>
                    <button
                      className={styles.markerActionButton}
                      onClick={() => startEdit(m)}
                      type="button"
                      title="Modifier"
                    >
                      Modifier
                    </button>
                    <button
                      className={styles.markerActionDelete}
                      onClick={() => {
                        if (onSupprimerMarqueur && window.confirm("Supprimer ce marqueur ?")) {
                          onSupprimerMarqueur(m);
                        }
                      }}
                      type="button"
                      title="Supprimer"
                    >
                      Supprimer
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
