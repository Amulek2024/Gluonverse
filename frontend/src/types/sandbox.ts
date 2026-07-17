// Set propio y liviano, no una extension de GravityBody ni ParticleState: un atomo del sandbox
// solo necesita id/elemento/posicion/velocidad -- el resto de su geometria (nucleo, nube
// electronica) se deriva de `z` reutilizando utils/elements.ts, igual que en Atomos/Moleculas.

export interface SandboxAtom {
  id: string;
  z: number;
  position: [number, number, number];
  velocity: [number, number, number];
}

export interface SandboxParams {
  // Profundidad del pozo (epsilon) del potencial Lennard-Jones, UNIFORME para todo par de
  // atomos. Ver docs/approximations.md: la energia de dispersion real varia en ordenes de
  // magnitud segun la polarizabilidad de cada elemento, dato que no esta tabulado aqui.
  attractionStrength: number;
  // Fraccion de velocidad removida cada paso; ayuda numerica/visual para que el sistema se
  // asiente en vez de oscilar indefinidamente, no una fuerza de friccion real.
  damping: number;
}
