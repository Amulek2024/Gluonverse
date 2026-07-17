import { useMemo } from "react";
import { HelpPanel } from "../components/HelpPanel";
import { useSimulationStore } from "../stores/useSimulationStore";
import { elementByZ, neutronCount } from "../utils/elements";
import { MOLECULES, moleculeById } from "../utils/molecules";

const HELP_ENTRIES = [
  {
    term: "Que representa cada atomo",
    description:
      "Cada atomo de la molecula usa el mismo modelo hibrido de la vista Atomos: nucleo real (protones/neutrones) mas nube electronica muestreada de la funcion de onda hidrogenoide real con carga nuclear efectiva de Slater. Son atomos reales reutilizados, no una molecula dibujada desde cero."
  },
  {
    term: "Geometria de la molecula",
    description:
      "Las posiciones de los atomos (longitudes y angulos de enlace, p.ej. H-O-H = 104.5 grados en el agua) son valores experimentales tabulados de quimica estandar, no el resultado de una simulacion de fuerzas de enlace ni de un calculo de estructura electronica molecular."
  },
  {
    term: "Por que la nube no cambia de forma entre atomos vecinos",
    description:
      "En una molecula real los orbitales atomicos se combinan en orbitales moleculares compartidos entre nucleos (enlaces covalentes). Este simulador NO calcula orbitales moleculares: cada nube sigue siendo la del atomo aislado, solo trasladada a su posicion de enlace. Es una simplificacion visual explicita."
  },
  {
    term: "Orden de enlace",
    description:
      "El numero de lineas entre dos nucleos (1, 2 o 3) es la convencion de Lewis para enlace simple/doble/triple, una notacion de libro de texto, no una medicion de densidad de enlace real."
  }
];

export function MoleculeControls({ embedded = false }: { embedded?: boolean } = {}) {
  const selectedMoleculeId = useSimulationStore((state) => state.selectedMoleculeId);
  const setSelectedMolecule = useSimulationStore((state) => state.setSelectedMolecule);

  const molecule = useMemo(() => moleculeById(selectedMoleculeId), [selectedMoleculeId]);
  const totalElectrons = useMemo(() => molecule.atoms.reduce((sum, atom) => sum + atom.z, 0), [molecule]);
  const totalNeutrons = useMemo(
    () => molecule.atoms.reduce((sum, atom) => sum + neutronCount(elementByZ(atom.z)), 0),
    [molecule]
  );
  const molarMass = useMemo(
    () => molecule.atoms.reduce((sum, atom) => sum + elementByZ(atom.z).standardAtomicWeight, 0),
    [molecule]
  );

  return (
    <section className="panel controls" aria-labelledby="molecule-controls-heading">
      <div className="panel-heading">
        <h2 id="molecule-controls-heading">Moleculas</h2>
        <span>{molecule.formula}</span>
      </div>

      <div className="particle-list" role="listbox" aria-label="Moleculas disponibles">
        {MOLECULES.map((mol) => (
          <button
            key={mol.id}
            type="button"
            className={`particle-row${mol.id === selectedMoleculeId ? " selected" : ""}`}
            onClick={() => setSelectedMolecule(mol.id)}
          >
            <span className="swatch" style={{ backgroundColor: "#4dd0e1" }} aria-hidden="true" />
            <span>
              <strong>{mol.formula}</strong>
              <small>{mol.name}</small>
            </span>
            <span className="mono">{mol.atoms.length} at.</span>
          </button>
        ))}
      </div>

      <div className="metric-grid">
        <div className="metric">
          <span>Nombre</span>
          <strong>{molecule.name}</strong>
        </div>
        <div className="metric">
          <span>Atomos</span>
          <strong>{molecule.atoms.length}</strong>
        </div>
        <div className="metric">
          <span>Enlaces</span>
          <strong>{molecule.bonds.length}</strong>
        </div>
        <div className="metric">
          <span>Electrones totales</span>
          <strong>{totalElectrons}</strong>
        </div>
        <div className="metric">
          <span>Neutrones totales</span>
          <strong>{totalNeutrons}</strong>
        </div>
        <div className="metric">
          <span>Masa molar aprox.</span>
          <strong>{molarMass.toFixed(2)} g/mol</strong>
        </div>
      </div>

      <p className="small-copy">
        Cada atomo reutiliza el mismo modelo hibrido nucleo+nube electronica de la vista
        Atomos. La geometria (longitudes y angulos de enlace) es un valor experimental fijo por
        molecula, no una simulacion de fuerzas de enlace ni un calculo de orbitales
        moleculares. Ver Docs para el desglose completo de que es formula real y que es
        aproximacion.
      </p>

      {!embedded && <HelpPanel title="Guia del simulador de moleculas" entries={HELP_ENTRIES} />}
    </section>
  );
}
