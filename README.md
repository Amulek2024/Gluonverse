# Gluonverse

Gluonverse is an interactive platform for exploring particles, color charge,
confinement-inspired potentials, and finite-volume 4D lattice QCD. The app is built
as a monorepo with a React/TypeScript/WebGL frontend and a Python/FastAPI
scientific backend.

## Scientific Warning

Gluonverse does not implement production quantum chromodynamics. The first
release contains:

- Educational visualizations for quarks, antiquarks, gluon-like field flows,
  mesons, baryons, and conservation checks.
- Reproducible numerical toy models using a Cornell-like effective potential.
- A 4D Euclidean SU(3) lattice with Wilson action and optional dynamical
  staggered fermions on tiny volumes.
- Explicit labels for approximations, limitations, and purely illustrative
  rendering.

Animations are not presented as exact QCD. Quarks are modeled as configurable
states for teaching and computation, while documentation explains that real
quarks are excitations of quantum fields.

## Stack

- Frontend: React, TypeScript, Vite, Three.js, React Three Fiber, Zustand,
  Tailwind CSS, Recharts, Web Workers, WebGL.
- Backend: Python 3.12, FastAPI, Pydantic, NumPy, SciPy, Numba, Matplotlib,
  h5py/HDF5, Pytest.
- Communication: REST for configuration/results and WebSocket for summarized
  simulation frames.
- Persistence: SQLite metadata and HDF5/CSV exports.

## Install

```bash
cd frontend
npm install

cd ../backend
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

On Windows PowerShell:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
```

## Run Locally

Backend:

```bash
cd backend
uvicorn gluonverse.main:app --reload --host 0.0.0.0 --port 8000
```

Frontend:

```bash
cd frontend
npm run dev
```

Open the frontend URL printed by Vite. By default the frontend talks to
`http://localhost:8000`.

## Docker

```bash
docker compose up --build
```

Services:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000`
- API health: `http://localhost:8000/health`

Simulation metadata is stored in `data/simulations`, and exported files are
stored in `data/exports`.

## API Examples

Create a quark-antiquark simulation:

```bash
curl -X POST http://localhost:8000/simulations \
  -H "Content-Type: application/json" \
  -d @examples/quark_antiquark.json
```

Run it:

```bash
curl -X POST http://localhost:8000/simulations/<id>/run \
  -H "Content-Type: application/json" \
  -d "{\"steps\": 250, \"sample_interval\": 10}"
```

Fetch observables:

```bash
curl http://localhost:8000/simulations/<id>/observables
```

Connect to frames:

```text
ws://localhost:8000/ws/simulations/<id>
```

## Implemented Physics Models

- Particle states: up/down quarks and antiquarks, masses, electric charge,
  color charge, position, velocity, momentum, spin, and energy.
- Effective Cornell-like potential:
  `V(r) = -a / sqrt(r^2 + eps^2) + b * sqrt(r^2 + eps^2)`.
- Velocity Verlet integrator as the primary educational integrator.
- Educational meson, baryon, and antibaryon detection rules based on simplified
  color neutrality, proximity, and relative energy thresholds.
- Conservation diagnostics for energy, linear momentum, angular momentum,
  electric charge, simplified color balance, baryon number, and particle counts.
- Finite-volume 4D lattice QCD with SU(3) links, Wilson plaquette action,
  dynamical staggered determinants, Metropolis-Hastings updates, Wilson loops,
  Polyakov loops, and chiral condensates.

## Approximations

The Cornell-like potential is an effective teaching model, not a QCD
calculation. The lattice engine is a real finite-matrix lattice-QCD calculation,
but its tiny volumes are not continuum-extrapolated production QCD. Frontend
tubes, halos, and field density shaders are graphic metaphors.

More detail is in:

- `docs/physics-models.md`
- `docs/approximations.md`
- `docs/validation.md`
- `docs/units.md`

## Tests

```bash
cd backend
pytest

cd ../frontend
npm test
npm run build
```

The backend test suite covers particle creation, electric charges, color
neutrality, potential/force calculations, Velocity Verlet stability,
serialization, API creation, SU(3) checks, plaquettes, Wilson loops, Monte Carlo
reproducibility, and export paths.

## Export

Supported MVP exports:

- JSON metadata.
- CSV observables.
- HDF5 complete data.

PNG and video export are documented for the roadmap; the backend contains a
Matplotlib-ready export boundary but the MVP focuses on data exports.

## Limits And Numerical Risks

- Educational dynamics can drift if time steps are too large.
- Close particle approaches are regularized to avoid division by zero.
- The lattice discretization, finite volume, bare parameters, and short Markov
  chains introduce large systematic and statistical effects.
- Monte Carlo estimates require burn-in and sampling discipline; MVP statistics
  are basic.
- WebSocket frames are summarized and downsampled by design.

## Roadmap

- 0.2: Better visualization, more flavors, larger lattices, JAX evaluation.
- 0.3: HMC/RHMC, sparse Dirac solvers, U(1)/SU(2), additional observables.
- 0.4: Electromagnetism and special-relativistic integrators.
- 0.5: Effective nuclear physics, protons, neutrons, simple nuclei.
- Future: Cosmological toy models, distributed simulation, GPU clusters.

## Validation

Validate results by checking conserved quantities, reproducing runs with the
same seed, comparing smaller time steps, inspecting SU(3) unitarity/determinant
errors, tracking Monte Carlo acceptance rates, and comparing observables against
the documented reference cases in `docs/validation.md`.
