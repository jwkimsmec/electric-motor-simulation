import { useState, useEffect } from "react";
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine, Area
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
                    + T_steady  * 0.15
                      * Math.exp(-t / (tau_mech * 0.3))
                      * Math.cos(2 * Math.PI * 8 * t);

    const slip_inst = Math.exp(-t / tau_mech)
                    + slip_steady * (1 - Math.exp(-t / tau_mech));
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
        // normalized versions (0-100%) for overlay chart
        current_pct: parseFloat((rms / I_startup * 100).toFixed(2)),
        torque_pct:  parseFloat((Math.max(0, T_env) / T_startup * 100).toFixed(2)),
        rpm_pct:     parseFloat((rpm / rpm_steady * 100).toFixed(2)),
      });
    }
  }

  return {
    data,
    I_steady:   parseFloat(I_steady.toFixed(3)),
    T_steady:   parseFloat(T_steady.toFixed(3)),
    rpm_steady: parseFloat(rpm_steady.toFixed(1)),
    stableTime: parseFloat((tau_mech * 4 * 1000).toFixed(0)),
    I_startup:  parseFloat(I_startup.toFixed(3)),
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
  <div style={{ background: "#0f172a", borderRadius: 8, padding: "10px 16px", minWidth: 120 }}>
    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>{label}</div>
    <div style={{ fontSize: 15, color, fontWeight: "bold" }}>
      {val} <span style={{ fontSize: 11, color: "#475569" }}>{unit}</span>
    </div>
  </div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, padding: "10px 14px" }}>
      <p style={{ color: "#94a3b8", margin: "0 0 6px", fontSize: 12 }}>t = {label} ms</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, margin: "2px 0", fontSize: 13 }}>
          {p.name}: <strong>{p.value} {p.name === "Speed" ? "rpm" : p.name === "Torque" ? "Nm" : "A"}</strong>
        </p>
      ))}
    </div>
  );
};

