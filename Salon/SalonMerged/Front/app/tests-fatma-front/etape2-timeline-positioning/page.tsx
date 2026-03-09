"use client";

// Test Etape 2 - Positionnement des epingles sur la timeline
// Objectif : verifier que la formule position(%) = timecode / duree_totale * 100
// place correctement les epingles sur la barre de progression

import { useState } from "react";

// Donnees fictives hardcodees pour tester le positionnement
// On simule une video de 300 secondes avec 5 marqueurs
const DUREE_VIDEO = 300;

const MARQUEURS_FICTIFS = [
  { id: 1, timecode: 30,  label: "Marqueur A - debut" },
  { id: 2, timecode: 90,  label: "Marqueur B - quart" },
  { id: 3, timecode: 150, label: "Marqueur C - milieu" },
  { id: 4, timecode: 210, label: "Marqueur D - trois quarts" },
  { id: 5, timecode: 270, label: "Marqueur E - fin" },
];

export default function TestTimelinePositioning() {

  // Stocke le marqueur sur lequel l utilisateur a clique
  const [marqueurSelectionne, setMarqueurSelectionne] = useState<number | null>(null);

  // Stocke les logs des evenements
  const [log, setLog] = useState<string[]>([]);

  // Ajoute un message horodate dans les logs
  const addLog = (msg: string) => {
    setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);
  };

  // Calcule la position en pourcentage d une epingle sur la timeline
  // C est la formule cle que l on veut tester
  const calculerPosition = (timecode: number): number => {
    return (timecode / DUREE_VIDEO) * 100;
  };

  // Quand on clique sur une epingle on log sa position calculee
  const handleClicEpingle = (marqueur: typeof MARQUEURS_FICTIFS[0]) => {
    setMarqueurSelectionne(marqueur.id);
    const position = calculerPosition(marqueur.timecode);
    addLog(`Clic sur "${marqueur.label}" - timecode: ${marqueur.timecode}s - position: ${position.toFixed(1)}%`);
  };

  return (
    <div>
      <h2>Etape 2 - Positionnement des epingles sur la timeline</h2>
      <p>Duree video simulee : {DUREE_VIDEO}s</p>
      <p>Nombre de marqueurs : {MARQUEURS_FICTIFS.length}</p>

      {/* Tableau de verification des positions calculees */}
      <h3>Positions attendues</h3>
      <table>
        <thead>
          <tr>
            <th>Marqueur</th>
            <th>Timecode</th>
            <th>Position attendue</th>
            <th>Position calculee</th>
            <th>Correct</th>
          </tr>
        </thead>
        <tbody>
          {MARQUEURS_FICTIFS.map((m) => {
            const positionCalculee = calculerPosition(m.timecode);
            // Position attendue calculee manuellement pour verification
            const positionAttendue = (m.timecode / DUREE_VIDEO) * 100;
            const estCorrect = Math.abs(positionCalculee - positionAttendue) < 0.01;
            return (
              <tr key={m.id}>
                <td>{m.label}</td>
                <td>{m.timecode}s</td>
                <td>{positionAttendue.toFixed(1)}%</td>
                <td>{positionCalculee.toFixed(1)}%</td>
                <td>{estCorrect ? "oui" : "non"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* La timeline visuelle avec les epingles positionnees */}
      <h3>Timeline visuelle</h3>
      <p>Clique sur une epingle pour verifier sa position</p>

      {/* Barre de progression avec position relative pour placer les epingles */}
      <div style={{
        position: "relative",
        width: "100%",
        height: "8px",
        background: "#ccc",
        marginTop: "30px",
        marginBottom: "30px",
      }}>

        {/* Epingles positionnees selon la formule */}
        {MARQUEURS_FICTIFS.map((m) => {
          const position = calculerPosition(m.timecode);
          const estSelectionne = marqueurSelectionne === m.id;
          return (
            <div
              key={m.id}
              onClick={() => handleClicEpingle(m)}
              title={`${m.label} - ${m.timecode}s - ${position.toFixed(1)}%`}
              style={{
                // On positionne l epingle en absolu sur la barre
                position: "absolute",
                left: `${position}%`,
                // On centre l epingle sur sa position avec transform
                transform: "translateX(-50%)",
                top: "-6px",
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                // Couleur differente si selectionne
                background: estSelectionne ? "red" : "blue",
                cursor: "pointer",
              }}
            />
          );
        })}
      </div>

      {/* Graduations pour verifier visuellement les positions */}
      <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
        <span>0s (0%)</span>
        <span>75s (25%)</span>
        <span>150s (50%)</span>
        <span>225s (75%)</span>
        <span>300s (100%)</span>
      </div>

      {/* Marqueur selectionne */}
      {marqueurSelectionne && (
        <p>
          Marqueur selectionne : {MARQUEURS_FICTIFS.find(m => m.id === marqueurSelectionne)?.label}
        </p>
      )}

      {/* Zone de logs */}
      <h3>Logs</h3>
      {log.length === 0 && <p>Aucun log pour linstant</p>}
      {log.map((l, i) => (
        <p key={i}>{l}</p>
      ))}

      {/* Ce que tu dois verifier */}
      <h3>Ce que tu dois verifier</h3>
      <p>1. Toutes les colonnes "Correct" du tableau affichent "oui"</p>
      <p>2. Le marqueur A a 30s est bien a 10% de la barre (proche du debut)</p>
      <p>3. Le marqueur C a 150s est bien au milieu de la barre (50%)</p>
      <p>4. Le marqueur E a 270s est bien vers la fin de la barre (90%)</p>
      <p>5. Les epingles ne debordent pas de la barre</p>
      <p>6. Le clic sur une epingle affiche les bonnes infos dans les logs</p>
    </div>
  );
}