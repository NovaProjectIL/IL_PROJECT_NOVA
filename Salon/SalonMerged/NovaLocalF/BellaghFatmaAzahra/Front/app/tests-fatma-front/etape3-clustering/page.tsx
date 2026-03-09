"use client";

// Test Etape 3 - Clustering visuel des marqueurs proches
// Objectif : verifier que quand plusieurs marqueurs sont trop proches
// ils se regroupent sous une pastille unique qui se deplie au clic

import { useState } from "react";

const DUREE_VIDEO = 300;

// Marqueurs dont certains sont volontairement tres proches pour tester le clustering
const MARQUEURS_FICTIFS = [
  { id: 1, timecode: 30,  label: "Marqueur A" },
  // Ces trois marqueurs sont tres proches - ils doivent etre groupes
  { id: 2, timecode: 90,  label: "Marqueur B" },
  { id: 3, timecode: 92,  label: "Marqueur C - proche de B" },
  { id: 4, timecode: 94,  label: "Marqueur D - proche de B et C" },
  // Celui-ci est isole
  { id: 5, timecode: 200, label: "Marqueur E - isole" },
  // Ces deux-ci sont proches
  { id: 6, timecode: 260, label: "Marqueur F" },
  { id: 7, timecode: 262, label: "Marqueur G - proche de F" },
];

// Seuil en secondes : si deux marqueurs sont a moins de 10s l un de l autre
// ils sont consideres comme proches et doivent etre groupes
const SEUIL_CLUSTERING_SECONDES = 10;

// Type pour un groupe de marqueurs
type Groupe = {
  marqueurs: typeof MARQUEURS_FICTIFS;
  timecodeRepresentant: number;
};

// Fonction qui groupe les marqueurs proches
// Elle parcourt les marqueurs tries par timecode et les regroupe si la distance est inferieure au seuil
const grouperMarqueurs = (marqueurs: typeof MARQUEURS_FICTIFS): Groupe[] => {
  // On trie d abord par timecode
  const tries = [...marqueurs].sort((a, b) => a.timecode - b.timecode);
  const groupes: Groupe[] = [];
  let i = 0;

  while (i < tries.length) {
    const groupe: typeof MARQUEURS_FICTIFS = [tries[i]];
    let j = i + 1;

    // On ajoute au groupe tous les marqueurs suivants qui sont proches du premier du groupe
    while (j < tries.length && tries[j].timecode - tries[i].timecode < SEUIL_CLUSTERING_SECONDES) {
      groupe.push(tries[j]);
      j++;
    }

    groupes.push({
      marqueurs: groupe,
      // Le representant du groupe est le timecode du premier marqueur
      timecodeRepresentant: tries[i].timecode,
    });

    i = j;
  }

  return groupes;
};

