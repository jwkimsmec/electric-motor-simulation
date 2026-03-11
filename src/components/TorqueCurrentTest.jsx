import { useState, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, ReferenceLine
} from "recharts";
import { MOTOR } from "../motorParams.js";

function generateTimeData(loadPercent) {
  const data        = [];
  const loadFactor  = loadPercent / 100;

  const I_noload    = MOTOR.current_low * 0.35;
  const I_steady    = I_noload + (MOTOR.current_low - I_noload) * Math.pow(loadFactor, 0.85);
  const I_startup   = MOTOR.current_low * 6.0;
  const T_steady    = MOTOR.torque_nm * loadFactor;
  const T_startup   = MOTOR.torque_nm * 1.5;

  const tau_mech    = 0.05 + loadFactor * 0.15;
  const tau_elec    = 0.008;
  const slip_steady = 0.005 + MOTOR.slip * loadFactor;
  const rpm_steady  = MOTOR.rpm_sync * (1 - slip_steady);

  const duration    = tau_mech * 5;
  const steps       = Math.floor(duration * MOTOR.sample_rate);
  const downsample  = Math.max(1, Math.floor(steps / 800));
  const rmsWindow   = Math.floor(MOTOR.sample_rate / MOTOR.frequency);
  const iA_buffer   = [];

  for (let i = 0; i <= steps; i++) {
    const t         = i / MOTOR.sample_rate;
    const inrush    = (I_startup - I_steady) * Math.exp(-t / tau_elec);
    const transient = I_steady  * (1 - Math.exp(-t / tau_mech));
    const I_env     = inrush + transient;

    const T_env     = T_startup * Math.exp(-t / tau_elec)
                    + T_steady  * (1 - Math.exp(-t / tau_mech))
                    + T_steady  * 0.15 * Math.exp(-t / (tau_mech * 0.3)) * Math.cos(2 * Math.PI * 8 * t);

    const slip_inst = Math.exp(-t / tau_mech) + slip_steady * (1 - Math.exp(-t / tau_mech));
    const phase_acc = 2 * Math.PI * MOTOR.frequency * t * (1 - slip_inst * 0.3);
    const ia        = I_env * Math.sin(phase_acc);

    iA_buffer.push(ia);
    if (iA_buffer.length > rmsWindow) iA_buffer.shift();
    const rms = Math.sqrt(iA_buffer.reduce((s, v) => s + v * v, 0) / iA_buffer.length);
    const rpm = rpm_steady * (1 - Math.exp(-t / tau_mech));

    if (i % downsample === 0) {
      data.push({
        t:       parseFloat((t * 1000).toFixed(2)),
        current: parseFloat(rms.toFixed(4)),
        torque:  parseFloat(Math.max(0, T_env).toFixed(4)),
        rpm:     parseFloat(rpm.toFixed(1)),
      });
    }
  }
  return {
    data,
    I_steady:   parseFloat(I_steady.toFixed(3)),
    T_steady:   parseFloat(T_steady.toFixed(3)),
    rpm_steady: parseFloat(rpm_steady.toFixed(1)),
    stableTime: parseFloat((tau_mech * 4 * 1000).toFixed(0)),
  };
}

function generateTorqueCurrentCurve() {
  const curve = [];
  for (let load = 0; load <= 200; load += 2) {
    const loadFactor = load / 100;
    const I_noload   = MOTOR.current_low * 0.35;
    const I_rms      = I_noload + (MOTOR.current_low - I_noload) * Math.pow(loadFactor, 0.85);
    const torque     = MOTOR.torque_nm * loadFactor;
    curve.push({
      torque:  parseFloat(torque.toFixed(3)),
      current: parseFloat(I_rms.toFixed(3)),
      load,
    });
  }
  return curve;
}

const LOAD_PRESETS = [
  { label: "No Load",   value: 0,   color: "#4ade80" },
  { label: "25% Load",  value: 25,  color: "#a3e635" },
  { label: "50% Load",  value: 50,  color: "#facc15" },
  { label: "75% Load",  value: 75,  color: "#fb923c" },
  { label: "Full Load", value: 100, color: "#ef4444" },
];

const CARD = ({ label, val, color, unit }) => (
  <div style={{ background: "#1e293b", borderRadius: 8, padding: "10px 16px", minWidth: 120 }}>
    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>{label}</div>
    <div style={{ fontSize: 15, color, fontWeight: "bold" }}>{val} <span style={{ fontSize: 11, color: "#64748b" }}>{unit}</span></div>
  </div>
);

