from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Awaitable, Callable
from typing import Any

from gluonverse.models.schemas import SimulationConfig, SimulationFrame, SimulationStatus

FrameCallback = Callable[[SimulationFrame], Awaitable[None]]


class SimulationEngine(ABC):
    simulation_id: str
    config: SimulationConfig
    status: SimulationStatus
    current_step: int
    frames: list[SimulationFrame]

    @abstractmethod
    def initialize(self, config: SimulationConfig) -> None:
        raise NotImplementedError

    @abstractmethod
    def step(self) -> SimulationFrame:
        raise NotImplementedError

    @abstractmethod
    async def run(
        self,
        steps: int,
        sample_interval: int = 10,
        on_frame: FrameCallback | None = None,
    ) -> None:
        raise NotImplementedError

    @abstractmethod
    def pause(self) -> None:
        raise NotImplementedError

    @abstractmethod
    def resume(self) -> None:
        raise NotImplementedError

    @abstractmethod
    def cancel(self) -> None:
        raise NotImplementedError

    @abstractmethod
    def get_state(self) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    def get_observables(self) -> dict[str, Any]:
        raise NotImplementedError

