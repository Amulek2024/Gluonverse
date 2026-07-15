from __future__ import annotations

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect

from gluonverse.config import Settings
from gluonverse.models.schemas import (
    ExportRequest,
    RunRequest,
    SimulationConfig,
)
from gluonverse.simulations import SimulationManager
from gluonverse.validation import validate_simulation_config
from gluonverse.websocket import WebSocketManager


def create_router(
    settings: Settings,
    manager: SimulationManager,
    websocket_manager: WebSocketManager,
) -> APIRouter:
    router = APIRouter()

    @router.get("/health")
    async def health() -> dict[str, str]:
        return {
            "status": "ok",
            "service": "gluonverse-backend",
            "model_version": settings.model_version,
        }

    @router.get("/models")
    async def models() -> list[dict[str, object]]:
        return manager.models()

    @router.get("/presets")
    async def presets() -> dict[str, object]:
        return {
            key: value.model_dump(mode="json")
            for key, value in manager.presets().items()
        }

    @router.post("/simulations")
    async def create_simulation(config: SimulationConfig) -> dict[str, object]:
        try:
            record = manager.create_simulation(config)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        return record.model_dump(mode="json")

    @router.get("/simulations")
    async def list_simulations() -> list[dict[str, object]]:
        return [record.model_dump(mode="json") for record in manager.repository.list()]

    @router.get("/simulations/{simulation_id}")
    async def get_simulation(simulation_id: str) -> dict[str, object]:
        record = manager.repository.get(simulation_id)
        if record is None:
            raise HTTPException(status_code=404, detail="Simulation not found")
        return record.model_dump(mode="json")

    @router.post("/simulations/{simulation_id}/run")
    async def run_simulation(simulation_id: str, request: RunRequest = RunRequest()) -> dict[str, str]:
        try:
            return await manager.start_run(
                simulation_id,
                request.steps,
                request.sample_interval,
            )
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Simulation not found") from exc

    @router.post("/simulations/{simulation_id}/pause")
    async def pause_simulation(simulation_id: str) -> dict[str, str]:
        try:
            return manager.pause(simulation_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Simulation not found") from exc

    @router.post("/simulations/{simulation_id}/resume")
    async def resume_simulation(simulation_id: str) -> dict[str, str]:
        try:
            return manager.resume(simulation_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Simulation not found") from exc

    @router.post("/simulations/{simulation_id}/cancel")
    async def cancel_simulation(simulation_id: str) -> dict[str, str]:
        try:
            return manager.cancel(simulation_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Simulation not found") from exc

    @router.get("/simulations/{simulation_id}/state")
    async def simulation_state(simulation_id: str) -> dict[str, object]:
        try:
            return manager.get_state(simulation_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Simulation not found") from exc

    @router.get("/simulations/{simulation_id}/observables")
    async def simulation_observables(simulation_id: str) -> dict[str, object]:
        try:
            return manager.get_observables(simulation_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Simulation not found") from exc

    @router.get("/simulations/{simulation_id}/frames")
    async def simulation_frames(simulation_id: str) -> list[dict[str, object]]:
        try:
            return manager.get_frames(simulation_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Simulation not found") from exc

    @router.post("/simulations/{simulation_id}/export")
    async def export_simulation(simulation_id: str, request: ExportRequest) -> dict[str, str]:
        try:
            return manager.export(simulation_id, request.format)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Simulation not found") from exc

    @router.delete("/simulations/{simulation_id}")
    async def delete_simulation(simulation_id: str) -> dict[str, bool]:
        deleted = manager.delete(simulation_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Simulation not found")
        return {"deleted": True}

    @router.post("/validate")
    async def validate(config: SimulationConfig) -> dict[str, object]:
        return validate_simulation_config(config, settings).model_dump(mode="json")

    @router.websocket("/ws/simulations/{simulation_id}")
    async def websocket_endpoint(websocket: WebSocket, simulation_id: str) -> None:
        await websocket_manager.connect(simulation_id, websocket)
        try:
            while True:
                await websocket.receive_text()
        except WebSocketDisconnect:
            websocket_manager.disconnect(simulation_id, websocket)

    return router