export default function TestClustering() {

  // Stocke l id du groupe dont la liste est depliee
  const [groupeDeplie, setGroupeDeplie] = useState<number | null>(null);

  // Stocke les logs
  const [log, setLog] = useState<string[]>([]);

  const addLog = (msg: string) => {
    setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);
  };

  // Calcule la position en pourcentage sur la timeline
  const calculerPosition = (timecode: number): number => {
    return (timecode / DUREE_VIDEO) * 100;
  };

  // Quand on clique sur une pastille de groupe
  const handleClicGroupe = (groupe: Groupe, index: number) => {
    if (groupe.marqueurs.length === 1) {
      // Un seul marqueur dans le groupe : comportement normal
      addLog(`Clic sur marqueur isole "${groupe.marqueurs[0].label}" a ${groupe.timecodeRepresentant}s`);
      setGroupeDeplie(null);
    } else {
      // Plusieurs marqueurs : on deplie ou replie la liste
      if (groupeDeplie === index) {
        setGroupeDeplie(null);
        addLog(`Groupe a ${groupe.timecodeRepresentant}s replie`);
      } else {
        setGroupeDeplie(index);
        addLog(`Groupe de ${groupe.marqueurs.length} marqueurs deplie a ${groupe.timecodeRepresentant}s`);
      }
    }
  };

  const groupes = grouperMarqueurs(MARQUEURS_FICTIFS);

  return (
    <div>
      <h2>Etape 3 - Clustering visuel des marqueurs proches</h2>
      <p>Seuil de clustering : {SEUIL_CLUSTERING_SECONDES}s</p>
      <p>Marqueurs total : {MARQUEURS_FICTIFS.length}</p>
      <p>Groupes formes : {groupes.length}</p>

      {/* Tableau de verification du clustering */}
      <h3>Groupes formes par l algorithme</h3>
      <table>
        <thead>
          <tr>
            <th>Groupe</th>
            <th>Nombre de marqueurs</th>
            <th>Marqueurs inclus</th>
            <th>Affichage attendu</th>
          </tr>
        </thead>
        <tbody>
          {groupes.map((g, i) => (
            <tr key={i}>
              <td>Groupe {i + 1}</td>
              <td>{g.marqueurs.length}</td>
              <td>{g.marqueurs.map(m => m.label).join(", ")}</td>
              <td>{g.marqueurs.length === 1 ? "epingle simple" : `pastille "${g.marqueurs.length}"`}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Timeline visuelle avec clustering */}
      <h3>Timeline visuelle avec clustering</h3>
      <p>Clique sur une pastille pour la deplier</p>

      <div style={{
        position: "relative",
        width: "100%",
        height: "8px",
        background: "#ccc",
        marginTop: "40px",
        marginBottom: "60px",
      }}>
        {groupes.map((groupe, index) => {
          const position = calculerPosition(groupe.timecodeRepresentant);
          const estGroupe = groupe.marqueurs.length > 1;
          const estDeplie = groupeDeplie === index;

          return (
            <div key={index}>
              {/* La pastille ou epingle sur la timeline */}
              <div
                onClick={() => handleClicGroupe(groupe, index)}
                title={estGroupe ? `${groupe.marqueurs.length} marqueurs groupes` : groupe.marqueurs[0].label}
                style={{
                  position: "absolute",
                  left: `${position}%`,
                  transform: "translateX(-50%)",
                  top: "-10px",
                  width: estGroupe ? "28px" : "20px",
                  height: estGroupe ? "28px" : "20px",
                  borderRadius: "50%",
                  // Couleur differente si groupe ou isole
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
                {/* On affiche le nombre de marqueurs si groupe */}
                {estGroupe ? groupe.marqueurs.length : ""}
              </div>

              {/* Liste depliee quand on clique sur un groupe */}
              {estGroupe && estDeplie && (
                <div style={{
  position: "absolute",
  left: `${position}%`,
  top: "20px",
  background: "white",
  border: "1px solid black",
  padding: "4px",
  zIndex: 10,
  minWidth: "150px",
  color: "black",
}}>
                  {groupe.marqueurs.map(m => (
                    <div
                      key={m.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        addLog(`Marqueur selectionne dans groupe : "${m.label}" a ${m.timecode}s`);
                      }}
                      style={{ cursor: "pointer", padding: "2px" }}
                    >
                      {m.label} ({m.timecode}s)
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Graduations */}
      <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
        <span>0s</span>
        <span>75s</span>
        <span>150s</span>
        <span>225s</span>
        <span>300s</span>
      </div>

      {/* Zone de logs */}
      <h3>Logs</h3>
      {log.length === 0 && <p>Aucun log pour linstant</p>}
      {log.map((l, i) => (
        <p key={i}>{l}</p>
      ))}

      {/* Ce que tu dois verifier */}
      <h3>Ce que tu dois verifier</h3>
      <p>1. Le tableau montre 4 groupes formes (A isole, BCD groupes, E isole, FG groupes)</p>
      <p>2. Les epingles isolees sont en bleu, les pastilles groupees en orange</p>
      <p>3. Les pastilles groupees affichent le bon nombre (3 pour BCD, 2 pour FG)</p>
      <p>4. Cliquer sur une pastille orange deplie la liste des marqueurs</p>
      <p>5. Cliquer sur un marqueur dans la liste depliee affiche ses infos dans les logs</p>
      <p>6. Cliquer a nouveau sur la pastille replie la liste</p>
    </div>
  );
}