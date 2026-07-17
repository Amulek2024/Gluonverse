import { useEffect, useMemo, useState } from "react";
import React from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  Archive,
  Atom,
  BookOpen,
  Boxes,
  BrainCircuit,
  FlaskConical,
  GitCompare,
  Home,
  Network,
  Orbit,
  PauseCircle,
  Waves
} from "lucide-react";
import { EnergyChart } from "./components/EnergyChart";
import { ObservablesPanel } from "./components/ObservablesPanel";
import { ParticlePanel } from "./components/ParticlePanel";
import { ScientificNotice } from "./components/ScientificNotice";
import { AtomControls } from "./controls/AtomControls";
import { LatticeControls } from "./controls/LatticeControls";
import { SimulationControls } from "./controls/SimulationControls";
import { GravityControls } from "./controls/GravityControls";
import { MoleculeControls } from "./controls/MoleculeControls";
import { health, listSimulations } from "./api/client";
import { useSimulationStore } from "./stores/useSimulationStore";
import { AtomScene } from "./scenes/AtomScenePlaceholder";
import { GluonScene } from "./scenes/GluonScenePlaceholder";
import { LatticeScene } from "./scenes/LatticeScenePlaceholder";
import { GravityScene } from "./scenes/GravityScenePlaceholder";
import { MoleculeScene } from "./scenes/MoleculeScenePlaceholder";
import type { ViewId } from "./types/physics";

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error?: Error }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error("Error boundary caught:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "20px", color: "red", fontFamily: "monospace", whiteSpace: "pre-wrap" }}>
          <h2>Error de renderizado</h2>
          <code>{this.state.error?.message}</code>
          <p>Revisa la consola del navegador para más detalles.</p>
        </div>
      );
    }

    return this.props.children;
  }
}

const navItems: Array<{ id: ViewId; label: string; icon: typeof Home }> = [
  { id: "inicio", label: "Inicio", icon: Home },
  { id: "laboratorio", label: "Laboratorio", icon: FlaskConical },
  { id: "lattice", label: "Lattice", icon: Network },
  { id: "atomos", label: "Atomos", icon: Atom },
  { id: "moleculas", label: "Moleculas", icon: Boxes },
  { id: "gravedad", label: "Gravedad", icon: Orbit },
  { id: "comparador", label: "Comparador", icon: GitCompare },
  { id: "historial", label: "Historial", icon: Archive },
  { id: "documentacion", label: "Docs", icon: BookOpen }
];

function TopNav() {
  const { activeView, setView, backendOnline, backendMessage } = useSimulationStore();
  return (
    <header className="topbar">
      <button className="brand" type="button" onClick={() => setView("inicio")}>
        <span className="brand-mark">G</span>
        <span>
          <strong>Gluonverse</strong>
          <small>QCD de reticulo 4D y laboratorio visual</small>
        </span>
      </button>
      <nav aria-label="Vistas principales">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={activeView === item.id ? "active" : ""}
              type="button"
              onClick={() => setView(item.id)}
              title={item.label}
            >
              <Icon size={17} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      <div className={`backend-pill ${backendOnline ? "online" : ""}`} title={backendMessage}>
        <Activity size={15} />
        <span>{backendOnline ? "Backend online" : "Modo local"}</span>
      </div>
    </header>
  );
}

function HomeView() {
  const { setView, applyPreset } = useSimulationStore();
  return (
    <main className="home-layout">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Plataforma educativa y computacional</p>
          <h1>Gluonverse</h1>
          <p>
            Explora QCD de reticulo 4D con campos gauge SU(3) y fermiones dinamicos, junto a
            un laboratorio visual separado para intuicion sobre quarks y confinamiento.
          </p>
          <div className="hero-actions">
            <button type="button" onClick={() => setView("laboratorio")}>
              <FlaskConical size={18} /> Abrir laboratorio
            </button>
            <button
              type="button"
              onClick={() => {
                applyPreset("lattice");
                setView("lattice");
              }}
            >
              <Network size={18} /> Ejecutar QCD 4D
            </button>
          </div>
        </div>
        <div className="hero-scene" aria-label="Vista previa interactiva de particulas">
          <GluonScene
            particles={useSimulationStore.getState().particles}
            selectedId={useSimulationStore.getState().selectedParticleId}
            showFields
            reducedMotion={false}
            onSelect={() => setView("laboratorio")}
          />
        </div>
      </section>
      <ScientificNotice />
      <section className="model-strip" aria-label="Modelos disponibles">
        <article>
          <BrainCircuit size={22} />
          <h2>Visual educativo</h2>
          <p>Rapido, interactivo y etiquetado como aproximacion.</p>
        </article>
        <article>
          <Waves size={22} />
          <h2>Potencial Cornell</h2>
          <p>Modelo efectivo regularizado con integrador Velocity Verlet.</p>
        </article>
        <article>
          <Network size={22} />
          <h2>QCD de reticulo 4D</h2>
          <p>Accion de Wilson, fermiones dinamicos, Polyakov y Wilson loops.</p>
        </article>
      </section>
    </main>
  );
}

