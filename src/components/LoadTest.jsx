import { useState, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar
} from "recharts";
import { MOTOR } from "../motorParams.js";

function generateLoadData(duration, loadPercent) {
  const data = [];
  const omega = 2 * Math.PI * MOTOR.frequency;

  // Load affects current magnitude and slip
  const loadFactor = loadPercent / 100;
  const I_noload = MOTOR.current_low * 0.35;       // no-load current ~35% of rated
  const I_load = I_noload + (MOTOR.current_low - I_noload) * loadFactor;
  const peak = I_load * Math.sqrt(2);

  // Slip increases with load
  const slip = MOTOR.slip * loadFactor + 0.005;
  const rpm = MOTOR.rpm_sync * (1 - slip);

  // Small torque ripple at load
  const ripple = loadFactor * 0.04;

  const steps = Math.floor(duration * MOTOR.sample_rate);
  for (let i = 0; i <= steps; i++) {
    const t = i / MOTOR.sample_rate;
    const env = t < 0.015 ? t / 0.015 : 1;
    const r = 1 + ripple * Math.sin(2 * Math.PI * (rpm / 60) * MOTOR.poles / 2 * t);

    if (i % 100 === 0) {
      data.push({
        t: parseFloat((t * 1000).toFixed(3)),
        IA: parseFloat((env * peak * r * Math.sin(omega * t)).toFixed(4)),
        IB: parseFloat((env * peak * r * Math.sin(omega * t - (2 * Math.PI) / 3)).toFixed(4)),
        IC: parseFloat((env * peak * r * Math.sin(omega * t + (2 * Math.PI) / 3)).toFixed(4)),
      });
    }
  }
  return { data, I_rms: parseFloat(I_load.toFixed(3)), rpm: parseFloat(rpm.toFixed(1)), slip: parseFloat((slip * 100).toFixed(2)) };
}

const LOAD_PRESETS = [
  { label: "No Load",    value: 0,   color: "#4ade80" },
  { label: "25% Load",   value: 25,  color: "#a3e635" },
  { label: "50% Load",   value: 50,  color: "#facc15" },
  { label: "75% Load",   value: 75,  color: "#fb923c" },
  { label: "Full Load",  value: 100, color: "#ef4444" },
];