export default function TorqueCurrentTest() {
  const [loadPercent, setLoadPercent] = useState(100);
  const [result,      setResult]      = useState({ data: [], I_steady: 0, T_steady: 0, rpm_steady: 0, stableTime: 0, I_startup: 0 });
  const [curveData,   setCurveData]   = useState([]);
  const [viewMode,    setViewMode]    = useState("normalized"); // normalized | actual | xt_curve

  useEffect(() => { setResult(generateTimeData(loadPercent)); },   [loadPercent]);
  useEffect(() => { setCurveData(generateTorqueCurrentCurve()); }, []);

  const preset = LOAD_PRESETS.find(p => p.value === loadPercent) || LOAD_PRESETS[4];

  return (
    <div>
      <h2 style={{ color: "#38bdf8", marginBottom: 4 }}>🔄 Torque — Current — Speed Test</h2>
      <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 16 }}>
        See how current, torque and speed change together from startup to stable
      </p>

      {/* Load presets */}
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
      <div style={{ background: "#1e293b", borderRadius: 10, padding: "14px 20px", marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ color: "#94a3b8", fontSize: 13 }}>
            Load: <strong style={{ color: preset.color }}>{loadPercent}%</strong>
          </span>
          <span style={{ color: "#94a3b8", fontSize: 13 }}>
            Stable at: <strong style={{ color: "#fbbf24" }}>{result.stableTime} ms</strong>
          </span>
        </div>
        <input type="range" min="0" max="100" value={loadPercent}
          onChange={e => setLoadPercent(Number(e.target.value))}
          style={{ width: "100%", accentColor: preset.color }} />
      </div>

      {/* View mode tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[
          { id: "normalized", label: "📊 All 3 Overlaid (normalized %)" },
          { id: "actual",     label: "🔢 Actual Values (3 graphs)" },
          { id: "xt_curve",   label: "🔵 Torque vs Current Curve" },
        ].map(v => (
          <button key={v.id} onClick={() => setViewMode(v.id)}
            style={{
              padding: "7px 14px", borderRadius: 6, border: "none", cursor: "pointer",
              background: viewMode === v.id ? "#0ea5e9" : "#1e293b",
              color: viewMode === v.id ? "#fff" : "#94a3b8", fontSize: 13
            }}>
            {v.label}
          </button>
        ))}
      </div>

      {/* ══ VIEW 1: Normalized overlay — all 3 on one graph ══ */}
      {viewMode === "normalized" && (
        <div style={{ background: "#1e293b", borderRadius: 10, padding: 16, marginBottom: 20 }}>
          <h3 style={{ color: "#e2e8f0", margin: "0 0 4px" }}>All Factors — Normalized (% of peak)</h3>
          <p style={{ color: "#64748b", fontSize: 12, margin: "0 0 4px" }}>
            Current 🔵, Torque 🟠, Speed 🟣 — all scaled 0–100% so they fit one graph
          </p>
          <div style={{ display: "flex", gap: 16, marginBottom: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "#38bdf8" }}>━ Current (0% = 0A, 100% = {result.I_startup}A)</span>
            <span style={{ fontSize: 12, color: "#fb923c" }}>━ Torque (100% = {result.T_steady > 0 ? (MOTOR.torque_nm * 1.5).toFixed(2) : "—"} Nm)</span>
            <span style={{ fontSize: 12, color: "#a78bfa" }}>━ Speed (100% = {result.rpm_steady} rpm)</span>
            <span style={{ fontSize: 12, color: "#fbbf24" }}>╎ Stable point</span>
          </div>
          <ResponsiveContainer width="100%" height={360}>
            <ComposedChart data={result.data} margin={{ top: 5, right: 30, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#0f172a" />
              <XAxis dataKey="t"
                label={{ value: "Time (ms)", position: "insideBottom", offset: -10, fill: "#94a3b8" }}
                tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis
                label={{ value: "% of Peak", angle: -90, position: "insideLeft", fill: "#94a3b8" }}
                tick={{ fill: "#94a3b8", fontSize: 11 }} domain={[0, 110]} />
              <Tooltip content={<CustomTooltipPct />} />
              <Legend wrapperStyle={{ color: "#94a3b8" }} />
              <ReferenceLine x={result.stableTime} stroke="#fbbf24" strokeDasharray="5 3"
                label={{ value: "Stable", fill: "#fbbf24", fontSize: 10, position: "top" }} />
              <Area type="monotone" dataKey="current_pct" stroke="#38bdf8" fill="#38bdf820"
                strokeWidth={2.5} dot={false} name="Current %" />
              <Line type="monotone" dataKey="torque_pct"  stroke="#fb923c" strokeWidth={2.5}
                dot={false} name="Torque %" />
              <Line type="monotone" dataKey="rpm_pct"     stroke="#a78bfa" strokeWidth={2.5}
                dot={false} name="Speed %" strokeDasharray="6 2" />
            </ComposedChart>
          </ResponsiveContainer>

          {/* Behavior explanation */}
          <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            {[
              { color: "#38bdf8", text: "Current spikes at inrush then drops to steady state" },
              { color: "#fb923c", text: "Torque peaks at start then settles with load" },
              { color: "#a78bfa", text: "Speed ramps up from 0 to rated rpm" },
            ].map((item, i) => (
              <div key={i} style={{ background: "#0f172a", borderRadius: 8, padding: "8px 14px", flex: 1, minWidth: 180 }}>
                <span style={{ color: item.color, fontWeight: "bold", fontSize: 13 }}>● </span>
                <span style={{ color: "#94a3b8", fontSize: 12 }}>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══ VIEW 2: Actual values — 3 stacked graphs ══ */}
      {viewMode === "actual" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Graph 1: Current vs Time */}
          <div style={{ background: "#1e293b", borderRadius: 10, padding: 16 }}>
            <h3 style={{ color: "#38bdf8", margin: "0 0 2px" }}>① Current vs Time</h3>
            <p style={{ color: "#64748b", fontSize: 12, margin: "0 0 8px" }}>
              Inrush {result.I_startup}A → Steady {result.I_steady}A
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={result.data} margin={{ top: 5, right: 30, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#0f172a" />
                <XAxis dataKey="t" tick={{ fill: "#94a3b8", fontSize: 11 }}
                  label={{ value: "Time (ms)", position: "insideBottom", offset: -10, fill: "#94a3b8" }} />
                <YAxis tick={{ fill: "#38bdf8", fontSize: 11 }}
                  label={{ value: "Current (A)", angle: -90, position: "insideLeft", fill: "#38bdf8" }} />
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", color: "#e2e8f0" }}
                  formatter={v => [v + " A", "RMS Current"]}
                  labelFormatter={l => "t = " + l + " ms"} />
                <ReferenceLine x={result.stableTime} stroke="#fbbf24" strokeDasharray="5 3"
                  label={{ value: "Stable", fill: "#fbbf24", fontSize: 10 }} />
                <ReferenceLine y={result.I_steady} stroke="#38bdf8" strokeDasharray="4 2"
                  label={{ value: result.I_steady + "A", fill: "#38bdf8", fontSize: 10, position: "right" }} />
                <Area type="monotone" dataKey="current" stroke="#38bdf8" fill="#38bdf820" strokeWidth={2.5} dot={false} name="Current" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Graph 2: Torque vs Time */}
          <div style={{ background: "#1e293b", borderRadius: 10, padding: 16 }}>
            <h3 style={{ color: "#fb923c", margin: "0 0 2px" }}>② Torque vs Time</h3>
            <p style={{ color: "#64748b", fontSize: 12, margin: "0 0 8px" }}>
              Starting torque {(MOTOR.torque_nm * 1.5).toFixed(2)}Nm → Steady {result.T_steady}Nm
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={result.data} margin={{ top: 5, right: 30, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#0f172a" />
                <XAxis dataKey="t" tick={{ fill: "#94a3b8", fontSize: 11 }}
                  label={{ value: "Time (ms)", position: "insideBottom", offset: -10, fill: "#94a3b8" }} />
                <YAxis tick={{ fill: "#fb923c", fontSize: 11 }}
                  label={{ value: "Torque (Nm)", angle: -90, position: "insideLeft", fill: "#fb923c" }} />
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", color: "#e2e8f0" }}
                  formatter={v => [v + " Nm", "Torque"]}
                  labelFormatter={l => "t = " + l + " ms"} />
                <ReferenceLine x={result.stableTime} stroke="#fbbf24" strokeDasharray="5 3"
                  label={{ value: "Stable", fill: "#fbbf24", fontSize: 10 }} />
                <ReferenceLine y={result.T_steady} stroke="#fb923c" strokeDasharray="4 2"
                  label={{ value: result.T_steady + "Nm", fill: "#fb923c", fontSize: 10, position: "right" }} />
                <Area type="monotone" dataKey="torque" stroke="#fb923c" fill="#fb923c20" strokeWidth={2.5} dot={false} name="Torque" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Graph 3: Speed vs Time */}
          <div style={{ background: "#1e293b", borderRadius: 10, padding: 16 }}>
            <h3 style={{ color: "#a78bfa", margin: "0 0 2px" }}>③ Speed vs Time</h3>
            <p style={{ color: "#64748b", fontSize: 12, margin: "0 0 8px" }}>
              0 rpm → {result.rpm_steady} rpm (rated)
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={result.data} margin={{ top: 5, right: 30, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#0f172a" />
                <XAxis dataKey="t" tick={{ fill: "#94a3b8", fontSize: 11 }}
                  label={{ value: "Time (ms)", position: "insideBottom", offset: -10, fill: "#94a3b8" }} />
                <YAxis tick={{ fill: "#a78bfa", fontSize: 11 }}
                  label={{ value: "Speed (rpm)", angle: -90, position: "insideLeft", fill: "#a78bfa" }} />
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", color: "#e2e8f0" }}
                  formatter={v => [v + " rpm", "Speed"]}
                  labelFormatter={l => "t = " + l + " ms"} />
                <ReferenceLine x={result.stableTime} stroke="#fbbf24" strokeDasharray="5 3"
                  label={{ value: "Stable", fill: "#fbbf24", fontSize: 10 }} />
                <ReferenceLine y={result.rpm_steady} stroke="#a78bfa" strokeDasharray="4 2"
                  label={{ value: result.rpm_steady + " rpm", fill: "#a78bfa", fontSize: 10, position: "right" }} />
                <Area type="monotone" dataKey="rpm" stroke="#a78bfa" fill="#a78bfa20" strokeWidth={2.5} dot={false} name="Speed" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ══ VIEW 3: Torque vs Current X-Y curve ══ */}
      {viewMode === "xt_curve" && (
        <div style={{ background: "#1e293b", borderRadius: 10, padding: 16 }}>
          <h3 style={{ color: "#4ade80", margin: "0 0 4px" }}>Torque vs Current — Operating Curve</h3>
          <p style={{ color: "#64748b", fontSize: 12, margin: "0 0 12px" }}>
            X = RMS Current (A) | Y = Shaft Torque (Nm) | 0% to 200% rated load
          </p>
          <ResponsiveContainer width="100%" height={340}>
            <ComposedChart data={curveData} margin={{ top: 5, right: 30, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#0f172a" />
              <XAxis dataKey="current" type="number"
                label={{ value: "RMS Current (A)", position: "insideBottom", offset: -10, fill: "#94a3b8" }}
                tick={{ fill: "#94a3b8", fontSize: 11 }} domain={["auto", "auto"]} />
              <YAxis dataKey="torque"
                label={{ value: "Torque (Nm)", angle: -90, position: "insideLeft", fill: "#4ade80" }}
                tick={{ fill: "#4ade80", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "#0f172a", border: "1px solid #334155", color: "#e2e8f0" }}
                formatter={(v, name) => [name === "torque" ? v + " Nm" : v + " A", name === "torque" ? "Torque" : "Current"]}
                labelFormatter={l => "Current: " + l + " A"} />
              <ReferenceLine x={result.I_steady} stroke="#38bdf8" strokeDasharray="4 2"
                label={{ value: "Operating I", fill: "#38bdf8", fontSize: 10 }} />
              <ReferenceLine y={result.T_steady} stroke="#fb923c" strokeDasharray="4 2"
                label={{ value: result.T_steady + " Nm", fill: "#fb923c", fontSize: 10 }} />
              <Area type="monotone" dataKey="torque" stroke="#4ade80" fill="#4ade8020"
                strokeWidth={2.5} dot={false} name="torque" />
            </ComposedChart>
          </ResponsiveContainer>
          <div style={{ marginTop: 12, background: "#0f172a", borderRadius: 8, padding: "10px 14px" }}>
            <span style={{ color: "#38bdf8", fontSize: 13 }}>⬆ Blue line</span>
            <span style={{ color: "#64748b", fontSize: 12, marginLeft: 8 }}>= current operating point at {loadPercent}% load</span>
            <span style={{ color: "#fb923c", fontSize: 13, marginLeft: 16 }}>➡ Orange line</span>
            <span style={{ color: "#64748b", fontSize: 12, marginLeft: 8 }}>= torque at {loadPercent}% load = {result.T_steady} Nm</span>
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
        <CARD label="Inrush Current" val={result.I_startup}  color="#ef4444" unit="A"   />
        <CARD label="Steady Current" val={result.I_steady}   color="#38bdf8" unit="A"   />
        <CARD label="Steady Torque"  val={result.T_steady}   color="#fb923c" unit="Nm"  />
        <CARD label="Steady Speed"   val={result.rpm_steady} color="#a78bfa" unit="rpm" />
        <CARD label="Stable Time"    val={result.stableTime} color="#fbbf24" unit="ms"  />
        <CARD label="Load"           val={loadPercent + "%"} color={preset.color} unit="" />
      </div>
    </div>
  );
}

const CustomTooltipPct = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, padding: "10px 14px" }}>
      <p style={{ color: "#94a3b8", margin: "0 0 6px", fontSize: 12 }}>t = {label} ms</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, margin: "2px 0", fontSize: 13 }}>
          {p.name}: <strong>{p.value}%</strong>
        </p>
      ))}
    </div>
  );
};
