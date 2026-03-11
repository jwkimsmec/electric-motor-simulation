import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { MOTOR } from "../motorParams.js";

function generateData(duration, brokenBars) {
  const data = [];
  const omega = 2 * Math.PI * MOTOR.frequency;
  const peak = MOTOR.current_low * Math.sqrt(2);
  const steps = Math.floor(duration * MOTOR.sample_rate);

  // Broken bar fault introduces sidebands at (1 ± 2s)f
  const s = MOTOR.slip;
  const f_lower = MOTOR.frequency * (1 - 2 * s);
  const f_upper = MOTOR.frequency * (1 + 2 * s);
  const faultAmp = brokenBars * 0.08; // amplitude grows with broken bars

  for (let i = 0; i <= steps; i++) {
    const t = i / MOTOR.sample_rate;
    const env = t < 0.01 ? t / 0.01 : 1;

    // Healthy current
    const IA_h = env * peak * Math.sin(omega * t);
    const IB_h = env * peak * Math.sin(omega * t - (2 * Math.PI) / 3);
    const IC_h = env * peak * Math.sin(omega * t + (2 * Math.PI) / 3);

    // Faulty current = healthy + sideband modulation
    const fault = brokenBars > 0
      ? faultAmp * (
          Math.sin(2 * Math.PI * f_lower * t) +
          Math.sin(2 * Math.PI * f_upper * t)
        )
      : 0;

    const IA_f = env * (peak + fault * 0.5) * Math.sin(omega * t + fault * 0.05);
    const IB_f = env * (peak + fault * 0.5) * Math.sin(omega * t - (2 * Math.PI) / 3 + fault * 0.05);
    const IC_f = env * (peak + fault * 0.5) * Math.sin(omega * t + (2 * Math.PI) / 3 + fault * 0.05);

    if (i % 100 === 0) {
      data.push({
        t: parseFloat((t * 1000).toFixed(3)),
        IA_healthy: parseFloat(IA_h.toFixed(4)),
        IA_faulty:  parseFloat(IA_f.toFixed(4)),
        IB_healthy: parseFloat(IB_h.toFixed(4)),
        IB_faulty:  parseFloat(IB_f.toFixed(4)),
        IC_healthy: parseFloat(IC_h.toFixed(4)),
        IC_faulty:  parseFloat(IC_f.toFixed(4)),
      });
    }
  }
  return data;
}