export default function LoadTest() {
  const [loadPercent, setLoadPercent] = useState(0);
  const [duration, setDuration] = useState(0.1);
  const [result, setResult] = useState({ data: [], I_rms: 0, rpm: 0, slip: 0 });
  const [compareMode, setCompareMode] = useState(false);
  const [compareData, setCompareData] = useState([]);

  useEffect(() => {
    const r = generateLoadData(duration, loadPercent);
    setResult(r);
  }, [duration, loadPercent]);

  useEffect(() => {
    // Build bar chart data for all load levels
    const bars = LOAD_PRESETS.map(p => {
      const r = generateLoadData(0.1, p.value);
      return {
        load: p.label,
        current: r.I_rms,
        rpm: r.rpm,
        slip: r.slip,
        fill: p.color,
      };
    });
    setCompareData(bars);
  }, []);

  const preset = LOAD_PRESETS.find(p => p.value === loadPercent) || LOAD_PRESETS[0];

  return (
    <div>
      <h2 style={{ color: "#38bdf8", marginBottom: 4 }}>⚖️ Virtual Dynamo — Load Test</h2>
      <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 20 }}>
        Simulates stator current under varying mechanical load on the motor shaft
      </p>

      {/* Load preset buttons */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        {LOAD_PRESETS.map(p => (
          <button key={p.value} onClick={() => setLoadPercent(p.value)}
            style={{
              padding: "10px 18px", borderRadius: 8, border: "none", cursor: "pointer",
              background: loadPercent === p.value ? p.color : "#1e293b",
              color: loadPercent === p.value ? "#000" : "#94a3b8",
              fontWeight: loadPercent === p.value ? "bold" : "normal",
              fontSize: 13
            }}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Slider */}
      <div style={{ background: "#1e293b", borderRadius: 10, padding: "16px 20px", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ color: "#94a3b8", fontSize: 13 }}>Load: <strong style={{ color: preset.color }}>{loadPercent}%</strong></span>
          <span style={{ color: "#94a3b8", fontSize: 13 }}>Torque: <strong style={{ color: "#38bdf8" }}>{(MOTOR.torque_nm * loadPercent / 100).toFixed(2)} Nm</strong></span>
        </div>
        <input type="range" min="0" max="100" value={loadPercent}
          onChange={e => setLoadPercent(Number(e.target.value))}
          style={{ width: "100%", accentColor: preset.color }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#475569", marginTop: 4 }}>
          <span>No Load</span><span>Full Load</span>
        </div>
      </div>

      {/* Time window */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[0.05, 0.1, 0.2, 0.5].map(d => (
          <button key={d} onClick={() => setDuration(d)}
            style={{
              padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer",
              background: duration === d ? "#0ea5e9" : "#1e293b",
              color: duration === d ? "#fff" : "#94a3b8",
              fontWeight: duration === d ? "bold" : "normal", fontSize: 13
            }}>
            {d * 1000} ms
          </button>
        ))}

        <button onClick={() => setCompareMode(!compareMode)}
          style={{
            padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer",
            background: compareMode ? "#7c3aed" : "#1e293b",
            color: compareMode ? "#fff" : "#94a3b8", fontSize: 13, marginLeft: 16
          }}>
          📊 {compareMode ? "Hide Compare" : "Compare All Loads"}
        </button>
      </div>

      {/* Current waveform */}
      <ResponsiveContainer width="100%" height={340}>
        <LineChart data={result.data} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e3a52" />
          <XAxis dataKey="t"
            label={{ value: "Time (ms)", position: "insideBottom", offset: -10, fill: "#94a3b8" }}
            tick={{ fill: "#94a3b8", fontSize: 11 }} />
          <YAxis
            label={{ value: "Current (A)", angle: -90, position: "insideLeft", fill: "#94a3b8" }}
            tick={{ fill: "#94a3b8", fontSize: 11 }} domain={[-6, 6]} />
          <Tooltip
            contentStyle={{ background: "#1e293b", border: "1px solid #334155", color: "#e2e8f0" }}
            formatter={(v, name) => [v + " A", name]}
            labelFormatter={l => "t = " + l + " ms"} />
          <Legend wrapperStyle={{ color: "#94a3b8" }} />
          <Line type="monotone" dataKey="IA" stroke="#38bdf8" dot={false} strokeWidth={2} name="Phase A" />
          <Line type="monotone" dataKey="IB" stroke="#f472b6" dot={false} strokeWidth={2} name="Phase B" />
          <Line type="monotone" dataKey="IC" stroke="#4ade80" dot={false} strokeWidth={2} name="Phase C" />
        </LineChart>
      </ResponsiveContainer>

      {/* Stats */}
      <div style={{ display: "flex", gap: 14, marginTop: 20, flexWrap: "wrap" }}>
        {[
          ["Load",       loadPercent + "%",               preset.color],
          ["RMS Current", result.I_rms + " A",            "#38bdf8"],
          ["Speed",      result.rpm + " rpm",             "#a78bfa"],
          ["Slip",       result.slip + "%",               "#fb923c"],
          ["Torque",     (MOTOR.torque_nm * loadPercent / 100).toFixed(2) + " Nm", "#facc15"],
          ["Power Out",  (MOTOR.power_w * loadPercent / 100).toFixed(0) + " W",   "#4ade80"],
        ].map(([label, val, color]) => (
          <div key={label} style={{ background: "#1e293b", borderRadius: 8, padding: "10px 16px", minWidth: 120 }}>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 15, color: color, fontWeight: "bold" }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Compare bar chart */}
      {compareMode && (
        <div style={{ marginTop: 28 }}>
          <h3 style={{ color: "#94a3b8", marginBottom: 12 }}>📊 RMS Current vs Load Level</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={compareData} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e3a52" />
              <XAxis dataKey="load" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }}
                label={{ value: "I rms (A)", angle: -90, position: "insideLeft", fill: "#94a3b8" }} />
              <Tooltip
                contentStyle={{ background: "#1e293b", border: "1px solid #334155", color: "#e2e8f0" }}
                formatter={(v) => [v + " A", "RMS Current"]} />
              <Bar dataKey="current" radius={[6, 6, 0, 0]}>
                {compareData.map((entry, i) => (
                  <rect key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
