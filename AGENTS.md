# Gluonverse Agent Guide

Gluonverse separates educational visualization from computational physics and
from scientific claims. Every contributor must preserve that boundary.

## Scientific Guardrails

- Keep educational models, numerical solvers, and scientific validation in
  separate modules.
- Document every approximation before exposing it in the UI or API.
- Do not invent physical formulas. If a model is heuristic, label it as such.
- Never state that a simplified animation is exact QCD.
- Keep color-charge physics distinct from visual colors.
- Maintain consistent units through the central units module.
- Validate equations and numerical assumptions before implementation.
- Add or update tests whenever a physics model changes.
- Record model-version changes in documentation and export metadata.
- Protect reproducibility: keep full configuration, seed, tolerances, units,
  model version, and dependency metadata with each simulation.

## Architecture Rules

- Do not mix simulation logic with rendering logic.
- Keep WebSocket frames summarized; do not stream large matrices per frame.
- Maintain compatibility with saved simulation configurations.
- Keep safety limits for particle count, lattice size, iterations, timeouts,
  and memory usage.
- Update the relevant scientific documentation when adding a model, observable,
  export format, or validation rule.

