from __future__ import annotations

from collections import defaultdict

from fastapi import WebSocket

from gluonverse.models.schemas import SimulationFrame


class WebSocketManager:
    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = defaultdict(set)

    async def connect(self, simulation_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[simulation_id].add(websocket)

    def disconnect(self, simulation_id: str, websocket: WebSocket) -> None:
        self._connections[simulation_id].discard(websocket)
        if not self._connections[simulation_id]:
            self._connections.pop(simulation_id, None)

    async def broadcast_frame(self, frame: SimulationFrame) -> None:
        dead: list[WebSocket] = []
        for websocket in list(self._connections.get(frame.simulation_id, set())):
            try:
                await websocket.send_json(frame.model_dump(mode="json"))
            except RuntimeError:
                dead.append(websocket)
        for websocket in dead:
            self.disconnect(frame.simulation_id, websocket)

