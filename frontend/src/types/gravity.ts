// Deliberately its own lean type set, not a reuse/extension of ParticleState
// (types/physics.ts): gravity bodies have no flavor/color_charge/spin -- that's
// QCD-only baggage that doesn't apply here.

export type BodyKind = "core" | "star" | "planet" | "debris";

export interface GravityBody {
  id: string;
  kind: BodyKind;
  mass: number;
  radius: number;
  position: [number, number, number];
  velocity: [number, number, number];
  color: string;
  // Provenance chain of ids absorbed into this body via merging; debugging/inspector only.
  mergedFrom?: string[];
}

export interface GravityParams {
  G: number;
  softening: number;
  mergeEnabled: boolean;
  // Multiplies (radiusA + radiusB) to decide contact distance for merging.
  mergeThresholdFactor: number;
}

export interface GravityPreset {
  id: string;
  label: string;
  description: string;
  build: (params: GravityParams) => GravityBody[];
}
