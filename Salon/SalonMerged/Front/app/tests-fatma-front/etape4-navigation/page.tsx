"use client";

// Test Etape 4 - Navigation Precedent / Suivant
// Objectif : verifier que les boutons naviguent correctement de marqueur en marqueur
// et tester les cas limites (premier et dernier marqueur)

import { useState } from "react";

const DUREE_VIDEO = 300;

const MARQUEURS_FICTIFS = [
  { id: 1, timecode: 30,  label: "Marqueur A" },
  { id: 2, timecode: 90,  label: "Marqueur B" },
  { id: 3, timecode: 150, label: "Marqueur C" },
  { id: 4, timecode: 210, label: "Marqueur D" },
  { id: 5, timecode: 270, label: "Marqueur E" },
];

export default function TestNavigation() {

  // Index du marqueur actuellement selectionne (-1 = aucun)
  const [indexActuel, setIndexActuel] = useState<number>(-1);

  // Simule le currentTime de la video
  const [currentTime, setCurrentTime] = useState<number>(0);

  // Logs
  const [log, setLog] = useState<string[]>([]);

  const addLog = (msg: string) => {
    setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);
  };

  // Calcule la position en pourcentage sur la timeline
  const calculerPosition = (timecode: number): number => {
    return (timecode / DUREE_VIDEO) * 100;
  };

  // Navigue vers un marqueur specifique par son index
  const naviguerVers = (index: number) => {
    const marqueur = MARQUEURS_FICTIFS[index];
    setIndexActuel(index);
    // On simule le seek en mettant a jour le currentTime
    setCurrentTime(marqueur.timecode);
    addLog(`Navigation vers "${marqueur.label}" - timecode: ${marqueur.timecode}s`);
  };

  // Bouton Suivant : va au marqueur suivant
  const handleSuivant = () => {
    if (indexActuel === -1) {
      // Aucun marqueur selectionne : on va au premier
      naviguerVers(0);
      addLog("Aucun marqueur selectionne - navigation vers le premier");
    } else if (indexActuel < MARQUEURS_FICTIFS.length - 1) {
      // On va au marqueur suivant
      naviguerVers(indexActuel + 1);
    } else {
      // On est deja au dernier marqueur
      addLog("Deja au dernier marqueur - navigation impossible");
    }
  };

  // Bouton Precedent : va au marqueur precedent
  const handlePrecedent = () => {
    if (indexActuel <= 0) {
      // On est au premier marqueur ou aucun selectionne
      addLog("Deja au premier marqueur - navigation impossible");
    } else {
      // On va au marqueur precedent
      naviguerVers(indexActuel - 1);
    }
  };

  // Clic direct sur une epingle de la timeline
  const handleClicEpingle = (index: number) => {
    naviguerVers(index);
    addLog(`Clic direct sur epingle "${MARQUEURS_FICTIFS[index].label}"`);
  };

  const marqueurActuel = indexActuel >= 0 ? MARQUEURS_FICTIFS[indexActuel] : null;

  return (
    <div>
      <h2>Etape 4 - Navigation Precedent / Suivant</h2>
      <p>Nombre de marqueurs : {MARQUEURS_FICTIFS.length}</p>

      {/* Boutons de navigation */}
      <button
        onClick={handlePrecedent}
        // Desactive si on est au premier marqueur ou aucun selectionne
        disabled={indexActuel <= 0}
      >
        Precedent
      </button>

      <button
        onClick={handleSuivant}
        // Desactive si on est au dernier marqueur
        disabled={indexActuel === MARQUEURS_FICTIFS.length - 1}
        style={{ marginLeft: "8px" }}
      >
        Suivant
      </button>

      {/* Etat actuel */}
      <p>Marqueur actuel : {marqueurActuel ? `${marqueurActuel.label} (${marqueurActuel.timecode}s)` : "aucun"}</p>
      <p>Index actuel : {indexActuel === -1 ? "aucun" : `${indexActuel + 1} / ${MARQUEURS_FICTIFS.length}`}</p>
      <p>currentTime simule : {currentTime}s</p>

      {/* Timeline visuelle avec epingles cliquables */}
      <h3>Timeline - clique sur une epingle pour naviguer directement</h3>

      <div style={{
        position: "relative",
        width: "100%",
        height: "8px",
        background: "#ccc",
        marginTop: "30px",
        marginBottom: "30px",
      }}>
        {MARQUEURS_FICTIFS.map((m, index) => {
          const position = calculerPosition(m.timecode);
          const estSelectionne = index === indexActuel;
          return (
            <div
              key={m.id}
              onClick={() => handleClicEpingle(index)}
              title={m.label}
              style={{
                position: "absolute",
                left: `${position}%`,
                transform: "translateX(-50%)",
                top: "-6px",
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                // Rouge si selectionne, bleu sinon
                background: estSelectionne ? "red" : "blue",
                cursor: "pointer",
              }}
            />
          );
        })}
      </div>

      {/* Liste des marqueurs avec indication du marqueur actuel */}
      <h3>Liste des marqueurs</h3>
      {MARQUEURS_FICTIFS.map((m, index) => (
        <p
          key={m.id}
          onClick={() => handleClicEpingle(index)}
          style={{
            cursor: "pointer",
            // On met en gras le marqueur actuel
            fontWeight: index === indexActuel ? "bold" : "normal",
            color: "black",
          }}
        >
          {index === indexActuel ? ">> " : ""}{m.label} - {m.timecode}s
        </p>
      ))}

      {/* Zone de logs */}
      <h3>Logs</h3>
      {log.length === 0 && <p>Aucun log pour linstant</p>}
      {log.map((l, i) => (
        <p key={i}>{l}</p>
      ))}

      {/* Ce que tu dois verifier */}
      <h3>Ce que tu dois verifier</h3>
      <p>1. Cliquer Suivant plusieurs fois passe bien de A vers B vers C vers D vers E dans l ordre</p>
      <p>2. Cliquer Precedent revient bien en arriere</p>
      <p>3. Le bouton Precedent est desactive quand on est sur le premier marqueur</p>
      <p>4. Le bouton Suivant est desactive quand on est sur le dernier marqueur</p>
      <p>5. Cliquer directement sur une epingle navigue vers ce marqueur</p>
      <p>6. Le marqueur actuel est en rouge sur la timeline et en gras dans la liste</p>
    </div>
  );
}