export default function FaultComparison() {
  const [brokenBars, setBrokenBars] = useState(1);
  const [duration, setDuration] = useState(0.1);
  const [phase, setPhase] = useState("A");
  const [data, setData] = useState([]);

  useEffect(() => {
    setData(generateData(duration, brokenBars));
  }, [duration, brokenBars]);

  const phaseKeys = {
    A: { healthy: "IA_healthy", faulty: "IA_faulty" },
    B: { healthy: "IB_healthy", faulty: "IB_faulty" },
    C: { healthy: "IC_healthy", faulty: "IC_faulty" },
  };

  const faultSeverity = ["None", "Mild", "Moderate", "Severe"];

  return (
    <div>
      <h2 style={{ color: "#38bdf8", marginBottom: 4 }}>🔴 Broken Rotor Bar — Fault Comparison</h2>
      <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 20 }}>
        Fault introduces current sidebands at (1 ± 2s)f = {(MOTOR.frequency * (1 - 2 * MOTOR.slip)).toFixed(2)} Hz and {(MOTOR.frequency * (1 + 2 * MOTOR.slip)).toFixed(2)} Hz
      </p>

      {/* Controls */}
      <div style={{ display: "flex", gap: 24, marginBottom: 20, flexWrap: "wrap" }}>

        {/* Broken Bars */}
        <div style={{ background: "#1e293b", borderRadius: 10, padding: "14px 20px" }}>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>Broken Rotor Bars</div>
          <div style={{ display: "flex", gap: 8 }}>
            {[0, 1, 2, 3].map(n => (
              <button key={n} onClick={() => setBrokenBars(n)}
                style={{
                  width: 44, height: 44, borderRadius: 8, border: "none", cursor: "pointer",
                  background: brokenBars === n ? (n === 0 ? "#22c55e" : n === 1 ? "#f59e0b" : n === 2 ? "#f97316" : "#ef4444") : "#0f172a",
                  color: "#fff", fontWeight: "bold", fontSize: 16
                }}>
                {n}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 8 }}>
            Severity: <span style={{ color: brokenBars === 0 ? "#22c55e" : brokenBars === 1 ? "#f59e0b" : brokenBars === 2 ? "#f97316" : "#ef4444" }}>
              {faultSeverity[brokenBars]}
            </span>
          </div>
        </div>

        {/* Phase selector */}
        <div style={{ background: "#1e293b", borderRadius: 10, padding: "14px 20px" }}>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>Phase</div>
          <div style={{ display: "flex", gap: 8 }}>
            {["A", "B", "C"].map(p => (
              <button key={p} onClick={() => setPhase(p)}
                style={{
                  width: 44, height: 44, borderRadius: 8, border: "none", cursor: "pointer",
                  background: phase === p ? "#0ea5e9" : "#0f172a",
                  color: "#fff", fontWeight: "bold"
                }}>
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Time window */}
        <div style={{ background: "#1e293b", borderRadius: 10, padding: "14px 20px" }}>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>Time Window</div>
          <div style={{ display: "flex", gap: 8 }}>
            {[0.05, 0.1, 0.2, 0.5].map(d => (
              <button key={d} onClick={() => setDuration(d)}
                style={{
                  padding: "8px 12px", borderRadius: 8, border: "none", cursor: "pointer",
                  background: duration === d ? "#0ea5e9" : "#0f172a",
                  color: duration === d ? "#fff" : "#94a3b8",
                  fontWeight: duration === d ? "bold" : "normal"
                }}>
                {d * 1000}ms
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e3a52" />
          <XAxis dataKey="t"
            label={{ value: "Time (ms)", position: "insideBottom", offset: -10, fill: "#94a3b8" }}
            tick={{ fill: "#94a3b8", fontSize: 11 }} />
          <YAxis
            label={{ value: "Current (A)", angle: -90, position: "insideLeft", fill: "#94a3b8" }}
            tick={{ fill: "#94a3b8", fontSize: 11 }} domain={[-5.5, 5.5]} />
          <Tooltip
            contentStyle={{ background: "#1e293b", border: "1px solid #334155", color: "#e2e8f0" }}
            formatter={(v, name) => [v + " A", name]}
            labelFormatter={l => "t = " + l + " ms"} />
          <Legend wrapperStyle={{ color: "#94a3b8" }} />
          <Line type="monotone" dataKey={phaseKeys[phase].healthy}
            stroke="#4ade80" dot={false} strokeWidth={2} name={"Phase " + phase + " Healthy"} />
          <Line type="monotone" dataKey={phaseKeys[phase].faulty}
            stroke="#ef4444" dot={false} strokeWidth={2} strokeDasharray="4 2"
            name={"Phase " + phase + " Faulty (" + brokenBars + " bar" + (brokenBars !== 1 ? "s)" : ")")} />
        </LineChart>
      </ResponsiveContainer>

      {/* Info cards */}
      <div style={{ display: "flex", gap: 16, marginTop: 20, flexWrap: "wrap" }}>
        {[
          ["Slip", (MOTOR.slip * 100).toFixed(2) + "%"],
          ["Lower Sideband", (MOTOR.frequency * (1 - 2 * MOTOR.slip)).toFixed(2) + " Hz"],
          ["Upper Sideband", (MOTOR.frequency * (1 + 2 * MOTOR.slip)).toFixed(2) + " Hz"],
          ["Broken Bars", brokenBars + " / " + MOTOR.rotor_bars],
          ["Fault Level", faultSeverity[brokenBars]],
          ["Peak Current", (MOTOR.current_low * Math.sqrt(2)).toFixed(2) + " A"],
        ].map(([label, val]) => (
          <div key={label} style={{ background: "#1e293b", borderRadius: 8, padding: "10px 16px", minWidth: 130 }}>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 15, color: "#38bdf8", fontWeight: "bold" }}>{val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
