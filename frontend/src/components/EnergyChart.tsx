import {
  Area,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ComposedChart
} from "recharts";
import type { EnergyPoint } from "../types/physics";

export function EnergyChart({ data }: { data: EnergyPoint[] }) {
  return (
    <div className="chart" aria-label="Grafico de energia y deriva numerica">
      <div className="panel-heading">
        <h2>Energía por paso</h2>
        <span>GeV* (unidades educativas)</span>
      </div>
      <ResponsiveContainer width="100%" height={210}>
        <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="#263244" strokeDasharray="3 3" />
          <XAxis
            dataKey="step"
            stroke="#94A3B8"
            tick={{ fontSize: 11 }}
            label={{ value: "Paso de simulación", position: "insideBottom", offset: -4, fill: "#94A3B8", fontSize: 11 }}
          />
          <YAxis
            stroke="#94A3B8"
            tick={{ fontSize: 11 }}
            width={44}
            label={{ value: "Energía (GeV*)", angle: -90, position: "insideLeft", fill: "#94A3B8", fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{
              background: "#0a0a0a",
              border: "1px solid #2D3748",
              color: "#F8FAFC"
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area type="monotone" dataKey="potential" stroke="#62A8FF" fill="#62A8FF33" name="Potencial" />
          <Line type="monotone" dataKey="kinetic" stroke="#F2B84B" dot={false} name="Cinética" />
          <Line type="monotone" dataKey="total" stroke="#5BE49B" dot={false} name="Total" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

