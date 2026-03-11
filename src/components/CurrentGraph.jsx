import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { MOTOR } from "../motorParams.js";

function generateData(duration) {
  const data = [];
  const omega = 2 * Math.PI * MOTOR.frequency;
  const peak = MOTOR.current_low * Math.sqrt(2);
  const steps = Math.floor(duration * MOTOR.sample_rate);
  for (let i = 0; i <= steps; i++) {
    const t = i / MOTOR.sample_rate;
    const env = t < 0.01 ? t / 0.01 : 1;
    if (i % 100 === 0) {
      data.push({
        t: parseFloat((t * 1000).toFixed(3)),
        IA: parseFloat((env * peak * Math.sin(omega * t)).toFixed(4)),
        IB: parseFloat((env * peak * Math.sin(omega * t - (2 * Math.PI) / 3)).toFixed(4)),
        IC: parseFloat((env * peak * Math.sin(omega * t + (2 * Math.PI) / 3)).toFixed(4)),
      });
    }
  }
  return data;
}

export default function CurrentGraph() {
  const [duration, setDuration] = useState(0.1);
  const [data, setData] = useState([]);

  useEffect(() => {
    setData(generateData(duration));
  }, [duration]);

  return (
    <div>
      <h2 style={{ color: "#38bdf8", marginBottom: 4 }}>⚡ Healthy Stator Current — 3 Phase</h2>
      <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 16 }}>
        Peak: {(MOTOR.current_low * Math.sqrt(2)).toFixed(2)} A | RMS: {MOTOR.current_low} A | 120° phase shift
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[0.05, 0.1, 0.2, 0.5].map(d => (
          <button key={d} onClick={() => setDuration(d)}
            style={{
              padding: "6px 16px", borderRadius: 6, border: "none", cursor: "pointer",
              background: duration === d ? "#0ea5e9" : "#1e293b",
              color: duration === d ? "#fff" : "#94a3b8",
              fontWeight: duration === d ? "bold" : "normal"
            }}>
            {d * 1000} ms
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={380}>
        <LineChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e3a52" />
          <XAxis dataKey="t" label={{ value: "Time (ms)", position: "insideBottom", offset: -10, fill: "#94a3b8" }} tick={{ fill: "#94a3b8" }} />
          <YAxis label={{ value: "Current (A)", angle: -90, position: "insideLeft", fill: "#94a3b8" }} tick={{ fill: "#94a3b8" }} domain={[-5, 5]} />
          <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", color: "#e2e8f0" }}
            formatter={(v, name) => [v + " A", name]} labelFormatter={l => "t = " + l + " ms"} />
          <Legend wrapperStyle={{ color: "#94a3b8" }} />
          <Line type="monotone" dataKey="IA" stroke="#38bdf8" dot={false} strokeWidth={2} name="Phase A" />
          <Line type="monotone" dataKey="IB" stroke="#f472b6" dot={false} strokeWidth={2} name="Phase B" />
          <Line type="monotone" dataKey="IC" stroke="#4ade80" dot={false} strokeWidth={2} name="Phase C" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
