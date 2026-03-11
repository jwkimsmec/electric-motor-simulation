import { useState, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis
} from "recharts";
import { MOTOR } from "../motorParams.js";

function generateTorqueCurrentData() {
  // Generate torque-current curve from 0 to 200% load
  const curve = [];
  for (let load = 0; load <= 200; load += 2) {
    const loadFactor  = load / 100;
    const I_noload    = MOTOR.current_low * 0.35;
    const I_rated     = MOTOR.current_low;
    // Current increases nonlinearly with torque
    const I_rms       = I_noload + (I_rated - I_noload) * Math.pow(loadFactor, 0.85);
    const torque      = MOTOR.torque_nm * loadFactor;
    const slip        = 0.005 + MOTOR.slip * loadFactor;
    const rpm         = MOTOR.rpm_sync * (1 - slip);
    const power       = (torque * rpm * 2 * Math.PI / 60);
    const efficiency  = load > 5 ? Math.min(0.92, 0.75 + 0.17 * Math.pow(loadFactor, 0.4) - 0.05 * loadFactor * loadFactor) : 0;
    const pf          = load > 5 ? Math.min(0.95, 0.5 + 0.45 * Math.pow(loadFactor, 0.5)) : 0.2;

    curve.push({
      load:       parseFloat(load.toFixed(1)),
      torque:     parseFloat(torque.toFixed(3)),
      current:    parseFloat(I_rms.toFixed(3)),
      rpm:        parseFloat(rpm.toFixed(1)),
      slip_pct:   parseFloat((slip * 100).toFixed(2)),
      power_w:    parseFloat(power.toFixed(1)),
      efficiency: parseFloat((efficiency * 100).toFixed(1)),
      pf:         parseFloat(pf.toFixed(3)),
    });
  }
  return curve;
}

function generateTimeData(loadPercent) {
  // Time-domain torque and current from startup to stable
  const data       = [];
  const omega      = 2 * Math.PI * MOTOR.frequency;
  const loadFactor = loadPercent / 100;

  const I_noload   = MOTOR.current_low * 0.35;
  const I_steady   = I_noload + (MOTOR.current_low - I_noload) * Math.pow(loadFactor, 0.85);
  const I_startup  = MOTOR.current_low * 6.0;
  const T_steady   = MOTOR.torque_nm * loadFactor;
  const T_startup  = MOTOR.torque_nm * 1.5; // starting torque ~150%

  const tau_mech   = 0.05 + loadFactor * 0.15;
  const tau_elec   = 0.008;
  const slip_steady = 0.005 + MOTOR.slip * loadFactor;
  const rpm_steady  = MOTOR.rpm_sync * (1 - slip_steady);

  const duration   = tau_mech * 5;
  const steps      = Math.floor(duration * MOTOR.sample_rate);
  const downsample = Math.max(1, Math.floor(steps / 800));

  const rmsWindow  = Math.floor(MOTOR.sample_rate / MOTOR.frequency);
  const iA_buffer  = [];

  for (let i = 0; i <= steps; i++) {
    const t         = i / MOTOR.sample_rate;
    const inrush    = (I_startup - I_steady) * Math.exp(-t / tau_elec);
    const transient = I_steady * (1 - Math.exp(-t / tau_mech));
    const I_env     = inrush + transient;

    // Torque transient: starts at T_startup, oscillates, settles
    const T_env = T_startup * Math.exp(-t / tau_elec)
                + T_steady  * (1 - Math.exp(-t / tau_mech))
                + T_steady  * 0.15 * Math.exp(-t / (tau_mech * 0.3)) * Math.cos(2 * Math.PI * 8 * t);

    const slip_inst = Math.exp(-t / tau_mech) + slip_steady * (1 - Math.exp(-t / tau_mech));
    const phase_acc = 2 * Math.PI * MOTOR.frequency * t * (1 - slip_inst * 0.3);
    const ia        = I_env * Math.sin(phase_acc);

    iA_buffer.push(ia);
    if (iA_buffer.length > rmsWindow) iA_buffer.shift();
    const rms = Math.sqrt(iA_buffer.reduce((s, v) => s + v * v, 0) / iA_buffer.length);

    if (i % downsample === 0) {
      data.push({
        t:       parseFloat((t * 1000).toFixed(2)),
        torque:  parseFloat(Math.max(0, T_env).toFixed(4)),
        current: parseFloat(rms.toFixed(4)),
        rpm:     parseFloat((rpm_steady * (1 - Math.exp(-t / tau_mech))).toFixed(1)),
      });
    }
  }
  return data;
}

