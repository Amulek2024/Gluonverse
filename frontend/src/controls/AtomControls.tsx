import { useMemo } from "react";
import { HelpPanel } from "../components/HelpPanel";
import { useSimulationStore } from "../stores/useSimulationStore";
import {
  ELEMENTS,
  computeElectronConfiguration,
  elementByZ,
  formatElectronConfiguration,
  neutronCount
} from "../utils/elements";

const HELP_ENTRIES = [
  {
    term: "Tabla periodica",
    description:
      "Clic en cualquier elemento (Z=1 a 118) para cargarlo. Los lantanidos (Ce-Lu) y actinidos (Th-Lr) se muestran en las dos filas inferiores, como en cualquier tabla periodica estandar."
  },
  {
    term: "Configuracion electronica",
    description:
      "Calculada con el principio de Aufbau (regla de Madelung) mas Pauli y Hund, con las ~20 excepciones conocidas (Cr, Cu, La, Au, etc.) tabuladas explicitamente. Para elementos superpesados (Z>=104) es teorica/incierta."
  },
  {
    term: "Neutrones",
    description:
      "Se calculan redondeando el peso atomico estandar IUPAC y restando Z. Es el isotopo 'tipico', no necesariamente el mas abundante en la naturaleza (evita necesitar una tabla de abundancias isotopicas)."
  },
  {
    term: "Ver nucleo",
    description:
      "El nucleo se muestra a un tamano fijo, no a escala real (es ~100,000 veces mas chico que la nube electronica). Este boton salta al laboratorio de quarks para ver un proton real a su escala."
  },
  {
    term: "Nube electronica",
    description:
      "Cada electron se redibuja periodicamente muestreando la funcion de onda hidrogenoide real |psi|^2 (con carga nuclear efectiva de Slater), no sigue una orbita clasica fija."
  },
  {
    term: "Fuerzas aplicadas",
    description:
      "Atraccion de Coulomb entre el nucleo (+Ze) y cada electron (-e), la unica fuerza real en juego. La repulsion electron-electron no se simula par a par: se aproxima con el apantallamiento de Slater, que reduce la carga nuclear a una Z efectiva mas baja para cada electron (mientras mas apantallado, mayor el radio del orbital, radio = n^2*a0/Z_efectiva). No hay integracion tipo Verlet como en el laboratorio de quarks: el electron no 'vuela' siguiendo una fuerza neta, la nube visualiza directamente la densidad de probabilidad |psi|^2 del estado estacionario, que ya es la solucion de esas fuerzas en equilibrio."
  }
];

export function AtomControls({ embedded = false }: { embedded?: boolean } = {}) {
  const selectedElementZ = useSimulationStore((state) => state.selectedElementZ);
  const setSelectedElement = useSimulationStore((state) => state.setSelectedElement);

  const element = useMemo(() => elementByZ(selectedElementZ), [selectedElementZ]);
  const config = useMemo(() => computeElectronConfiguration(selectedElementZ), [selectedElementZ]);
  const neutrons = useMemo(() => neutronCount(element), [element]);
  const configLabel = useMemo(() => formatElectronConfiguration(config), [config]);

  return (
    <section className="panel controls" aria-labelledby="atom-controls-heading">
      <div className="panel-heading">
        <h2 id="atom-controls-heading">Atomos</h2>
        <span>{element.symbol} · Z={element.z}</span>
      </div>

      <div className="periodic-grid" role="grid" aria-label="Tabla periodica de elementos">
        {ELEMENTS.map((el) => (
          <button
            key={el.z}
            type="button"
            className={`periodic-cell block-${el.block}${el.z === selectedElementZ ? " selected" : ""}`}
            style={{ gridColumn: el.group, gridRow: el.period }}
            onClick={() => setSelectedElement(el.z)}
            title={`${el.name} (Z=${el.z})`}
          >
            <span className="periodic-z">{el.z}</span>
            <span className="periodic-symbol">{el.symbol}</span>
          </button>
        ))}
      </div>

      <div className="metric-grid">
        <div className="metric">
          <span>Elemento</span>
          <strong>{element.name}</strong>
        </div>
        <div className="metric">
          <span>Peso atomico</span>
          <strong>{element.standardAtomicWeight}</strong>
        </div>
        <div className="metric">
          <span>Protones</span>
          <strong>{element.z}</strong>
        </div>
        <div className="metric">
          <span>Neutrones</span>
          <strong>{neutrons}</strong>
        </div>
        <div className="metric">
          <span>Electrones</span>
          <strong>{element.z}</strong>
        </div>
        <div className="metric">
          <span>Numero masico</span>
          <strong>{element.z + neutrons}</strong>
        </div>
      </div>

      <p className="small-copy config-string">{configLabel}</p>

      <p className="small-copy">
        Modelo hibrido: nucleo construido con protones/neutrones reales (tamano no a escala),
        electrones muestreados desde la funcion de onda hidrogenoide real con carga nuclear
        efectiva (reglas de Slater). La unica fuerza real modelada es la atraccion de Coulomb
        nucleo-electron; la repulsion entre electrones se aproxima via apantallamiento, no se
        simula par a par (ver "Fuerzas aplicadas" en la guia). Ver Docs para el desglose de que
        es formula real y que es aproximacion.
      </p>

      {!embedded && <HelpPanel title="Guia del simulador de atomos" entries={HELP_ENTRIES} />}
    </section>
  );
}
