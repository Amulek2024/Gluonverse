import type { ChargedBody, EMParams } from "../types/electromagnetism";

// Modulo hermano de gravity.ts/cornell.py: fuerza real (Ley de Coulomb, F = k*q1*q2/r^2), pero
// el integrador NO es Velocity Verlet. Verlet asume que la fuerza depende solo de la posicion;
// la fuerza magnetica de Lorentz (F = q*v x B) depende de la VELOCIDAD, y Verlet no conserva
// bien el radio de giro/energia en ese caso. Se usa en cambio el metodo de Boris (Boris, 1970),
// el integrador estandar en fisica de plasmas y simulaciones particle-in-cell para exactamente
// este problema: separa cada paso en un medio "empuje" electrico, una ROTACION exacta por el
// campo magnetico (conserva |v_perp| sin error angular de truncamiento), y otro medio empuje
// electrico. k_e es una constante de visualizacion adimensional (no 8.99e9 SI), igual de
// "ilustrativa, no SI" que G en gravity.ts.

// A diferencia de la gravedad (siempre atractiva, aceleracion independiente de la masa del
// cuerpo acelerado), la aceleracion de Coulomb depende de la propia carga Y masa del cuerpo
// (relacion carga/masa), y el signo relativo de las cargas decide atraccion o repulsion.
function computeElectricAccelerations(
  bodies: ChargedBody[],
  coulombConstant: number,
  softening: number
): Array<[number, number, number]> {
  const n = bodies.length;
  const accelerations: Array<[number, number, number]> = bodies.map(() => [0, 0, 0]);
  const softening2 = softening * softening;

  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const dx = bodies[j].position[0] - bodies[i].position[0];
      const dy = bodies[j].position[1] - bodies[i].position[1];
      const dz = bodies[j].position[2] - bodies[i].position[2];
      const distSq = dx * dx + dy * dy + dz * dz;

      // Mismo suavizado de Plummer que gravity.ts, misma razon (evita fuerza infinita a
      // distancia cero, finita incluso si dos cargas casi se superponen).
      const denom = Math.pow(distSq + softening2, 1.5);
      const factor = (coulombConstant * bodies[i].charge * bodies[j].charge) / denom;

      // factor > 0 (cargas del mismo signo, repulsivo): resta (dx,dy,dz) de i -- i se aleja de
      // j -- y suma a j -- j se aleja de i. factor < 0 (signos opuestos, atractivo): invierte
      // ambos signos, cada uno se mueve hacia el otro.
      accelerations[i][0] -= (factor / bodies[i].mass) * dx;
      accelerations[i][1] -= (factor / bodies[i].mass) * dy;
      accelerations[i][2] -= (factor / bodies[i].mass) * dz;
      accelerations[j][0] += (factor / bodies[j].mass) * dx;
      accelerations[j][1] += (factor / bodies[j].mass) * dy;
      accelerations[j][2] += (factor / bodies[j].mass) * dz;
    }
  }

  return accelerations;
}

// Rotacion de Boris: dado v_minus (velocidad tras el primer medio-empuje electrico), rota
// exactamente por el campo magnetico uniforme B=(0,0,bFieldZ). Formulas estandar del metodo
// (t = (q*dt)/(2*m)*B, s = 2t/(1+|t|^2), v' = v_minus + v_minus x t, v_plus = v_minus + v' x s).
function borisRotate(
  velocity: [number, number, number],
  charge: number,
  mass: number,
  bFieldZ: number,
  dt: number
): [number, number, number] {
  if (bFieldZ === 0 || charge === 0) return velocity;
  const tz = ((charge * dt) / (2 * mass)) * bFieldZ;
  const [vx, vy, vz] = velocity;

  // cross(v, (0,0,tz)) = (vy*tz, -vx*tz, 0): con B a lo largo de Z, la rotacion queda
  // confinada al plano XY (movimiento circular/ciclotron perpendicular a B), como es fisico.
  const vPrimeX = vx + vy * tz;
  const vPrimeY = vy - vx * tz;
  const vPrimeZ = vz;

  const sz = (2 * tz) / (1 + tz * tz);
  const vPlusX = vx + vPrimeY * sz;
  const vPlusY = vy - vPrimeX * sz;
  const vPlusZ = vPrimeZ;

  return [vPlusX, vPlusY, vPlusZ];
}

export function stepElectromagnetism(bodies: ChargedBody[], params: EMParams, dt: number): ChargedBody[] {
  if (bodies.length === 0) return bodies;

  const electricAccel = computeElectricAccelerations(bodies, params.coulombConstant, params.softening);
  const halfDt = dt / 2;

  return bodies.map((body, i) => {
    const [ax, ay, az] = electricAccel[i];
    // Kick (medio paso electrico) -> rotate (campo magnetico) -> kick (medio paso electrico).
    const vMinus: [number, number, number] = [
      body.velocity[0] + ax * halfDt,
      body.velocity[1] + ay * halfDt,
      body.velocity[2] + az * halfDt
    ];
    const vPlus = params.magnetismEnabled
      ? borisRotate(vMinus, body.charge, body.mass, params.bFieldZ, dt)
      : vMinus;
    const velocity: [number, number, number] = [
      vPlus[0] + ax * halfDt,
      vPlus[1] + ay * halfDt,
      vPlus[2] + az * halfDt
    ];
    const position: [number, number, number] = [
      body.position[0] + velocity[0] * dt,
      body.position[1] + velocity[1] * dt,
      body.position[2] + velocity[2] * dt
    ];
    return { ...body, position, velocity };
  });
}
