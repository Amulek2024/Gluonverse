from __future__ import annotations

import asyncio
from time import perf_counter

from gluonverse.models.schemas import SimulationConfig, SimulationFrame, SimulationStatus
from gluonverse.physics.lattice import LatticeQCD4D
from gluonverse.simulations.base import FrameCallback, SimulationEngine


class LatticeQCDEngine(SimulationEngine):
    def __init__(self, simulation_id: str) -> None:
        self.simulation_id = simulation_id
        self.config = SimulationConfig(simulation_type="gauge_lattice", dimensions=4)
        self.status = SimulationStatus.CREATED
        self.current_step = 0
        self.simulated_time = 0.0
        self.frames: list[SimulationFrame] = []
        self.lattice: LatticeQCD4D | None = None
        self.observables: dict[str, object] = {}
        self.warnings = [
            "QCD de reticulo 4D euclidea en volumen pequeno; no es tiempo real ni una corrida de produccion."
        ]
        self._canceled = False

    def initialize(self, config: SimulationConfig) -> None:
        self.config = config
        lattice_config = config.lattice
        self.lattice = LatticeQCD4D(
            spatial_size=lattice_config.size,
            temporal_size=lattice_config.temporal_size,
            beta=lattice_config.beta,
            seed=config.random_seed,
            proposal_width=lattice_config.proposal_width,
            fermion_mode=lattice_config.fermion_mode,
            quark_masses=tuple(lattice_config.quark_masses),
            start=lattice_config.start,
        )
        self.status = SimulationStatus.CREATED
        self.current_step = 0
        self.simulated_time = 0.0
        self.frames = []
        self.observables = self._observables({"action": self.lattice.current_gauge_action})

    def step(self) -> SimulationFrame:
        if self.lattice is None:
            raise RuntimeError("Lattice engine not initialized")
        stats = self.lattice.metropolis_step()
        self.current_step += 1
        self.simulated_time = float(self.current_step)
        self.observables = self._observables(stats)
        return self._frame()

    async def run(
        self,
        steps: int,
        sample_interval: int = 10,
        on_frame: FrameCallback | None = None,
    ) -> None:
        self.status = SimulationStatus.RUNNING
        self._canceled = False
        start_time = perf_counter()
        target = min(self.current_step + steps, self.config.lattice.iterations)
        while self.current_step < target and not self._canceled:
            if self.status == SimulationStatus.PAUSED:
                await asyncio.sleep(0.05)
                continue
            frame = self.step()
            frame.observables["computational_time"] = perf_counter() - start_time
            if self.current_step % sample_interval == 0 or self.current_step == target:
                self.frames.append(frame)
                if on_frame is not None:
                    await on_frame(frame)
            await asyncio.sleep(0)
        if self._canceled:
            self.status = SimulationStatus.CANCELED
        else:
            self.status = SimulationStatus.COMPLETED

    def pause(self) -> None:
        if self.status == SimulationStatus.RUNNING:
            self.status = SimulationStatus.PAUSED

    def resume(self) -> None:
        if self.status == SimulationStatus.PAUSED:
            self.status = SimulationStatus.RUNNING

    def cancel(self) -> None:
        self._canceled = True
        self.status = SimulationStatus.CANCELED

    def get_state(self) -> dict[str, object]:
        return {
            "simulation_id": self.simulation_id,
            "status": self.status,
            "step": self.current_step,
            "simulated_time": self.simulated_time,
            "lattice": self._lattice_summary(),
            "warnings": self.warnings,
        }

    def get_observables(self) -> dict[str, object]:
        return {
            **self.observables,
            "iteration": self.current_step,
            "parameters": self.config.model_dump(mode="json"),
        }

    def _observables(self, stats: dict[str, float]) -> dict[str, object]:
        if self.lattice is None:
            return {}
        polyakov = self.lattice.polyakov_loop()
        wilson = self.lattice.wilson_loop(
            self.config.lattice.wilson_loop_r,
            self.config.lattice.wilson_loop_t,
        )
        return {
            "action": float(stats.get("action", self.lattice.current_gauge_action)),
            "effective_action": float(stats.get("effective_action", self.lattice.effective_action())),
            "fermion_logdet": float(stats.get("fermion_logdet", self.lattice.current_fermion_logdet)),
            "average_plaquette": float(stats.get("average_plaquette", self.lattice.average_plaquette())),
            "wilson_loop": wilson,
            "acceptance_rate": self.lattice.acceptance_rate,
            "polyakov_loop_real": float(polyakov.real),
            "polyakov_loop_imag": float(polyakov.imag),
            "polyakov_loop_abs": float(abs(polyakov)),
            "chiral_condensates": self.lattice.chiral_condensates(),
            "fermion_condition_number": self.lattice.fermion_condition_number(),
            "fermion_mode": self.config.lattice.fermion_mode,
            "flavor_count": len(self.config.lattice.quark_masses),
            "model_notice": "4D Euclidean finite lattice; tiny-volume direct determinant sampler.",
        }

    def _lattice_summary(self) -> dict[str, object]:
        if self.lattice is None:
            return {}
        return {
            "size": self.lattice.spatial_size,
            "extents": list(self.lattice.extents),
            "volume": self.lattice.volume,
            "links_per_site": 4,
            "projection": "mean over z, Euclidean time, and plaquette orientations",
            "energy_density": self.lattice.energy_density_summary(),
        }

    def _frame(self) -> SimulationFrame:
        return SimulationFrame(
            simulation_id=self.simulation_id,
            step=self.current_step,
            simulated_time=self.simulated_time,
            particles=[],
            fields=[
                {
                    "kind": "lattice_energy_density",
                    "summary": self._lattice_summary(),
                }
            ],
            observables=self.observables,
            warnings=self.warnings,
        )


# Backward-compatible import name for saved simulations and external callers.
SimplifiedGaugeLatticeEngine = LatticeQCDEngine
