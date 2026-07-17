import { Pause, Play, RotateCcw, Trash2, X } from "lucide-react";
import { HelpPanel } from "../components/HelpPanel";
import { ELEMENTS, elementByZ } from "../utils/elements";
import { MAX_SANDBOX_ATOMS, useAtomSandboxStore } from "../stores/useAtomSandboxStore";

const HELP_ENTRIES = [
  {
    term: "Que hace este sandbox",
    description:
      "Clic en cualquier elemento de la tabla periodica para agregar un atomo de ese tipo a la escena, en una posicion aleatoria. Cada atomo reutiliza el mismo modelo hibrido nucleo+nube electronica de la vista Atomos. A diferencia de Moleculas (geometria fija experimental), aqui las posiciones evolucionan segun una fisica de interaccion en vivo."
  },
  {
    term: "Que fuerza se simula (y cual no)",
    description:
      "Un potencial de Lennard-Jones: repulsion fuerte de muy corto alcance (las nubes electronicas no se solapan) mas atraccion que acerca a los atomos a una distancia de equilibrio. Si NINGUNO de los dos atomos es un gas noble, esa distancia se parametriza con radios covalentes reales (mas cercana, tipo enlace); si alguno es gas noble, se usa la distancia de van der Waals real (mas lejana, tipo contacto no enlazante). En ningun caso hay transferencia de carga, calculo de orbitales moleculares, ni energia de enlace real -- es un mismo potencial generico usado como sustituto declarado en ambos regimenes."
  },
  {
    term: "Enlaces detectados (heuristica geometrica)",
    description:
      "La linea verde entre dos atomos aparece cuando su distancia real es menor a la suma de sus radios covalentes por un factor de tolerancia (1.3x), la misma tecnica de 'percepcion de enlaces por distancia' que usan herramientas de quimica computacional (OpenBabel, RDKit, ASE) para inferir enlaces a partir de solo coordenadas. Es geometria pura: NO verifica cuanta valencia le queda disponible a cada atomo (podria aparecer 'enlazado' con mas vecinos de los que su valencia real permite), NO distingue enlace covalente de ionico, y NO determina el orden de enlace (simple/doble/triple) -- cada enlace detectado se dibuja igual. Los gases nobles nunca se marcan como enlazados."
  },
  {
    term: "Por que epsilon es uniforme",
    description:
      "La profundidad del pozo de energia (epsilon) es la MISMA constante para cualquier par de elementos, sea o no 'enlazable'. La energia de enlace/dispersion real varia en ordenes de magnitud segun el par especifico, dato que no esta tabulado en este simulador -- es una simplificacion declarada, no un valor por-par medido."
  },
  {
    term: "Radios covalentes y de van der Waals",
    description:
      "Ambas tablas son datos reales medidos, no inventados: radios covalentes de Cordero et al. (2008) y radios de van der Waals de Bondi (1964). Para elementos sin valor tabulado (la mayoria de metales de transicion pesados, lantanidos/actinidos) se usa un estimado generico por periodo, declarado como extrapolacion."
  },
  {
    term: "Amortiguamiento",
    description:
      "Sin el, el sistema oscilaria para siempre alrededor del punto de equilibrio (como un LJ real sin disipacion). El amortiguamiento remueve una fraccion de la velocidad en cada paso: es una ayuda numerica/visual para que los atomos se asienten, no una fuerza de friccion real."
  },
  {
    term: "Tope de atomos",
    description: `Cada atomo dibuja un nucleo y una nube electronica con muestreo periodico (el mismo costo que en la vista Atomos) -- se limita a ${MAX_SANDBOX_ATOMS} atomos para mantener la simulacion fluida.`
  }
];

