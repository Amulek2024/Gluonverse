# Architecture

Gluonverse is split into three scientific layers and one visual layer.

## Layers

1. Educational visualization
   - Runs in the browser for immediate feedback.
   - Uses simplified particle states and graphic field metaphors.
   - Always shows an approximation notice.

2. Computational physics backend
   - Owns canonical simulation records, reproducibility metadata, exports, and
     validation.
   - Exposes REST endpoints for configuration and control.
   - Streams summarized frames over WebSocket.

3. Finite-volume lattice QCD laboratory
   - Uses four-dimensional SU(3) links, the Wilson plaquette action, staggered
     fermions, direct determinants, and Metropolis-Hastings sampling.
   - Computes genuine finite-lattice observables while explicitly separating
     them from continuum or production claims.

4. Rendering
   - Uses Three.js/React Three Fiber for camera control, particles, vectors,
     flux tubes, lattice links, and shader effects.
   - Rendering never mutates physical state directly.

## Backend Modules

- `models`: Pydantic request/response schemas.
- `physics`: units, particles, color rules, potentials, integrators, SU(3), and
  lattice math.
- `simulations`: engine interfaces and concrete engines.
- `storage`: SQLite metadata and HDF5/CSV exports.
- `validation`: reproducibility and numerical checks.
- `api`: REST and WebSocket routes.

## Frontend Modules

- `stores`: Zustand global UI/simulation state.
- `api`: REST/WebSocket client.
- `scenes`: 3D scenes and camera interaction.
- `controls`: parameter panels.
- `workers`: browser-side educational stepping.
- `simulations`: frontend toy model utilities.

## Data Flow

```text
User controls -> frontend store -> REST create/run
Backend manager -> simulation engine -> storage + websocket frames
WebSocket frames -> frontend store -> charts + 3D scene
Exports -> SQLite metadata + HDF5/CSV files
```

## Reproducibility

Every simulation stores the model version, complete configuration, seed,
integrator, units, tolerances, current step, dependency metadata, and export
metadata.
