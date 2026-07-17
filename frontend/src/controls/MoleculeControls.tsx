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
    term: "Nube blanca: orbital molecular de enlace (LCAO)",
    description:
      "Para cada enlace, se combinan las amplitudes (con signo) de los dos atomos -- psi_A + psi_B, la construccion LCAO (Combinacion Lineal de Orbitales Atomicos) real y estandar -- y se muestrea la densidad resultante. Es una aproximacion: no es una solucion de Hartree-Fock/DFT, no incluye el orbital antienlazante, y solo representa la componente tipo sigma del enlace (no distingue enlaces dobles/triples, que ademas tienen componentes pi)."
  },
  {
    term: "Hibridacion sp/sp2/sp3",
    description:
      "Si un atomo tiene 2 o mas enlaces (p.ej. O en agua, N en amoniaco, C en metano), sus orbitales de valencia se combinan primero en hibridos sp/sp2/sp3 antes de formar el enlace -- formulas reales y estandar de quimica cuantica introductoria. El tipo de hibridacion se INFIERE del angulo real entre los enlaces de ese atomo (cercano a 180 grados -> sp, a 120 -> sp2, a 109.5 -> sp3), no de una tabla fija por molecula."
  },
  {
    term: "Que NO calcula el modelo de enlace",
    description:
      "No resuelve pares solitarios como hibridos con direccion propia (las nubes atomicas normales, sin modificar, siguen mostrando esos electrones). No verifica conservacion de electrones entre la nube atomica y la nube de enlace (hay superposicion visual deliberada, no una contabilidad de probabilidad total 1). No calcula energia de enlace ni geometria de equilibrio: la geometria sigue siendo el valor experimental fijo de la molecula."
  },
  {
    term: "Orden de enlace: notacion de Lewis, aparte del orbital",
    description:
      "El numero de lineas entre dos nucleos (1, 2 o 3) sigue siendo la convencion de Lewis para enlace simple/doble/triple, una notacion de libro de texto, no una medicion de densidad de enlace real. Es independiente de la nube LCAO, que solo muestra la componente sigma sin importar el orden."
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
            <span className="swatch" style={{ backgroundColor: "#7ba7d1" }} aria-hidden="true" />
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
        Cada atomo reutiliza el modelo hibrido nucleo+nube electronica de la vista Atomos, en su
        posicion de enlace experimental fija. Ademas, cada enlace muestra un orbital molecular
        LCAO (combinacion de las amplitudes de los dos atomos, con hibridacion sp/sp2/sp3
        inferida del angulo real de enlace en atomos con 2+ enlaces). Ver Docs para el desglose
        completo de que es formula real y que es aproximacion.
      </p>

      {!embedded && <HelpPanel title="Guia del simulador de moleculas" entries={HELP_ENTRIES} />}
    </section>
  );
}
