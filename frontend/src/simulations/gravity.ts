import type { GravityBody, GravityParams } from "../types/gravity";

// Modulo hermano de simulations/educational.ts: misma forma de integrador (Velocity Verlet,
// prediccion con fuerzas actuales -> recalculo en la posicion predicha -> promedio de fuerzas
// viejas/nuevas para la velocidad), pero la ley de fuerza es gravedad newtoniana real
// (F = G*m1*m2/r^2), no el potencial de Cornell. G es una constante de visualizacion
// adimensional (no 6.674e-11 SI, que a cualquier escala de escena razonable seria
// imperceptiblemente debil/lenta), igual de "ilustrativa, no SI" que coulomb_strength/
// string_tension en el modulo de quarks.

export interface MergeEvent {
  survivorId: string;
  absorbedId: string;
  resultId: string;
}

interface ContactPair {
  i: number;
  j: number;
}

// Ambos pases de fuerza (posicion actual y posicion predicha) recorren todos los pares O(n^2);
// el paso de deteccion de fusion se calcula reutilizando el segundo pase (posiciones finales
// del paso), en vez de un tercer recorrido O(n^2) aparte.
function computeAccelerations(
  bodies: GravityBody[],
  G: number,
  softening: number,
  mergeThresholdFactor?: number
): { accelerations: Array<[number, number, number]>; contacts: ContactPair[] } {
  const n = bodies.length;
  const accelerations: Array<[number, number, number]> = bodies.map(() => [0, 0, 0]);
  const contacts: ContactPair[] = [];
  const softening2 = softening * softening;

  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const dx = bodies[j].position[0] - bodies[i].position[0];
      const dy = bodies[j].position[1] - bodies[i].position[1];
      const dz = bodies[j].position[2] - bodies[i].position[2];
      const distSq = dx * dx + dy * dy + dz * dz;

      // Suavizado de Plummer: en vez de normalizar direccion + magnitud por separado (como en
      // cornell.ts), esta forma compacta reparte el suavizado directamente en el denominador.
      // Es matematicamente equivalente y evita una division por cero cuando distSq -> 0 (el
      // numerador (r_j - r_i) tambien -> 0 en ese caso, asi que la aceleracion es finita).
      const denom = Math.pow(distSq + softening2, 1.5);
      const aiFactor = (G * bodies[j].mass) / denom;
      const ajFactor = (G * bodies[i].mass) / denom;

      accelerations[i][0] += aiFactor * dx;
      accelerations[i][1] += aiFactor * dy;
      accelerations[i][2] += aiFactor * dz;
      accelerations[j][0] -= ajFactor * dx;
      accelerations[j][1] -= ajFactor * dy;
      accelerations[j][2] -= ajFactor * dz;

      if (mergeThresholdFactor !== undefined) {
        // La distancia de contacto usa la distancia real (no la suavizada): el suavizado es
        // un truco numerico de la fuerza, no un limite fisico de contacto.
        const contactDistance = (bodies[i].radius + bodies[j].radius) * mergeThresholdFactor;
        if (distSq < contactDistance * contactDistance) {
          contacts.push({ i, j });
        }
      }
    }
  }

  return { accelerations, contacts };
}

// Fusion inelastica (acrecion): conserva masa y momento lineal, no energia (se pierde en la
// colision, como en una acrecion real). radius_new asume densidad constante (volumen ~ suma de
// volumenes) -- una simplificacion declarada, no un calculo de estructura real del cuerpo
// resultante. El id del cuerpo mas masivo se usa como base solo para elegir "kind"/color; el
// resultado recibe un id nuevo para no confundir proveniencia.
export function mergeBodies(a: GravityBody, b: GravityBody): GravityBody {
  const totalMass = a.mass + b.mass;
  const heavier = a.mass >= b.mass ? a : b;
  const lighter = a.mass >= b.mass ? b : a;
  const position: [number, number, number] = [
    (a.mass * a.position[0] + b.mass * b.position[0]) / totalMass,
    (a.mass * a.position[1] + b.mass * b.position[1]) / totalMass,
    (a.mass * a.position[2] + b.mass * b.position[2]) / totalMass
  ];
  const velocity: [number, number, number] = [
    (a.mass * a.velocity[0] + b.mass * b.velocity[0]) / totalMass,
    (a.mass * a.velocity[1] + b.mass * b.velocity[1]) / totalMass,
    (a.mass * a.velocity[2] + b.mass * b.velocity[2]) / totalMass
  ];
  return {
    id: `merged-${lighter.id}-${heavier.id}`,
    kind: heavier.kind,
    mass: totalMass,
    radius: Math.cbrt(a.radius ** 3 + b.radius ** 3),
    position,
    velocity,
    color: heavier.color,
    mergedFrom: [...(heavier.mergedFrom ?? [heavier.id]), ...(lighter.mergedFrom ?? [lighter.id])]
  };
}

