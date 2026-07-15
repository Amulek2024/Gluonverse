export type AtomicParticleKind = "electron" | "proton" | "neutron";

export interface AtomicParticleState {
  id: string;
  kind: AtomicParticleKind;
  position: [number, number, number];
  charge: number;
  label?: string;
}
