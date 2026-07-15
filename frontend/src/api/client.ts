import type { SimulationConfig, SimulationFrame } from "../types/physics";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
const WS_BASE = import.meta.env.VITE_WS_BASE_URL ?? "ws://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || response.statusText);
  }
  return (await response.json()) as T;
}

export async function health() {
  return request<{ status: string; model_version: string }>("/health");
}

export async function getPresets() {
  return request<Record<string, SimulationConfig>>("/presets");
}

export async function listSimulations() {
  return request<Array<Record<string, unknown>>>("/simulations");
}

export async function createSimulation(config: SimulationConfig) {
  return request<Record<string, unknown>>("/simulations", {
    method: "POST",
    body: JSON.stringify(config)
  });
}

export async function runSimulation(simulationId: string, steps: number, sampleInterval = 4) {
  return request<{ status: string }>(`/simulations/${simulationId}/run`, {
    method: "POST",
    body: JSON.stringify({ steps, sample_interval: sampleInterval })
  });
}

export async function pauseSimulation(simulationId: string) {
  return request<{ status: string }>(`/simulations/${simulationId}/pause`, { method: "POST" });
}

export async function resumeSimulation(simulationId: string) {
  return request<{ status: string }>(`/simulations/${simulationId}/resume`, { method: "POST" });
}

export async function cancelSimulation(simulationId: string) {
  return request<{ status: string }>(`/simulations/${simulationId}/cancel`, { method: "POST" });
}

export async function exportSimulation(simulationId: string, format: "csv" | "hdf5" | "json") {
  return request<{ format: string; path: string }>(`/simulations/${simulationId}/export`, {
    method: "POST",
    body: JSON.stringify({ format })
  });
}

export function connectFrames(simulationId: string, onFrame: (frame: SimulationFrame) => void) {
  const socket = new WebSocket(`${WS_BASE}/ws/simulations/${simulationId}`);
  socket.onmessage = (event) => {
    onFrame(JSON.parse(event.data) as SimulationFrame);
  };
  return socket;
}

export function waitForSocket(socket: WebSocket, timeoutMs = 5000) {
  if (socket.readyState === WebSocket.OPEN) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("El canal de resultados no respondio a tiempo"));
    }, timeoutMs);
    const cleanup = () => {
      window.clearTimeout(timeout);
      socket.removeEventListener("open", handleOpen);
      socket.removeEventListener("error", handleError);
    };
    const handleOpen = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error("No se pudo abrir el canal de resultados"));
    };
    socket.addEventListener("open", handleOpen, { once: true });
    socket.addEventListener("error", handleError, { once: true });
  });
}
