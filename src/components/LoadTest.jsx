import { useState, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, ReferenceLine
} from "recharts";
import { MOTOR } from "../motorParams.js";

function getTimeToStable(loadPercent) {
  const loadFactor = loadPercent / 100;
  const tau_mech = 0.05 + loadFactor * 0.15;
  return parseFloat((tau_mech * 5).toFixed(3));
}

function generateLoadData(loadPercent) {
  const data = [];
  const omega     = 2 * Math.PI * MOTOR.frequency;
  const loadFactor = loadPercent / 100;

  const I_noload  = MOTOR.current_low * 0.35;
  const I_rated   = MOTOR.current_low;
  const I_startup = MOTOR.current_low * 6.0;
  const I_steady  = I_noload + (I_rated - I_noload) * loadFactor;

  const tau_mech  = 0.05 + loadFactor * 0.15;
  const tau_elec  = 0.008;
  const slip_steady = 0.005 + MOTOR.slip * loadFactor;
  const rpm_steady  = MOTOR.rpm_sync * (1 - slip_steady);
  const ripple      = loadFactor * 0.03;

  const duration    = tau_mech * 5;
  const stableTime  = parseFloat((tau_mech * 4 * 1000).toFixed(0));

  const steps      = Math.floor(duration * MOTOR.sample_rate);
  const downsample = Math.max(1, Math.floor(steps / 1000));

  // RMS window: one full cycle = 1/60s samples
  const rmsWindow  = Math.floor(MOTOR.sample_rate / MOTOR.frequency);
  const iA_buffer  = [];

  for (let i = 0; i <= steps; i++) {
    const t         = i / MOTOR.sample_rate;
    const inrush    = (I_startup - I_steady) * Math.exp(-t / tau_elec);
    const transient = I_steady * (1 - Math.exp(-t / tau_mech));
    const I_env     = inrush + transient;

    const slip_inst = Math.exp(-t / tau_mech) + slip_steady * (1 - Math.exp(-t / tau_mech));
    const phase_acc = 2 * Math.PI * MOTOR.frequency * t * (1 - slip_inst * 0.3);
    const r         = 1 + ripple * Math.sin(2 * Math.PI * (rpm_steady / 60) * MOTOR.poles / 2 * t);

    const ia = I_env * r * Math.sin(phase_acc);

    // Rolling RMS buffer (one cycle window)
    iA_buffer.push(ia);
    if (iA_buffer.length > rmsWindow) iA_buffer.shift();
    const rms = Math.sqrt(iA_buffer.reduce((s, v) => s + v * v, 0) / iA_buffer.length);

    if (i % downsample === 0) {
      data.push({
        t:          parseFloat((t * 1000).toFixed(2)),
        IA:         parseFloat(ia.toFixed(4)),
        IB:         parseFloat((I_env * r * Math.sin(phase_acc - (2 * Math.PI) / 3)).toFixed(4)),
        IC:         parseFloat((I_env * r * Math.sin(phase_acc + (2 * Math.PI) / 3)).toFixed(4)),
        I_envelope: parseFloat(I_env.toFixed(4)),
        I_steady:   parseFloat(I_steady.toFixed(4)),
        I_rms_live: parseFloat(rms.toFixed(4)),
      });
    }
  }

  return {
    data,
    I_rms:      parseFloat(I_steady.toFixed(3)),
    I_start:    parseFloat(I_startup.toFixed(3)),
    rpm:        parseFloat(rpm_steady.toFixed(1)),
    slip:       parseFloat((slip_steady * 100).toFixed(2)),
    duration:   parseFloat((duration * 1000).toFixed(0)),
    stableTime,
    tau_mech:   parseFloat((tau_mech * 1000).toFixed(0)),
  };
}

const LOAD_PRESETS = [
  { label: "No Load",   value: 0,   color: "#4ade80" },
  { label: "25% Load",  value: 25,  color: "#a3e635" },
  { label: "50% Load",  value: 50,  color: "#facc15" },
  { label: "75% Load",  value: 75,  color: "#fb923c" },
  { label: "Full Load", value: 100, color: "#ef4444" },
];

