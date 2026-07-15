from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from gluonverse.api import create_router
from gluonverse.config import Settings
from gluonverse.simulations import SimulationManager
from gluonverse.storage import SimulationRepository
from gluonverse.websocket import WebSocketManager


def create_app() -> FastAPI:
    settings = Settings()
    repository = SimulationRepository(settings)
    websocket_manager = WebSocketManager()
    manager = SimulationManager(settings, repository, websocket_manager)

    app = FastAPI(
        title="Gluonverse API",
        version=settings.model_version,
        description=(
            "Educational and reduced computational models for particle and "
            "gauge-field exploration. Not production QCD."
        ),
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(create_router(settings, manager, websocket_manager))
    app.state.settings = settings
    app.state.repository = repository
    app.state.manager = manager
    return app


app = create_app()