export default function TorqueCurrentTest() {
  const [loadPercent, setLoadPercent] = useState(100);
  const [result,      setResult]      = useState({ data: [], I_steady: 0, T_steady: 0, rpm_steady: 0, stableTime: 0 });
  const [curveData,   setCurveData]   = useState([]);

  useEffect(() => { setResult(generateTimeData(loadPercent)); },  [loadPercent]);
  useEffect(() => { setCurveData(generateTorqueCurrentCurve()); }, []);

  const preset = LOAD_PRESETS.find(p => p.value === loadPercent) || LOAD_PRESETS[4];

  return (
    <div>
      <h2 style={{ color: "#38bdf8", marginBottom: 4 }}>🔄 Torque — Current — Speed Test</h2>
      <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 16 }}>
        4 factors shown across 3 focused 2D graphs — each graph shows max 2 variables
      </p>

      {/* Load selector */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        {LOAD_PRESETS.map(p => (
          <button key={p.value} onClick={() => setLoadPercent(p.value)}
            style={{
              padding: "9px 18px", borderRadius: 8, border: "none", cursor: "pointer",
              background: loadPercent === p.value ? p.color : "#1e293b",
              color: loadPercent === p.value ? "#000" : "#94a3b8",
              fontWeight: loadPercent === p.value ? "bold" : "normal", fontSize: 13
            }}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Slider */}
      <div style={{ background: "#1e293b", borderRadius: 10, padding: "14px 20px", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ color: "#94a3b8", fontSize: 13 }}>Load: <strong style={{ color: preset.color }}>{loadPercent}%</strong></span>
          <span style={{ color: "#94a3b8", fontSize: 13 }}>Stable at: <strong style={{ color: "#fbbf24" }}>{result.stableTime} ms</strong></span>
        </div>
        <input type="range" min="0" max="100" value={loadPercent}
          onChange={e => setLoadPercent(Number(e.target.value))}
          style={{ width: "100%", accentColor: preset.color }} />
      </div>

      {/* Stat cards */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <CARD label="Steady Current" val={result.I_steady} color="#38bdf8"  unit="A"   />
        <CARD label="Steady Torque"  val={result.T_steady} color="#fb923c"  unit="Nm"  />
        <CARD label="Steady Speed"   val={result.rpm_steady} color="#a78bfa" unit="rpm" />
        <CARD label="Stable Time"    val={result.stableTime} color="#fbbf24" unit="ms"  />
        <CARD label="Inrush Current" val={(MOTOR.current_low * 6).toFixed(2)} color="#ef4444" unit="A" />
      </div>

      {/* ── GRAPH 1: Current vs Time ── */}
      <div style={{ background: "#1e293b", borderRadius: 10, padding: 16, marginBottom: 20 }}>
        <h3 style={{ color: "#38bdf8", margin: "0 0 4px" }}>Graph 1 — Current vs Time</h3>
        <p style={{ color: "#64748b", fontSize: 12, margin: "0 0 12px" }}>RMS stator current from startup to stable state</p>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={result.data} margin={{ top: 5, right: 30, left: 10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#0f172a" />
            <XAxis dataKey="t"
              label={{ value: "Time (ms)", position: "insideBottom", offset: -10, fill: "#94a3b8" }}
              tick={{ fill: "#94a3b8", fontSize: 11 }} />
            <YAxis
              label={{ value: "Current (A)", angle: -90, position: "insideLeft", fill: "#38bdf8" }}
              tick={{ fill: "#38bdf8", fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: "#0f172a", border: "1px solid #334155", color: "#e2e8f0" }}
              formatter={v => [v + " A", "RMS Current"]}
              labelFormatter={l => "t = " + l + " ms"} />
            <ReferenceLine x={result.stableTime} stroke="#fbbf24" strokeDasharray="5 3"
              label={{ value: "Stable", fill: "#fbbf24", fontSize: 10 }} />
            <Line type="monotone" dataKey="current" stroke="#38bdf8" dot={false} strokeWidth={2.5} name="RMS Current" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ── GRAPH 2: Torque vs Time ── */}
      <div style={{ background: "#1e293b", borderRadius: 10, padding: 16, marginBottom: 20 }}>
        <h3 style={{ color: "#fb923c", margin: "0 0 4px" }}>Graph 2 — Torque vs Time</h3>
        <p style={{ color: "#64748b", fontSize: 12, margin: "0 0 12px" }}>Shaft torque transient from startup to stable state</p>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={result.data} margin={{ top: 5, right: 30, left: 10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#0f172a" />
            <XAxis dataKey="t"
              label={{ value: "Time (ms)", position: "insideBottom", offset: -10, fill: "#94a3b8" }}
              tick={{ fill: "#94a3b8", fontSize: 11 }} />
            <YAxis
              label={{ value: "Torque (Nm)", angle: -90, position: "insideLeft", fill: "#fb923c" }}
              tick={{ fill: "#fb923c", fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: "#0f172a", border: "1px solid #334155", color: "#e2e8f0" }}
              formatter={v => [v + " Nm", "Torque"]}
              labelFormatter={l => "t = " + l + " ms"} />
            <ReferenceLine x={result.stableTime} stroke="#fbbf24" strokeDasharray="5 3"
              label={{ value: "Stable", fill: "#fbbf24", fontSize: 10 }} />
            <Line type="monotone" dataKey="torque" stroke="#fb923c" dot={false} strokeWidth={2.5} name="Torque" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ── GRAPH 3: Speed vs Time ── */}
      <div style={{ background: "#1e293b", borderRadius: 10, padding: 16, marginBottom: 20 }}>
        <h3 style={{ color: "#a78bfa", margin: "0 0 4px" }}>Graph 3 — Speed vs Time</h3>
        <p style={{ color: "#64748b", fontSize: 12, margin: "0 0 12px" }}>Rotor speed acceleration from standstill to rated speed</p>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={result.data} margin={{ top: 5, right: 30, left: 10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#0f172a" />
            <XAxis dataKey="t"
              label={{ value: "Time (ms)", position: "insideBottom", offset: -10, fill: "#94a3b8" }}
              tick={{ fill: "#94a3b8", fontSize: 11 }} />
            <YAxis
              label={{ value: "Speed (rpm)", angle: -90, position: "insideLeft", fill: "#a78bfa" }}
              tick={{ fill: "#a78bfa", fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: "#0f172a", border: "1px solid #334155", color: "#e2e8f0" }}
              formatter={v => [v + " rpm", "Speed"]}
              labelFormatter={l => "t = " + l + " ms"} />
            <ReferenceLine x={result.stableTime} stroke="#fbbf24" strokeDasharray="5 3"
              label={{ value: "Stable", fill: "#fbbf24", fontSize: 10 }} />
            <ReferenceLine y={result.rpm_steady} stroke="#a78bfa" strokeDasharray="5 3"
              label={{ value: result.rpm_steady + " rpm", fill: "#a78bfa", fontSize: 10 }} />
            <Line type="monotone" dataKey="rpm" stroke="#a78bfa" dot={false} strokeWidth={2.5} name="Speed" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ── GRAPH 4: Torque vs Current (X-Y) ── */}
      <div style={{ background: "#1e293b", borderRadius: 10, padding: 16, marginBottom: 20 }}>
        <h3 style={{ color: "#4ade80", margin: "0 0 4px" }}>Graph 4 — Torque vs Current (Operating Curve)</h3>
        <p style={{ color: "#64748b", fontSize: 12, margin: "0 0 12px" }}>How current must increase to produce more torque — 0% to 200% load</p>
        <ResponsiveContainer width="100%" height={280}>
          <ScatterChart margin={{ top: 5, right: 30, left: 10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#0f172a" />
            <XAxis dataKey="current" type="number" name="Current"
              label={{ value: "RMS Current (A)", position: "insideBottom", offset: -10, fill: "#94a3b8" }}
              tick={{ fill: "#94a3b8", fontSize: 11 }} domain={["auto", "auto"]} />
            <YAxis dataKey="torque" type="number" name="Torque"
              label={{ value: "Torque (Nm)", angle: -90, position: "insideLeft", fill: "#4ade80" }}
              tick={{ fill: "#4ade80", fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: "#0f172a", border: "1px solid #334155", color: "#e2e8f0" }}
              formatter={(v, name) => [name === "Current" ? v + " A" : v + " Nm", name]}
              cursor={{ strokeDasharray: "3 3" }} />
            <ReferenceLine x={result.I_steady} stroke="#38bdf8" strokeDasharray="4 2"
              label={{ value: "Operating", fill: "#38bdf8", fontSize: 10 }} />
            <ReferenceLine y={result.T_steady} stroke="#fb923c" strokeDasharray="4 2"
              label={{ value: result.T_steady + " Nm", fill: "#fb923c", fontSize: 10 }} />
            <Scatter data={curveData} fill="#4ade80" line={{ stroke: "#4ade80", strokeWidth: 2 }} lineType="joint" shape="circle" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