// Varios cuerpos pueden entrar en contacto en el mismo paso (ej. una pila de 3+ cuerpos); se
// agrupan con union-find antes de fusionar para no contar masa dos veces si A-B y B-C contactan
// en el mismo frame.
function resolveMerges(
  bodies: GravityBody[],
  contacts: ContactPair[]
): { bodies: GravityBody[]; mergedEvents: MergeEvent[] } {
  const parent = bodies.map((_, index) => index);
  function find(index: number): number {
    while (parent[index] !== index) {
      parent[index] = parent[parent[index]];
      index = parent[index];
    }
    return index;
  }
  function union(i: number, j: number): void {
    const rootI = find(i);
    const rootJ = find(j);
    if (rootI !== rootJ) parent[rootI] = rootJ;
  }
  for (const { i, j } of contacts) union(i, j);

  const groups = new Map<number, number[]>();
  for (let index = 0; index < bodies.length; index += 1) {
    const root = find(index);
    const group = groups.get(root);
    if (group) group.push(index);
    else groups.set(root, [index]);
  }

  const resultBodies: GravityBody[] = [];
  const mergedEvents: MergeEvent[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      resultBodies.push(bodies[group[0]]);
      continue;
    }
    let merged = bodies[group[0]];
    for (let k = 1; k < group.length; k += 1) {
      const next = bodies[group[k]];
      const survivorId = merged.mass >= next.mass ? merged.id : next.id;
      const absorbedId = merged.mass >= next.mass ? next.id : merged.id;
      merged = mergeBodies(merged, next);
      mergedEvents.push({ survivorId, absorbedId, resultId: merged.id });
    }
    resultBodies.push(merged);
  }

  return { bodies: resultBodies, mergedEvents };
}

export function stepGravity(
  bodies: GravityBody[],
  params: GravityParams,
  dt: number
): { bodies: GravityBody[]; mergedEvents: MergeEvent[] } {
  if (bodies.length === 0) return { bodies, mergedEvents: [] };

  const { accelerations: currentAccel } = computeAccelerations(bodies, params.G, params.softening);

  const predicted = bodies.map((body, i) => {
    const [ax, ay, az] = currentAccel[i];
    const position: [number, number, number] = [
      body.position[0] + body.velocity[0] * dt + 0.5 * ax * dt * dt,
      body.position[1] + body.velocity[1] * dt + 0.5 * ay * dt * dt,
      body.position[2] + body.velocity[2] * dt + 0.5 * az * dt * dt
    ];
    return { ...body, position };
  });

  const { accelerations: nextAccel, contacts } = computeAccelerations(
    predicted,
    params.G,
    params.softening,
    params.mergeEnabled ? params.mergeThresholdFactor : undefined
  );

  const stepped = predicted.map((body, i) => {
    const velocity: [number, number, number] = [
      body.velocity[0] + 0.5 * (currentAccel[i][0] + nextAccel[i][0]) * dt,
      body.velocity[1] + 0.5 * (currentAccel[i][1] + nextAccel[i][1]) * dt,
      body.velocity[2] + 0.5 * (currentAccel[i][2] + nextAccel[i][2]) * dt
    ];
    return { ...body, velocity };
  });

  if (contacts.length === 0) {
    return { bodies: stepped, mergedEvents: [] };
  }

  return resolveMerges(stepped, contacts);
}