function LabView() {
  const {
    particles,
    selectedParticleId,
    showFields,
    reducedMotion,
    observables,
    energySeries,
    warnings,
    step,
    simulatedTime,
    setSelectedParticle,
    controlsSlot
  } = useSimulationStore();
  return (
    <main className="workspace lab-grid">
      <div className="left-column">
        {controlsSlot ? createPortal(<SimulationControls embedded />, controlsSlot) : <SimulationControls />}
      </div>
      <section className="stage" aria-label="Laboratorio 3D">
        <ScientificNotice />
        <div className="scene-frame">
          <GluonScene
            particles={particles}
            selectedId={selectedParticleId}
            showFields={showFields}
            reducedMotion={reducedMotion}
            onSelect={setSelectedParticle}
          />
        </div>
        <div className="status-row">
          <span>Paso {step}</span>
          <span>t = {simulatedTime.toFixed(4)}</span>
          <span>{warnings[0]}</span>
        </div>
      </section>
      <div className="right-column">
        <ObservablesPanel observables={observables} />
        <EnergyChart data={energySeries} />
        <ParticlePanel particles={particles} selectedId={selectedParticleId} onSelect={setSelectedParticle} />
      </div>
    </main>
  );
}

function LatticeView() {
  const { latticeCells, latticeSize, observables, energySeries, controlsSlot } = useSimulationStore();
  return (
    <main className="workspace lattice-grid">
      <div className="left-column">
        {controlsSlot ? createPortal(<LatticeControls embedded />, controlsSlot) : <LatticeControls />}
        <ScientificNotice scope="lattice" />
      </div>
      <section className="stage">
        <div className="scene-frame">
          <LatticeScene cells={latticeCells} size={latticeSize} />
        </div>
      </section>
      <div className="right-column">
        <ObservablesPanel observables={observables} />
        <EnergyChart data={energySeries} />
      </div>
    </main>
  );
}

function AtomView() {
  const controlsSlot = useSimulationStore((state) => state.controlsSlot);
  return (
    <main className="workspace atomos-grid">
      <div className="left-column">
        {controlsSlot ? createPortal(<AtomControls embedded />, controlsSlot) : <AtomControls />}
        <ScientificNotice scope="atomos" />
      </div>
      <section className="stage" aria-label="Simulador de atomos 3D">
        <div className="scene-frame">
          <AtomScene />
        </div>
      </section>
    </main>
  );
}

function MoleculeView() {
  const controlsSlot = useSimulationStore((state) => state.controlsSlot);
  return (
    <main className="workspace moleculas-grid">
      <div className="left-column">
        {controlsSlot ? createPortal(<MoleculeControls embedded />, controlsSlot) : <MoleculeControls />}
        <ScientificNotice scope="moleculas" />
      </div>
      <section className="stage" aria-label="Simulador de moleculas 3D">
        <div className="scene-frame">
          <MoleculeScene />
        </div>
      </section>
    </main>
  );
}

function GravityView() {
  const controlsSlot = useSimulationStore((state) => state.controlsSlot);
  return (
    <main className="workspace gravedad-grid">
      <div className="left-column">
        {controlsSlot ? createPortal(<GravityControls embedded />, controlsSlot) : <GravityControls />}
        <ScientificNotice scope="gravedad" />
      </div>
      <section className="stage" aria-label="Sandbox de gravedad N-body">
        <div className="scene-frame">
          <GravityScene />
        </div>
      </section>
    </main>
  );
}

