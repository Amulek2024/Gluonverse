from __future__ import annotations

import asyncio
from time import perf_counter

import numpy as np

from gluonverse.models.schemas import (
    ParticleState,
    SimulationConfig,
    SimulationFrame,
    SimulationStatus,
)
from gluonverse.observables import particle_observables
from gluonverse.physics.hadrons import detect_antibaryons, detect_baryons, detect_mesons
from gluonverse.physics.integrators import velocity_verlet_step
from gluonverse.physics.particles import make_particle
from gluonverse.simulations.base import FrameCallback, SimulationEngine


class EducationalParticleEngine(SimulationEngine):
    def __init__(self, simulation_id: str) -> None:
        self.simulation_id = simulation_id
        self.config = SimulationConfig()
        self.status = SimulationStatus.CREATED
        self.current_step = 0
        self.simulated_time = 0.0
        self.particles: list[ParticleState] = []
        self.frames: list[SimulationFrame] = []
        self.observables: dict[str, object] = {}
        self.hadrons: list[dict[str, object]] = []
        self.warnings: list[str] = []
        self._initial_energy: float | None = None
        self._initial_momentum: list[float] | None = None
        self._canceled = False

    def initialize(self, config: SimulationConfig) -> None:
        self.config = config
        self.status = SimulationStatus.CREATED
        self.current_step = 0
        self.simulated_time = 0.0
        self.particles = [make_particle(particle) for particle in config.particles]
        self.frames = []
        self.warnings = [
            "Modelo educativo aproximado. No representa una simulacion completa de QCD."
        ]
        _, initial_energy_terms = velocity_verlet_step(
            self.particles,
            config.potential,
            0.0,
        )
        self._initial_energy = initial_energy_terms["total_energy"]
        if self.particles:
            momenta = np.asarray([particle.momentum for particle in self.particles], dtype=float)
            self._initial_momentum = np.sum(momenta, axis=0).tolist()
        else:
            self._initial_momentum = [0.0, 0.0, 0.0]
        self.observables = particle_observables(
            self.particles,
            initial_energy_terms,
            self._initial_energy,
            self._initial_momentum,
        )

    def step(self) -> SimulationFrame:
        if self.status == SimulationStatus.CANCELED:
            return self._frame()
        self.particles, energy_terms = velocity_verlet_step(
            self.particles,
            self.config.potential,
            self.config.time_step,
        )
        self.current_step += 1
        self.simulated_time = self.current_step * self.config.time_step
        self.hadrons = [
            *detect_mesons(self.particles),
            *detect_baryons(self.particles),
            *detect_antibaryons(self.particles),
        ]
        self.observables = particle_observables(
            self.particles,
            energy_terms,
            self._initial_energy,
            self._initial_momentum,
        )
        self._update_warnings()
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
        target = min(self.current_step + steps, self.config.steps)
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
        elif self.current_step >= self.config.steps or self.current_step >= target:
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
            "particles": [particle.model_dump(mode="json") for particle in self.particles],
            "hadrons": self.hadrons,
            "warnings": self.warnings,
        }

    def get_observables(self) -> dict[str, object]:
        return {
            **self.observables,
            "iteration": self.current_step,
            "simulated_time": self.simulated_time,
            "hadrons": self.hadrons,
            "parameters": self.config.model_dump(mode="json"),
        }

    def _frame(self) -> SimulationFrame:
        return SimulationFrame(
            simulation_id=self.simulation_id,
            step=self.current_step,
            simulated_time=self.simulated_time,
            particles=self.particles,
            fields=[
                {
                    "kind": "cornell_flux_tube_metaphor",
                    "approximation": "visual field metaphor, not a gluon field solution",
                }
            ],
            observables={**self.observables, "hadrons": self.hadrons},
            warnings=self.warnings,
        )

    def _update_warnings(self) -> None:
        warnings = [
            "Modelo educativo aproximado. No representa una simulacion completa de QCD."
        ]
        drift = float(self.observables.get("energy_drift", 0.0))
        tolerance = self.config.integrator_config.energy_drift_tolerance
        if drift > tolerance:
            warnings.append(
                f"Deriva de energia {drift:.3g} supera la tolerancia {tolerance:.3g}."
            )
        if any(abs(value) > self.config.potential.energy_limit for particle in self.particles for value in particle.force):
            warnings.append("Fuerza cerca del limite numerico configurado.")
        self.warnings = warnings