export default function LoadTest() {
  const [loadPercent,  setLoadPercent]  = useState(0);
  const [result,       setResult]       = useState({ data: [], I_rms: 0, I_start: 0, rpm: 0, slip: 0, duration: 0, stableTime: 0, tau_mech: 0 });
  const [showAC,       setShowAC]       = useState(true);
  const [showEnvelope, setShowEnvelope] = useState(false);
  const [showRMS,      setShowRMS]      = useState(true);
  const [showSteady,   setShowSteady]   = useState(true);
  const [compareMode,  setCompareMode]  = useState(false);
  const [compareData,  setCompareData]  = useState([]);
  const [viewMode,     setViewMode]     = useState("both"); // "both" | "ac" | "rms"

  useEffect(() => {
    setResult(generateLoadData(loadPercent));
  }, [loadPercent]);

  useEffect(() => {
    setCompareData(LOAD_PRESETS.map(p => {
      const r = generateLoadData(p.value);
      return { load: p.label, current: r.I_rms, rpm: r.rpm, stableTime: r.stableTime, color: p.color };
    }));
  }, []);

  const preset = LOAD_PRESETS.find(p => p.value === loadPercent) || LOAD_PRESETS[0];

  return (
    <div>
      <h2 style={{ color: "#38bdf8", marginBottom: 4 }}>⚖️ Virtual Dynamo — Full Startup to Stable</h2>
      <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 20 }}>
        Simulation auto-runs until steady state. RMS tracking shows clamp-meter style magnitude curve.
      </p>

      {/* Load presets */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        {LOAD_PRESETS.map(p => (
          <button key={p.value} onClick={() => setLoadPercent(p.value)}
            style={{
              padding: "10px 18px", borderRadius: 8, border: "none", cursor: "pointer",
              background: loadPercent === p.value ? p.color : "#1e293b",
              color: loadPercent === p.value ? "#000" : "#94a3b8",
              fontWeight: loadPercent === p.value ? "bold" : "normal", fontSize: 13
            }}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Slider */}
      <div style={{ background: "#1e293b", borderRadius: 10, padding: "16px 20px", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ color: "#94a3b8", fontSize: 13 }}>
            Load: <strong style={{ color: preset.color }}>{loadPercent}%</strong>
          </span>
          <span style={{ color: "#94a3b8", fontSize: 13 }}>
            Stable at: <strong style={{ color: "#fbbf24" }}>{result.stableTime} ms</strong>
            &nbsp;|&nbsp; τ: <strong style={{ color: "#a78bfa" }}>{result.tau_mech} ms</strong>
          </span>
        </div>
        <input type="range" min="0" max="100" value={loadPercent}
          onChange={e => setLoadPercent(Number(e.target.value))}
          style={{ width: "100%", accentColor: preset.color }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#475569", marginTop: 4 }}>
          <span>No Load (250ms)</span><span>Full Load (1000ms)</span>
        </div>
      </div>

      {/* View mode */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <span style={{ color: "#64748b", fontSize: 13, alignSelf: "center" }}>View:</span>
        {[
          { id: "both", label: "AC + RMS" },
          { id: "ac",   label: "AC Only" },
          { id: "rms",  label: "RMS Only" },
        ].map(v => (
          <button key={v.id} onClick={() => setViewMode(v.id)}
            style={{
              padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer",
              background: viewMode === v.id ? "#0ea5e9" : "#1e293b",
              color: viewMode === v.id ? "#fff" : "#94a3b8", fontSize: 13
            }}>
            {v.label}
          </button>
        ))}
        <button onClick={() => setShowSteady(!showSteady)}
          style={{
            padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer",
            background: showSteady ? "#0f766e" : "#1e293b", color: "#fff", fontSize: 13, marginLeft: 8
          }}>
          {showSteady ? "➖ Hide Steady" : "➖ Show Steady"}
        </button>
        <button onClick={() => setCompareMode(!compareMode)}
          style={{
            padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer",
            background: compareMode ? "#7c3aed" : "#1e293b", color: "#fff", fontSize: 13
          }}>
          📊 {compareMode ? "Hide Compare" : "Compare Loads"}
        </button>
      </div>

      {/* Legend explanation */}
      <div style={{ display: "flex", gap: 16, marginBottom: 12, flexWrap: "wrap" }}>
        {viewMode !== "rms" && (
          <>
            <span style={{ fontSize: 12, color: "#38bdf8" }}>━ Phase A (AC)</span>
            <span style={{ fontSize: 12, color: "#f472b6" }}>━ Phase B (AC)</span>
            <span style={{ fontSize: 12, color: "#4ade80" }}>━ Phase C (AC)</span>
          </>
        )}
        {viewMode !== "ac" && (
          <span style={{ fontSize: 12, color: "#ff9800" }}>━━ RMS (clamp meter)</span>
        )}
        {showSteady && (
          <span style={{ fontSize: 12, color: "#2dd4bf" }}>╌╌ Steady State RMS</span>
        )}
        <span style={{ fontSize: 12, color: "#fbbf24" }}>╎ Stable point</span>
      </div>

      {/* Stable marker info */}
      <div style={{ background: "#1e293b", borderRadius: 8, padding: "10px 16px", marginBottom: 16, borderLeft: "3px solid #fbbf24" }}>
        <span style={{ color: "#fbbf24", fontWeight: "bold", fontSize: 13 }}>
          ⏱ Stable at {result.stableTime} ms
        </span>
        <span style={{ color: "#64748b", fontSize: 12, marginLeft: 12 }}>
          Inrush: {result.I_start} A → Steady RMS: {result.I_rms} A
        </span>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={result.data} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e3a52" />
          <XAxis dataKey="t"
            label={{ value: "Time (ms)", position: "insideBottom", offset: -10, fill: "#94a3b8" }}
            tick={{ fill: "#94a3b8", fontSize: 11 }} />
          <YAxis
            label={{ value: "Current (A)", angle: -90, position: "insideLeft", fill: "#94a3b8" }}
            tick={{ fill: "#94a3b8", fontSize: 11 }} />
          <Tooltip
            contentStyle={{ background: "#1e293b", border: "1px solid #334155", color: "#e2e8f0" }}
            formatter={(v, name) => [parseFloat(v).toFixed(3) + " A", name]}
            labelFormatter={l => "t = " + l + " ms"} />
          <Legend wrapperStyle={{ color: "#94a3b8" }} />

          <ReferenceLine x={result.stableTime} stroke="#fbbf24" strokeDasharray="6 3"
            label={{ value: "Stable", fill: "#fbbf24", fontSize: 11, position: "top" }} />

          {viewMode !== "rms" && <>
            <Line type="monotone" dataKey="IA" stroke="#38bdf8" dot={false} strokeWidth={1.5} name="Phase A" />
            <Line type="monotone" dataKey="IB" stroke="#f472b6" dot={false} strokeWidth={1.5} name="Phase B" />
            <Line type="monotone" dataKey="IC" stroke="#4ade80" dot={false} strokeWidth={1.5} name="Phase C" />
          </>}

          {viewMode !== "ac" && (
            <Line type="monotone" dataKey="I_rms_live" stroke="#ff9800" dot={false}
              strokeWidth={3} name="RMS (live)" />
          )}

          {showSteady && (
            <Line type="monotone" dataKey="I_steady" stroke="#2dd4bf" dot={false}
              strokeWidth={1.5} strokeDasharray="8 4" name="Steady RMS" />
          )}
        </LineChart>
      </ResponsiveContainer>

      {/* Stats */}
      <div style={{ display: "flex", gap: 14, marginTop: 20, flexWrap: "wrap" }}>
        {[
          ["Load",           loadPercent + "%",                                preset.color],
          ["Inrush Current", result.I_start + " A",                           "#ef4444"],
          ["Steady RMS",     result.I_rms + " A",                             "#38bdf8"],
          ["Stable Time",    result.stableTime + " ms",                       "#fbbf24"],
          ["Speed",          result.rpm + " rpm",                             "#a78bfa"],
          ["Slip",           result.slip + "%",                               "#fb923c"],
          ["τ mech",         result.tau_mech + " ms",                         "#64748b"],
          ["Power Out",      (MOTOR.power_w * loadPercent / 100).toFixed(0) + " W", "#4ade80"],
        ].map(([label, val, color]) => (
          <div key={label} style={{ background: "#1e293b", borderRadius: 8, padding: "10px 16px", minWidth: 120 }}>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 15, color: color, fontWeight: "bold" }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Compare chart */}
      {compareMode && (
        <div style={{ marginTop: 28 }}>
          <h3 style={{ color: "#94a3b8", marginBottom: 12 }}>📊 Time to Stable vs Load Level</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={compareData} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e3a52" />
              <XAxis dataKey="load" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }}
                label={{ value: "Time (ms)", angle: -90, position: "insideLeft", fill: "#94a3b8" }} />
              <Tooltip
                contentStyle={{ background: "#1e293b", border: "1px solid #334155", color: "#e2e8f0" }}
                formatter={(v) => [v + " ms", "Time to Stable"]} />
              <Bar dataKey="stableTime" radius={[6, 6, 0, 0]} fill="#fbbf24" name="Time to Stable" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