function CompareView() {
  const { energySeries, potential, dt, latticeBeta } = useSimulationStore();
  const comparison = useMemo(
    () =>
      energySeries.map((point) => ({
        ...point,
        conservative: point.total,
        fasterStep: point.total * (1 + Math.min(0.08, dt * 20)),
        latticeLike: (point.total || 1) * (1 + (latticeBeta - 5.5) * 0.01)
      })),
    [energySeries, dt, latticeBeta]
  );
  return (
    <main className="workspace single-view">
      <section className="panel">
        <div className="panel-heading">
          <h1>Comparador</h1>
          <span>dos ejecuciones o escenarios</span>
        </div>
        <p className="small-copy">
          El MVP compara trazas recientes del laboratorio. Para comparaciones cientificas,
          exporta CSV/HDF5 y repite con la misma semilla.
        </p>
        <EnergyChart data={comparison} />
        <div className="comparison-table">
          <div><span>dt actual</span><strong>{dt}</strong></div>
          <div><span>a Cornell</span><strong>{potential.coulomb_strength}</strong></div>
          <div><span>b Cornell</span><strong>{potential.string_tension}</strong></div>
          <div><span>beta lattice</span><strong>{latticeBeta}</strong></div>
        </div>
      </section>
    </main>
  );
}

function HistoryView() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    listSimulations()
      .then(setRows)
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudo cargar historial"));
  }, []);

  return (
    <main className="workspace single-view">
      <section className="panel">
        <div className="panel-heading">
          <h1>Historial</h1>
          <span>{rows.length} simulaciones</span>
        </div>
        {error && <p className="error-text">{error}</p>}
        <div className="history-list">
          {rows.map((row) => (
            <article key={String(row.simulation_id)} className="history-row">
              <strong>{String(row.name)}</strong>
              <span>{String(row.model)}</span>
              <span>{String(row.status)}</span>
              <span className="mono">{String(row.simulation_id)}</span>
            </article>
          ))}
          {!rows.length && !error && <p className="small-copy">Aun no hay simulaciones guardadas.</p>}
        </div>
      </section>
    </main>
  );
}

