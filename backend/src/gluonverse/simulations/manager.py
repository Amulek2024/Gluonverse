from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from uuid import uuid4

from gluonverse.config import Settings
from gluonverse.models.schemas import (
    ExportFormat,
    SimulationConfig,
    SimulationRecord,
    SimulationStatus,
)
from gluonverse.simulations.base import SimulationEngine
from gluonverse.simulations.educational import EducationalParticleEngine
from gluonverse.simulations.lattice_engine import SimplifiedGaugeLatticeEngine
from gluonverse.storage import SimulationRepository
from gluonverse.validation import validate_simulation_config
from gluonverse.websocket import WebSocketManager


class SimulationManager:
    def __init__(
        self,
        settings: Settings,
        repository: SimulationRepository,
        websocket_manager: WebSocketManager,
    ) -> None:
        self.settings = settings
        self.repository = repository
        self.websocket_manager = websocket_manager
        self.engines: dict[str, SimulationEngine] = {}
        self.tasks: dict[str, asyncio.Task[None]] = {}

    def create_simulation(self, config: SimulationConfig) -> SimulationRecord:
        validation = validate_simulation_config(config, self.settings)
        if not validation.ok:
            raise ValueError("; ".join(validation.errors))

        simulation_id = f"sim-{uuid4().hex[:12]}"
        engine = self._create_engine(simulation_id, config)
        engine.initialize(config)
        self.engines[simulation_id] = engine
        total_steps = config.lattice.iterations if config.simulation_type in {"lattice", "gauge_lattice"} else config.steps
        record = SimulationRecord(
            simulation_id=simulation_id,
            name=config.name,
            model=config.simulation_type,
            created_at=datetime.now(timezone.utc),
            status=SimulationStatus.CREATED,
            config=config,
            seed=config.random_seed,
            current_step=0,
            total_steps=total_steps,
            metadata={
                "scope": "tiny-volume lattice QCD" if config.simulation_type in {"lattice", "gauge_lattice"} else "educational",
                "validation": validation.model_dump(mode="json"),
                "units": "natural_units",
            },
            version=self.settings.model_version,
        )
        return self.repository.create(record)

    async def start_run(
        self,
        simulation_id: str,
        steps: int | None = None,
        sample_interval: int = 10,
    ) -> dict[str, str]:
        engine = self._engine(simulation_id)
        if simulation_id in self.tasks and not self.tasks[simulation_id].done():
            return {"status": "already_running"}
        requested_steps = steps or (
            engine.config.lattice.iterations if engine.config.simulation_type in {"lattice", "gauge_lattice"} else engine.config.steps
        )
        self.repository.update_status(simulation_id, SimulationStatus.RUNNING, engine.current_step)

        async def _runner() -> None:
            try:
                await engine.run(
                    requested_steps,
                    sample_interval,
                    self.websocket_manager.broadcast_frame,
                )
                self.repository.update_status(
                    simulation_id,
                    engine.status,
                    engine.current_step,
                    metadata={"last_observables": engine.get_observables()},
                )
            except Exception as exc:  # pragma: no cover - defensive safety net
                self.repository.update_status(
                    simulation_id,
                    SimulationStatus.FAILED,
                    engine.current_step,
                    metadata={"error": str(exc)},
                )
                raise

        self.tasks[simulation_id] = asyncio.create_task(_runner())
        return {"status": "running"}

    def pause(self, simulation_id: str) -> dict[str, str]:
        engine = self._engine(simulation_id)
        engine.pause()
        self.repository.update_status(simulation_id, engine.status, engine.current_step)
        return {"status": engine.status.value}

    def resume(self, simulation_id: str) -> dict[str, str]:
        engine = self._engine(simulation_id)
        engine.resume()
        self.repository.update_status(simulation_id, engine.status, engine.current_step)
        return {"status": engine.status.value}

    def cancel(self, simulation_id: str) -> dict[str, str]:
        engine = self._engine(simulation_id)
        engine.cancel()
        self.repository.update_status(simulation_id, engine.status, engine.current_step)
        return {"status": engine.status.value}

    def get_state(self, simulation_id: str) -> dict[str, object]:
        return self._engine(simulation_id).get_state()

    def get_observables(self, simulation_id: str) -> dict[str, object]:
        return self._engine(simulation_id).get_observables()

    def get_frames(self, simulation_id: str) -> list[dict[str, object]]:
        return [frame.model_dump(mode="json") for frame in self._engine(simulation_id).frames]

    def export(self, simulation_id: str, fmt: ExportFormat) -> dict[str, str]:
        engine = self._engine(simulation_id)
        path = self.repository.export(
            simulation_id,
            engine.config,
            engine.frames,
            engine.get_observables(),
            fmt,
        )
        return {"format": fmt.value, "path": str(path)}

    def delete(self, simulation_id: str) -> bool:
        self.engines.pop(simulation_id, None)
        task = self.tasks.pop(simulation_id, None)
        if task and not task.done():
            task.cancel()
        return self.repository.delete(simulation_id)

    def models(self) -> list[dict[str, object]]:
        return [
            {
                "id": "quark_antiquark",
                "name": "Quark-antiquark educational model",
                "scope": "educational approximation",
                "integrator": "velocity_verlet",
                "warning": "Not a complete QCD simulation.",
            },
            {
                "id": "gauge_lattice",
                "name": "4D Euclidean lattice QCD",
                "scope": "tiny-volume direct determinant calculation",
                "sizes": [2, 3, 4],
                "gauge_action": "Wilson plaquette",
                "fermions": "dynamical staggered or quenched",
                "warning": "Finite lattice calculation; not real-time QCD or a continuum-extrapolated production result.",
            },
        ]

    def presets(self) -> dict[str, SimulationConfig]:
        return {
            "quark_antiquark": SimulationConfig(name="Quark y antiquark", simulation_type="quark_antiquark"),
            "meson": SimulationConfig(name="Meson simple", simulation_type="meson"),
            "proton": SimulationConfig(
                name="Proton educativo",
                simulation_type="baryon",
                particles=[
                    {
                        "flavor": "up",
                        "color_charge": "red",
                        "position": [-0.35, 0.0, 0.0],
                        "velocity": [0.0, 0.05, 0.0],
                    },
                    {
                        "flavor": "up",
                        "color_charge": "green",
                        "position": [0.25, 0.25, 0.0],
                        "velocity": [-0.04, -0.03, 0.0],
                    },
                    {
                        "flavor": "down",
                        "color_charge": "blue",
                        "position": [0.1, -0.3, 0.0],
                        "velocity": [0.03, -0.02, 0.0],
                    },
                ],
            ),
            "neutron": SimulationConfig(
                name="Neutron educativo",
                simulation_type="baryon",
                particles=[
                    {
                        "flavor": "up",
                        "color_charge": "red",
                        "position": [-0.35, 0.0, 0.0],
                    },
                    {
                        "flavor": "down",
                        "color_charge": "green",
                        "position": [0.25, 0.25, 0.0],
                    },
                    {
                        "flavor": "down",
                        "color_charge": "blue",
                        "position": [0.1, -0.3, 0.0],
                    },
                ],
            ),
            "lattice_small": SimulationConfig(
                name="QCD 4D dinamica pequena",
                simulation_type="gauge_lattice",
                dimensions=4,
                steps=50,
                lattice={
                    "size": 2,
                    "temporal_size": 4,
                    "iterations": 50,
                    "beta": 5.5,
                    "fermion_mode": "dynamical_staggered",
                    "quark_masses": [0.1, 0.1],
                },
            ),
        }

    def _create_engine(self, simulation_id: str, config: SimulationConfig) -> SimulationEngine:
        if config.simulation_type in {"lattice", "gauge_lattice"}:
            return SimplifiedGaugeLatticeEngine(simulation_id)
        return EducationalParticleEngine(simulation_id)

    def _engine(self, simulation_id: str) -> SimulationEngine:
        engine = self.engines.get(simulation_id)
        if engine is None:
            record = self.repository.get(simulation_id)
            if record is None:
                raise KeyError(simulation_id)
            engine = self._create_engine(simulation_id, record.config)
            engine.initialize(record.config)
            engine.current_step = record.current_step
            self.engines[simulation_id] = engine
        return engine