export function AtomSandboxControls({ embedded = false }: { embedded?: boolean } = {}) {
  const atoms = useAtomSandboxStore((state) => state.atoms);
  const params = useAtomSandboxStore((state) => state.params);
  const paused = useAtomSandboxStore((state) => state.paused);
  const speed = useAtomSandboxStore((state) => state.speed);
  const setParams = useAtomSandboxStore((state) => state.setParams);
  const setSpeed = useAtomSandboxStore((state) => state.setSpeed);
  const togglePaused = useAtomSandboxStore((state) => state.togglePaused);
  const addAtom = useAtomSandboxStore((state) => state.addAtom);
  const removeAtom = useAtomSandboxStore((state) => state.removeAtom);
  const clearAll = useAtomSandboxStore((state) => state.clearAll);
  const resetCamera = useAtomSandboxStore((state) => state.resetCamera);

  const atCapacity = atoms.length >= MAX_SANDBOX_ATOMS;

  return (
    <section className="panel controls" aria-labelledby="sandbox-controls-heading">
      <div className="panel-heading">
        <h2 id="sandbox-controls-heading">Interacciones</h2>
        <span>
          {atoms.length}/{MAX_SANDBOX_ATOMS} atomos
        </span>
      </div>

      <div className="periodic-grid" role="grid" aria-label="Agregar atomo de la tabla periodica">
        {ELEMENTS.map((el) => (
          <button
            key={el.z}
            type="button"
            className={`periodic-cell block-${el.block}`}
            style={{ gridColumn: el.group, gridRow: el.period }}
            onClick={() => addAtom(el.z)}
            disabled={atCapacity}
            title={atCapacity ? `Tope de ${MAX_SANDBOX_ATOMS} atomos alcanzado` : `Agregar ${el.name} (Z=${el.z})`}
          >
            <span className="periodic-z">{el.z}</span>
            <span className="periodic-symbol">{el.symbol}</span>
          </button>
        ))}
      </div>

      <div className="particle-list" role="listbox" aria-label="Atomos en el sandbox">
        {atoms.length === 0 && <p className="small-copy">Sin atomos todavia. Clic en un elemento arriba para agregar el primero.</p>}
        {atoms.map((atom) => {
          const element = elementByZ(atom.z);
          return (
            <button key={atom.id} type="button" className="particle-row" onClick={() => removeAtom(atom.id)} title="Quitar este atomo">
              <span className="swatch" style={{ backgroundColor: "#7ba7d1" }} aria-hidden="true" />
              <span>
                <strong>{element.symbol}</strong>
                <small>{element.name}</small>
              </span>
              <span className="mono">
                <X size={14} aria-hidden="true" />
              </span>
            </button>
          );
        })}
      </div>

      <div className="control-grid">
        <label>
          Atraccion (epsilon)
          <input
            type="number"
            min="0.2"
            max="10"
            step="0.1"
            value={params.attractionStrength}
            onChange={(event) => setParams({ attractionStrength: Number(event.target.value) })}
          />
        </label>
        <label>
          Amortiguamiento
          <input
            type="number"
            min="0"
            max="0.15"
            step="0.005"
            value={params.damping}
            onChange={(event) => setParams({ damping: Number(event.target.value) })}
          />
        </label>
        <label>
          Velocidad
          <input
            type="number"
            min="0.1"
            max="4"
            step="0.1"
            value={speed}
            onChange={(event) => setSpeed(Number(event.target.value))}
          />
        </label>
      </div>

      <div className="toolbar toolbar-grid">
        <button type="button" onClick={togglePaused}>
          {paused ? <Play size={16} /> : <Pause size={16} />} {paused ? "Reanudar" : "Pausar"}
        </button>
        <button type="button" onClick={clearAll}>
          <Trash2 size={16} /> Vaciar
        </button>
        <button type="button" onClick={resetCamera}>
          <RotateCcw size={16} /> Camara
        </button>
      </div>

      <p className="small-copy">
        Potencial de Lennard-Jones con dos regimenes de distancia de equilibrio (radios
        covalentes reales si el par puede enlazar, van der Waals si alguno es gas noble), epsilon
        uniforme para todo par, y deteccion de enlaces por proximidad geometrica (heuristica
        estandar de percepcion de enlaces, sin verificar valencia disponible ni determinar orden
        de enlace). Ver Docs para el desglose completo de que es formula real y que es
        aproximacion.
      </p>

      {!embedded && <HelpPanel title="Guia del sandbox de interacciones" entries={HELP_ENTRIES} />}
    </section>
  );
}