function DocumentationView() {
  return (
    <main className="workspace docs-view">
      <section className="panel doc-section">
        <h1>Documentacion</h1>
        <p className="small-copy">
          Esta pagina explica, sin asumir conocimiento previo, que es la cromodinamica
          cuantica (QCD), que hace cada vista de Gluonverse, y que significa cada termino
          tecnico que aparece en la interfaz (SU(3), accion de Wilson, Wilson loops, etc.).
        </p>

        <h2 className="doc-section-title">Que es QCD (cromodinamica cuantica)</h2>
        <div className="doc-grid">
          <article>
            <h3>La fuerza fuerte</h3>
            <p>
              QCD es la teoria cuantica que describe la interaccion fuerte: la fuerza que
              mantiene unidos a los quarks dentro de protones y neutrones, y que mantiene
              unidos a protones y neutrones dentro del nucleo atomico. Es, junto con el
              electromagnetismo y la fuerza debil, una de las piezas del Modelo Estandar de
              la fisica de particulas.
            </p>
          </article>
          <article>
            <h3>Quarks</h3>
            <p>
              Son las particulas fundamentales que sienten la fuerza fuerte. Vienen en seis
              "sabores" (up, down, strange, charm, bottom, top) y cada uno tiene ademas una
              "carga de color" (ver mas abajo). En la teoria real son excitaciones de campos
              cuanticos; en este MVP se modelan como estados discretos con posicion,
              velocidad y espin, suficientes para los calculos educativos que hace la app.
            </p>
          </article>
          <article>
            <h3>Gluones</h3>
            <p>
              Son los bosones gauge (mediadores de fuerza) de la interaccion fuerte,
              equivalentes al foton en electromagnetismo. A diferencia del foton, los
              gluones tambien tienen carga de color y por eso interactuan entre si, lo que
              hace que la fuerza fuerte se comporte muy distinto a la electromagnetica. Los
              tubos y flujos que se ven en el Laboratorio son metaforas visuales, no
              trayectorias reales de gluones individuales.
            </p>
          </article>
          <article>
            <h3>Carga de color</h3>
            <p>
              Es la "carga" que sienten los quarks bajo la fuerza fuerte (analoga a la carga
              electrica, pero con tres tipos en vez de dos signos): rojo, verde y azul, mas
              sus anticolores. Los objetos que se observan libremente en la naturaleza son
              siempre "neutros de color" (blancos): un baryon combina rojo+verde+azul, un
              meson combina un color con su anticolor. Esta app usa esa regla como heuristica
              educativa para reconocer mesones y bariones formados en la simulacion.
            </p>
          </article>
          <article>
            <h3>Confinamiento</h3>
            <p>
              Es el fenomeno por el cual los quarks nunca se observan aislados: si tratas de
              separarlos, la energia necesaria crece con la distancia (en vez de decaer, como
              la gravedad o el electromagnetismo) hasta que es mas favorable crear un par
              quark-antiquark nuevo que seguir separando. Se representa aqui con un potencial
              efectivo tipo Cornell (ver seccion de formulas), no con una derivacion completa
              desde QCD.
            </p>
          </article>
          <article>
            <h3>Libertad asintotica</h3>
            <p>
              Es el efecto opuesto a corta distancia: cuanto mas cerca estan los quarks entre
              si, mas debil es la fuerza fuerte entre ellos, permitiendo tratarlos casi como
              particulas libres. Es una de las razones por las que a distancias muy cortas
              (o energias muy altas) se pueden hacer calculos perturbativos, mientras que a
              distancias largas (confinamiento) hace falta QCD de reticulo.
            </p>
          </article>
        </div>

        <h2 className="doc-section-title">Las vistas de la aplicacion</h2>
        <div className="doc-grid">
          <article>
            <h3>Laboratorio</h3>
            <p>
              Simulacion educativa de un puñado de quarks/antiquarks interactuando via un
              potencial efectivo tipo Cornell (Coulomb a corta distancia + confinamiento
              lineal a larga distancia), integrada con Velocity Verlet o Leapfrog. Sirve para
              construir intuicion sobre confinamiento, formacion de mesones/bariones y
              conservacion de energia/momento. No resuelve las ecuaciones de QCD.
            </p>
          </article>
          <article>
            <h3>Lattice (QCD de reticulo)</h3>
            <p>
              Aqui si se hace un calculo real de QCD, pero en una red (reticulo) 4D
              finita y muy pequeña: se generan enlaces SU(3) sobre una malla espacio-tiempo
              discreta, se evalua la accion de Wilson, y opcionalmente el determinante
              fermionico exacto (fermiones dinamicos). Es QCD de verdad, pero en un volumen
              tan chico que no reemplaza calculos de produccion ni extrapolaciones al
              continuo. Ver la seccion "QCD de reticulo" mas abajo para el detalle de cada
              termino.
            </p>
          </article>
          <article>
            <h3>Comparador</h3>
            <p>
              Compara, en el mismo grafico, la evolucion de energia de la ultima corrida del
              Laboratorio contra dos variantes sinteticas (un paso temporal mas rapido y un
              escenario "tipo lattice") para ilustrar como cambian la deriva de energia y la
              estabilidad numerica al variar parametros. Para comparaciones cientificas reales
              se recomienda exportar CSV/HDF5 y repetir corridas con la misma semilla
              (random_seed).
            </p>
          </article>
          <article>
            <h3>Historial</h3>
            <p>
              Lista todas las simulaciones creadas en este backend (Laboratorio o Lattice),
              con su identificador, modelo y estado (creada, corriendo, completada,
              cancelada). Util para recuperar el id de una simulacion anterior y volver a
              pedir sus observables o exportarla.
            </p>
          </article>
          <article>
            <h3>Moleculas</h3>
            <p>
              Muestra moleculas pequenas (H2O, CO2, NH3, CH4, etc.) construidas con los mismos
              atomos reales de la vista Atomos, colocados en su geometria de enlace
              experimental (longitudes y angulos tabulados). No calcula orbitales moleculares
              ni fuerzas de enlace: es una composicion visual de atomos reales, no una
              simulacion de quimica cuantica molecular.
            </p>
          </article>
        </div>

        <h2 className="doc-section-title">QCD de reticulo: terminos clave</h2>
        <div className="doc-grid">
          <article>
            <h3>Reticulo (lattice) y enlaces SU(3)</h3>
            <p>
              En vez de tratar el espacio-tiempo como continuo, QCD de reticulo lo discretiza
              en una malla 4D (3 dimensiones espaciales + 1 temporal, ambas de tamaño finito,
              configurables en "Extension espacial" y "Extension temporal Nt"). En cada
              enlace (arista) entre dos puntos vecinos de la malla se coloca una matriz
              unitaria 3x3 de determinante 1 -es decir, un elemento del grupo SU(3)-, que
              representa el campo gluonico gauge en ese enlace. SU(3) es precisamente el
              grupo de simetria que define la interaccion fuerte: sus generadores son las
              "cargas de color" de las que hablabamos arriba.
            </p>
          </article>
          <article>
            <h3>Accion de Wilson</h3>
            <p>
              Es la version discretizada (para el reticulo) de la accion de Yang-Mills que
              describe la dinamica de los campos gluonicos. Se construye sumando, sobre cada
              "plaqueta" (el cuadrado minimo formado por 4 enlaces), una cantidad
              proporcional a 1 menos la parte real de la traza del producto de esos 4
              enlaces. Cuanto mas cerca esta ese producto de la identidad, menor la accion:
              fisicamente, plaquetas "planas" (poco campo) contribuyen poca energia.
            </p>
          </article>
          <article>
            <h3>Plaqueta</h3>
            <p>
              Es el ciclo cerrado mas pequeño que se puede recorrer en la red (un cuadrado de
              4 enlaces). Su valor promedio es el observable basico de la accion de Wilson y
              se reporta como "accion" o "plaqueta promedio" en los observables de Lattice.
            </p>
          </article>
          <article>
            <h3>Beta (β)</h3>
            <p>
              Es el inverso del acoplamiento de la interaccion fuerte en unidades de
              reticulo (β = 2N/g² para SU(N)). Beta alto significa acoplamiento debil (red
              mas cercana al continuo, mas "fria"); beta bajo significa acoplamiento fuerte
              (red mas desordenada). No es directamente una temperatura fisica.
            </p>
          </article>
          <article>
            <h3>Metropolis-Hastings</h3>
            <p>
              Es el algoritmo de Monte Carlo usado para generar configuraciones de enlaces
              distribuidas segun la accion de Wilson (mas fermiones, si estan activos): en
              cada iteracion se propone un cambio aleatorio a un enlace y se acepta o
              rechaza con una probabilidad que depende del cambio de accion. La "tasa de
              aceptacion" mostrada en observables indica que tan bien esta funcionando ese
              muestreo (ni muy alta ni muy baja).
            </p>
          </article>
          <article>
            <h3>Fermiones: quenched vs. dinamicos</h3>
            <p>
              "Quenched" ignora el efecto de los quarks virtuales (pares quark-antiquark que
              aparecen y desaparecen) sobre el campo gluonico: es una aproximacion mas
              barata mas rapida de calcular pero menos realista. "Dinamicos (staggered)"
              incluye el determinante fermionico exacto de dos sabores en la formulacion
              staggered, a potencial quimico cero, lo cual es mas caro computacionalmente
              pero mas fiel a QCD real.
            </p>
          </article>
          <article>
            <h3>Masa bare (am)</h3>
            <p>
              Es la masa "desnuda" del fermion en unidades de la red (adimensional, en
              unidades del espaciado de red). Solo se usa cuando hay fermiones dinamicos. No
              corresponde directamente a la masa fisica del quark sin un procedimiento de
              fijacion de escala y renormalizacion.
            </p>
          </article>
          <article>
            <h3>Wilson loop</h3>
            <p>
              Es el valor esperado de la traza del producto de enlaces alrededor de un
              rectangulo cerrado de tamaño r×t en la red. Su comportamiento (decae como
              exponencial del area para confinamiento) es una de las formas estandar de
              extraer la tension de la cuerda de confinamiento en QCD de reticulo.
            </p>
          </article>
          <article>
            <h3>Polyakov loop</h3>
            <p>
              Es la traza del producto de enlaces a lo largo de toda la direccion temporal
              (cerrada por las condiciones de frontera periodicas). Su valor esperado esta
              relacionado con la energia libre de un quark aislado y se usa como indicador
              de la transicion de confinamiento a desconfinamiento a temperatura finita.
            </p>
          </article>
          <article>
            <h3>Condensado quiral</h3>
            <p>
              Es el valor esperado ⟨ψ̄ψ⟩ del campo fermionico, un observable que mide la
              ruptura espontanea de la simetria quiral (una simetria aproximada de QCD para
              quarks livianos). Es distinto de cero incluso cuando la masa bare es pequeña,
              y es uno de los observables fermionicos que reporta el motor de reticulo.
            </p>
          </article>
        </div>

        <h2 className="doc-section-title">Laboratorio: formulas del modelo educativo</h2>
        <div className="doc-grid">
          <article>
            <h3>Potencial de Cornell</h3>
            <p>
              <code>V(r) = -a/r + b·r</code>. El termino <code>-a/r</code> es analogo al
              potencial de Coulomb (atraccion de corto alcance); el termino <code>b·r</code>{" "}
              es lineal y modela el confinamiento a larga distancia, como una cuerda elastica
              que tira de las particulas. Es un modelo efectivo de juguete, no una derivacion
              de QCD.
            </p>
          </article>
          <article>
            <h3>Softening y distancia minima</h3>
            <p>
              Para evitar que la fuerza diverja cuando dos particulas coinciden (r=0), la
              distancia real se reemplaza por <code>sqrt(r² + ε²)</code>, con un piso
              adicional (<code>min_distance</code>). Es pura regularizacion numerica. El valor
              por defecto (<code>ε=0.1</code>) no viene de ninguna tabla de fisica: se eligio
              empiricamente porque valores mas bajos (p.ej. 0.01) permiten que la fuerza de
              Coulomb se dispare demasiado en un encuentro cercano entre quarks, y un solo paso
              de Velocity Verlet no logra resolverla con precision, inyectando un salto de
              energia permanente y no fisico incluso con el paso temporal recomendado.
            </p>
          </article>
          <article>
            <h3>Masas: constituyentes, no "bare"</h3>
            <p>
              Las masas usadas para la dinamica (up ≈ 0.336 GeV, down ≈ 0.34 GeV, etc.) son las
              masas <em>constituyentes</em> del modelo de quarks, no la masa "bare" o de
              corriente (up ≈ 0.0022 GeV) que aparece en el Lagrangiano del Modelo Estandar. La
              masa constituyente es real y se usa en espectroscopia de hadrones, pero surge de
              un efecto cuantico (ruptura de simetria quiral) que este modelo no calcula: aqui
              simplemente se adopta como valor de entrada porque, al tratar los quarks como
              particulas clasicas, la masa "bare" es demasiado pequeña frente a la escala de
              fuerzas del potencial y el integrador diverge.
            </p>
          </article>
          <article>
            <h3>Repulsion de corto alcance (no-QCD)</h3>
            <p>
              El potencial de Cornell es puramente atractivo a cualquier distancia
              (<code>dV/dr ≥ 0</code> siempre), asi que nada en la formula base impide que
              dos particulas se superpongan. La casilla "Repulsion de corto alcance" agrega
              un nucleo repulsivo fenomenologico opcional solo para evitar ese traspaso
              visual; no tiene ninguna base en QCD ni en el potencial de Cornell real.
            </p>
          </article>
          <article>
            <h3>Integradores: Velocity Verlet y Leapfrog</h3>
            <p>
              Son metodos numericos para avanzar posiciones y velocidades en el tiempo dado
              un campo de fuerzas. Velocity Verlet es el estandar por su buena conservacion
              de energia a largo plazo; Leapfrog es una variante equivalente usada tambien en
              QCD de reticulo (HMC), incluida aqui para comparar.
            </p>
          </article>
        </div>

        <h2 className="doc-section-title">Que es fisica real y que es aproximacion pedagogica</h2>
        <div className="doc-grid">
          <article>
            <h3>Fisica real / establecida</h3>
            <p>
              El potencial de Cornell <code>V(r) = -a/r + b·r</code> es un potencial
              fenomenologico genuino, usado desde los años 70 (Eichten et al.) para describir el
              espectro del charmonium y bottomonium: no es una invencion de esta app. Las cargas
              electricas (up/charm/top = +2/3, down/strange/bottom = -1/3), el numero
              barionico, el spin 1/2 y las masas constituyentes de los quarks tambien son
              valores del Modelo Estandar / modelo de quarks constituyentes, no inventados.
              Velocity Verlet y Leapfrog son integradores numericos estandar.
            </p>
          </article>
          <article>
            <h3>Simplificacion pedagogica declarada</h3>
            <p>
              Tratar los quarks como particulas clasicas con posicion y velocidad definidas en
              cada instante <strong>no es como funciona la QCD real</strong>: la QCD es una
              teoria cuantica de campos, los quarks no tienen trayectorias clasicas. Este modelo
              es analogo a enseñar el modelo de Bohr del atomo: ilustrativo, no una derivacion
              de primeros principios. Sobre esa base clasica se apoyan ademas: el valor exacto
              de softening, el nucleo repulsivo opcional (marcado explicitamente "no-QCD"), y el
              tamaño visual de cada particula (convencion estetica basada en masa, no un radio
              fisico real: los quarks no tienen radio medido).
            </p>
          </article>
        </div>

        <h2 className="doc-section-title">Simulador de atomos: que es real y que es aproximacion</h2>
        <div className="doc-grid">
          <article>
            <h3>Funcion de onda hidrogenoide real</h3>
            <p>
              La posicion de cada electron se muestrea de <code>|psi_nlm(r,θ,φ)|²</code>,
              usando la parte radial exacta (polinomios de Laguerre asociados) y los
              armonicos esfericos reales para s, p, d y f. Son las formulas reales del atomo
              de hidrogeno, no una invencion visual. Se re-muestrean cada cierto tiempo para
              transmitir que es una nube de probabilidad, no una orbita clasica fija.
            </p>
          </article>
          <article>
            <h3>Reglas de Slater (Z efectivo)</h3>
            <p>
              Para atomos multi-electron se calcula una carga nuclear efectiva{" "}
              <code>Z_eff</code> por subcapa, apantallando la carga real del nucleo segun
              cuantos electrones internos hay y en que capa. Es una aproximacion estandar de
              quimica cuantica (no una solucion exacta de Hartree-Fock/DFT), usada aqui para
              que el tamano y la forma de la nube dependan del elemento real.
            </p>
          </article>
          <article>
            <h3>Configuracion electronica: Aufbau + excepciones</h3>
            <p>
              El llenado de subcapas sigue la regla de Madelung (Aufbau) con exclusion de
              Pauli y regla de Hund. Las ~20 excepciones conocidas (Cr, Cu, La, Au, etc., por
              estabilidad de capas semi-llenas o llenas) estan tabuladas explicitamente. Para
              elementos superpesados (Z≥104) la configuracion real es incierta/teorica.
            </p>
          </article>
          <article>
            <h3>Isotopo, no el mas abundante real</h3>
            <p>
              El numero de neutrones se obtiene redondeando el peso atomico estandar IUPAC y
              restando Z. Es un isotopo "tipico" razonable, no necesariamente el mas abundante
              en la naturaleza (evita necesitar una tabla completa de abundancias isotopicas).
            </p>
          </article>
          <article>
            <h3>Nucleo: real pero no a escala</h3>
            <p>
              El nucleo se construye con protones y neutrones reales (reutilizando el mismo
              modelo de hadrones del laboratorio de quarks), pero se dibuja a un tamano fijo,
              explicitamente <strong>no a escala real</strong> frente a la nube electronica: un
              nucleo real es del orden de 100.000 veces mas chico, seria invisible a la escala
              de la nube. El boton "Ver nucleo" salta al laboratorio de quarks para ver un
              proton o neutron real a su escala.
            </p>
          </article>
        </div>

        <h2 className="doc-section-title">Simulador de moleculas: que es real y que es aproximacion</h2>
        <div className="doc-grid">
          <article>
            <h3>Atomos reales, geometria experimental fija</h3>
            <p>
              Cada atomo de la molecula es el mismo modelo hibrido nucleo+nube electronica de
              la vista Atomos (misma funcion de onda hidrogenoide real, mismo apantallamiento
              de Slater). Las longitudes y angulos de enlace (p.ej. O-H = 0.96 Å y H-O-H =
              104.5° en el agua) son valores experimentales tabulados de quimica estandar, no
              inventados.
            </p>
          </article>
          <article>
            <h3>Sin orbitales moleculares ni fuerzas de enlace</h3>
            <p>
              En una molecula real los orbitales atomicos se combinan en orbitales moleculares
              compartidos entre nucleos (enlaces covalentes), y la geometria de equilibrio
              surge de minimizar la energia electronica. Este simulador <strong>no</strong>{" "}
              calcula orbitales moleculares ni resuelve ninguna fuerza de enlace: coloca cada
              atomo aislado en una posicion fija tomada de tablas experimentales. Es una
              composicion visual, no una simulacion de estructura electronica molecular.
            </p>
          </article>
          <article>
            <h3>Orden de enlace: notacion de Lewis</h3>
            <p>
              El numero de lineas dibujadas entre dos nucleos (1, 2 o 3) sigue la convencion
              de Lewis para enlace simple/doble/triple. Es una notacion de libro de texto, no
              una medicion de densidad de enlace ni una prediccion de orden de enlace real
              (que en moleculas con resonancia, como el CO2 o el SO2, puede ser fraccionario).
            </p>
          </article>
        </div>

        <h2 className="doc-section-title">Como validar los resultados</h2>
        <div className="doc-grid">
          <article>
            <h3>Deriva de energia</h3>
            <p>
              Si la energia total (cinetica + potencial) se aleja mucho de su valor inicial
              a lo largo de la corrida, el paso temporal (dt) es probablemente demasiado
              grande para ese potencial. Reducir dt y repetir es la primera prueba de
              estabilidad numerica.
            </p>
          </article>
          <article>
            <h3>Reproducibilidad</h3>
            <p>
              Correr la misma configuracion con la misma semilla (random_seed) debe dar
              exactamente los mismos resultados. Es la prueba mas basica de que no hay
              aleatoriedad oculta o efectos de orden de ejecucion.
            </p>
          </article>
          <article>
            <h3>Unitariedad SU(3)</h3>
            <p>
              Cada enlace de la red de Lattice debe seguir siendo (numericamente) unitario
              con determinante 1 a lo largo de toda la corrida. Errores de unitariedad
              crecientes indican acumulacion de error numerico en las actualizaciones.
            </p>
          </article>
          <article>
            <h3>Tasa de aceptacion de Metropolis</h3>
            <p>
              Una tasa de aceptacion muy alta (cerca de 100%) sugiere pasos de propuesta
              demasiado pequeños (muestreo lento); una tasa muy baja (cerca de 0%) sugiere
              pasos demasiado grandes (casi todo se rechaza). Un rango intermedio (30%-60%)
              suele ser saludable.
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}

export default function App() {
  const {
    activeView,
    status,
    simulationId,
    reducedMotion,
    stepLocal,
    setBackend,
    toggleColorblind,
    toggleReducedMotion,
    colorblindMode
  } = useSimulationStore();

  useEffect(() => {
    health()
      .then((result) => setBackend(true, `Backend ${result.model_version}`))
      .catch(() => setBackend(false, "Backend no disponible; el modo visual local sigue activo"));
  }, [setBackend]);

  useEffect(() => {
    if (status !== "running" || simulationId || reducedMotion) return undefined;
    let frame = 0;
    let mounted = true;
    const tick = () => {
      if (!mounted) return;
      stepLocal();
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => {
      mounted = false;
      window.cancelAnimationFrame(frame);
    };
  }, [status, simulationId, reducedMotion, stepLocal]);

  return (
    <ErrorBoundary>
      <div className={`app-shell ${colorblindMode ? "colorblind" : ""}`}>
        <TopNav />
        {activeView === "inicio" && <HomeView />}
        {activeView === "laboratorio" && <LabView />}
        {activeView === "lattice" && <LatticeView />}
        {activeView === "atomos" && <AtomView />}
        {activeView === "moleculas" && <MoleculeView />}
        {activeView === "gravedad" && <GravityView />}
        {activeView === "comparador" && <CompareView />}
        {activeView === "historial" && <HistoryView />}
        {activeView === "documentacion" && <DocumentationView />}
        <div className="accessibility-bar" aria-label="Accesibilidad">
          <button type="button" onClick={toggleReducedMotion}>
            <PauseCircle size={15} /> Reducir movimiento
          </button>
          <button type="button" onClick={toggleColorblind}>
            <Waves size={15} /> Modo daltonismo
          </button>
        </div>
      </div>
    </ErrorBoundary>
  );
}