const LOAD_PRESETS = [
  { label: "No Load",   value: 0,   color: "#4ade80" },
  { label: "25% Load",  value: 25,  color: "#a3e635" },
  { label: "50% Load",  value: 50,  color: "#facc15" },
  { label: "75% Load",  value: 75,  color: "#fb923c" },
  { label: "Full Load", value: 100, color: "#ef4444" },
];

const TABS = [
  { id: "curve",  label: "📈 Torque-Current Curve" },
  { id: "time",   label: "⏱ Time Domain" },
  { id: "perf",   label: "⚡ Performance" },
];

export default function TorqueCurrentTest() {
  const [activeTab,   setActiveTab]   = useState("curve");
  const [loadPercent, setLoadPercent] = useState(100);
  const [curveData,   setCurveData]   = useState([]);
  const [timeData,    setTimeData]    = useState([]);

  useEffect(() => {
    setCurveData(generateTorqueCurrentData());
  }, []);

  useEffect(() => {
    setTimeData(generateTimeData(loadPercent));
  }, [loadPercent]);

  const preset    = LOAD_PRESETS.find(p => p.value === loadPercent) || LOAD_PRESETS[4];
  const operating = curveData.find(d => d.load === loadPercent) || {};

  return (
    <div>
      <h2 style={{ color: "#38bdf8", marginBottom: 4 }}>🔄 Torque — Current Test</h2>
      <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 20 }}>
        Torque-current relationship from 0% to 200% load | IEEE DataPort motor model
      </p>

      {/* Sub tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{
              padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer",
              background: activeTab === t.id ? "#0ea5e9" : "#1e293b",
              color: activeTab === t.id ? "#fff" : "#94a3b8",
              fontWeight: activeTab === t.id ? "bold" : "normal", fontSize: 13
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB 1: Torque-Current Curve ── */}
      {activeTab === "curve" && (
        <div>
          <p style={{ color: "#64748b", fontSize: 12, marginBottom: 12 }}>
            Shows how stator RMS current rises with shaft torque demand (0–200% rated load)
          </p>
          <ResponsiveContainer width="100%" height={380}>
            <LineChart data={curveData} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e3a52" />
              <XAxis dataKey="torque"
                label={{ value: "Torque (Nm)", position: "insideBottom", offset: -10, fill: "#94a3b8" }}
                tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis
                label={{ value: "RMS Current (A)", angle: -90, position: "insideLeft", fill: "#94a3b8" }}
                tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "#1e293b", border: "1px solid #334155", color: "#e2e8f0" }}
                formatter={(v, name) => [
                  name === "current" ? v + " A" :
                  name === "rpm"     ? v + " rpm" : v,
                  name === "current" ? "RMS Current" :
                  name === "rpm"     ? "Speed" : name
                ]}
                labelFormatter={l => "Torque: " + l + " Nm"} />
              <Legend wrapperStyle={{ color: "#94a3b8" }} />
              <Line type="monotone" dataKey="current" stroke="#38bdf8" dot={false} strokeWidth={3} name="RMS Current (A)" />
              <Line type="monotone" dataKey="rpm"     stroke="#a78bfa" dot={false} strokeWidth={2}
                yAxisId={0} name="Speed (rpm)"
                strokeDasharray="5 3" />
            </LineChart>
          </ResponsiveContainer>

          {/* Rated point markers */}
          <div style={{ display: "flex", gap: 14, marginTop: 16, flexWrap: "wrap" }}>
            {[
              ["Rated Torque",   MOTOR.torque_nm + " Nm",             "#38bdf8"],
              ["Rated Current",  MOTOR.current_low + " A",            "#4ade80"],
              ["No-load Current",(MOTOR.current_low * 0.35).toFixed(2) + " A", "#facc15"],
              ["Max Torque",     (MOTOR.torque_nm * 2).toFixed(2) + " Nm",    "#ef4444"],
              ["Rated Speed",    MOTOR.rpm_rated + " rpm",            "#a78bfa"],
            ].map(([label, val, color]) => (
              <div key={label} style={{ background: "#1e293b", borderRadius: 8, padding: "10px 16px", minWidth: 130 }}>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 15, color, fontWeight: "bold" }}>{val}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 2: Time Domain ── */}
      {activeTab === "time" && (
        <div>
          {/* Load selector */}
          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            {LOAD_PRESETS.map(p => (
              <button key={p.value} onClick={() => setLoadPercent(p.value)}
                style={{
                  padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer",
                  background: loadPercent === p.value ? p.color : "#1e293b",
                  color: loadPercent === p.value ? "#000" : "#94a3b8",
                  fontWeight: loadPercent === p.value ? "bold" : "normal", fontSize: 13
                }}>
                {p.label}
              </button>
            ))}
          </div>

          <p style={{ color: "#64748b", fontSize: 12, marginBottom: 12 }}>
            Torque (Nm) and RMS Current (A) from startup to steady state — dual Y-axis
          </p>

          <ResponsiveContainer width="100%" height={380}>
            <LineChart data={timeData} margin={{ top: 10, right: 50, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e3a52" />
              <XAxis dataKey="t"
                label={{ value: "Time (ms)", position: "insideBottom", offset: -10, fill: "#94a3b8" }}
                tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis yAxisId="current"
                label={{ value: "Current (A)", angle: -90, position: "insideLeft", fill: "#38bdf8" }}
                tick={{ fill: "#38bdf8", fontSize: 11 }} />
              <YAxis yAxisId="torque" orientation="right"
                label={{ value: "Torque (Nm)", angle: 90, position: "insideRight", fill: "#fb923c" }}
                tick={{ fill: "#fb923c", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "#1e293b", border: "1px solid #334155", color: "#e2e8f0" }}
                formatter={(v, name) => [
                  name === "current" ? v + " A" :
                  name === "torque"  ? v + " Nm" : v + " rpm", name
                ]}
                labelFormatter={l => "t = " + l + " ms"} />
              <Legend wrapperStyle={{ color: "#94a3b8" }} />
              <Line yAxisId="current" type="monotone" dataKey="current"
                stroke="#38bdf8" dot={false} strokeWidth={2.5} name="RMS Current" />
              <Line yAxisId="torque"  type="monotone" dataKey="torque"
                stroke="#fb923c" dot={false} strokeWidth={2.5} name="Torque" />
              <Line yAxisId="torque"  type="monotone" dataKey="rpm"
                stroke="#a78bfa" dot={false} strokeWidth={1.5} strokeDasharray="5 3" name="Speed (rpm)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── TAB 3: Performance ── */}
      {activeTab === "perf" && (
        <div>
          <p style={{ color: "#64748b", fontSize: 12, marginBottom: 12 }}>
            Efficiency and power factor vs load — key motor performance indicators
          </p>
          <ResponsiveContainer width="100%" height={380}>
            <LineChart data={curveData} margin={{ top: 10, right: 50, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e3a52" />
              <XAxis dataKey="load"
                label={{ value: "Load (%)", position: "insideBottom", offset: -10, fill: "#94a3b8" }}
                tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis yAxisId="eff"
                label={{ value: "Efficiency (%)", angle: -90, position: "insideLeft", fill: "#4ade80" }}
                tick={{ fill: "#4ade80", fontSize: 11 }} domain={[0, 100]} />
              <YAxis yAxisId="pf" orientation="right"
                label={{ value: "Power Factor", angle: 90, position: "insideRight", fill: "#facc15" }}
                tick={{ fill: "#facc15", fontSize: 11 }} domain={[0, 1]} />
              <Tooltip
                contentStyle={{ background: "#1e293b", border: "1px solid #334155", color: "#e2e8f0" }}
                formatter={(v, name) => [
                  name === "efficiency" ? v + " %" : v,
                  name === "efficiency" ? "Efficiency" : "Power Factor"
                ]}
                labelFormatter={l => "Load: " + l + "%"} />
              <Legend wrapperStyle={{ color: "#94a3b8" }} />
              <Line yAxisId="eff" type="monotone" dataKey="efficiency"
                stroke="#4ade80" dot={false} strokeWidth={2.5} name="efficiency" />
              <Line yAxisId="pf"  type="monotone" dataKey="pf"
                stroke="#facc15" dot={false} strokeWidth={2.5} name="pf" />
            </LineChart>
          </ResponsiveContainer>

          {/* Performance at rated load */}
          <div style={{ display: "flex", gap: 14, marginTop: 16, flexWrap: "wrap" }}>
            {[
              ["Rated Efficiency", "87%",  "#4ade80"],
              ["Peak Efficiency",  "92%",  "#22c55e"],
              ["Rated PF",         "0.85", "#facc15"],
              ["No-load PF",       "0.20", "#ef4444"],
              ["Best Eff. Point",  "75%",  "#38bdf8"],
            ].map(([label, val, color]) => (
              <div key={label} style={{ background: "#1e293b", borderRadius: 8, padding: "10px 16px", minWidth: 130 }}>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 15, color, fontWeight: "bold" }}>{val}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
