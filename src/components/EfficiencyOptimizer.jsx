import { useState, useEffect, useCallback } from "react";
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine, Area
} from "recharts";
import { MOTOR } from "../motorParams.js";

const IE_CLASSES = [
  { id: "IE1", label: "IE1 Standard",      color: "#ef4444", R_stator: 4.20, P_core: 28, slip_factor: 1.00, airgap: 0.50, friction: 12 },
  { id: "IE2", label: "IE2 High",          color: "#fb923c", R_stator: 3.20, P_core: 22, slip_factor: 0.75, airgap: 0.45, friction: 10 },
  { id: "IE3", label: "IE3 Premium",       color: "#facc15", R_stator: 2.50, P_core: 18, slip_factor: 0.55, airgap: 0.40, friction: 8  },
  { id: "IE4", label: "IE4 Super Premium", color: "#4ade80", R_stator: 1.80, P_core: 14, slip_factor: 0.40, airgap: 0.35, friction: 6  },
  { id: "IE5", label: "IE5 Ultra Premium", color: "#38bdf8", R_stator: 1.20, P_core: 10, slip_factor: 0.28, airgap: 0.30, friction: 5  },
];

function airgapFactor(airgap_mm) {
  return 1.0 + (airgap_mm - 0.30) * 0.18;
}

function generateData(params) {
  const { R_stator, P_core, slip_factor, airgap_mm, friction } = params;
  const ag_factor = airgapFactor(airgap_mm);
  const data = [];
  for (let load = 0; load <= 150; load += 2) {
    const lf            = load / 100;
    const I_noload      = MOTOR.current_low * 0.35 * ag_factor;
    const I_rms         = I_noload + (MOTOR.current_low - I_noload) * Math.pow(lf, 0.85);
    const slip          = (0.005 + MOTOR.slip * lf) * slip_factor;
    const rpm           = MOTOR.rpm_sync * (1 - slip);
    const torque        = MOTOR.torque_nm * lf;
    const P_out         = torque * rpm * 2 * Math.PI / 60;
    const V             = MOTOR.voltage_low;
    const pf            = load < 5 ? 0.18 / ag_factor
                        : Math.min(0.92, (0.30 + 0.58 * Math.pow(lf, 0.45)) / Math.sqrt(ag_factor));
    const P_in          = Math.sqrt(3) * V * I_rms * pf;
    const P_core_actual = P_core * ag_factor;
    const P_copper      = 3 * Math.pow(I_rms, 2) * R_stator;
    const P_fric        = friction + 2 * lf;
    const P_stray       = P_in * 0.004;
    const P_loss        = P_copper + P_core_actual + P_fric + P_stray;
    const efficiency    = load > 3 ? Math.min(96, Math.max(0, (P_out / P_in) * 100)) : 0;
    data.push({
      load:       parseFloat(load.toFixed(1)),
      efficiency: parseFloat(efficiency.toFixed(2)),
      pf:         parseFloat(pf.toFixed(3)),
      current:    parseFloat(I_rms.toFixed(3)),
      P_in:       parseFloat(P_in.toFixed(1)),
      P_out:      parseFloat(P_out.toFixed(1)),
      P_copper:   parseFloat(P_copper.toFixed(1)),
      P_core:     parseFloat(P_core_actual.toFixed(1)),
      P_friction: parseFloat(P_fric.toFixed(1)),
      P_loss:     parseFloat(P_loss.toFixed(1)),
      rpm:        parseFloat(rpm.toFixed(1)),
      slip_pct:   parseFloat((slip * 100).toFixed(3)),
    });
  }
  return data;
}

const SLIDER = ({ label, value, min, max, step, unit, color, onChange, description, pending }) => (
  <div style={{
    background: pending ? "#1a1f2e" : "#0f172a",
    borderRadius: 10, padding: "12px 16px", marginBottom: 10,
    border: pending ? "1px solid #334155" : "1px solid transparent",
    transition: "all 0.2s"
  }}>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
      <span style={{ color: "#94a3b8", fontSize: 13 }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {pending && <span style={{ fontSize: 10, color: "#fbbf24", background: "#fbbf2420",
          padding: "1px 6px", borderRadius: 4 }}>pending</span>}
        <span style={{ color, fontWeight: "bold", fontSize: 14 }}>{value} {unit}</span>
      </div>
    </div>
    <input type="range" min={min} max={max} step={step} value={value}
      onChange={e => onChange(parseFloat(e.target.value))}
      style={{ width: "100%", accentColor: color }} />
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#475569", marginTop: 2 }}>
      <span>{min} {unit}</span>
      <span style={{ color: "#475569", fontSize: 11 }}>{description}</span>
      <span>{max} {unit}</span>
    </div>
  </div>
);

const CARD = ({ label, val, unit, color, delta }) => (
  <div style={{ background: "#0f172a", borderRadius: 10, padding: "10px 14px", flex: 1, minWidth: 110 }}>
    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>{label}</div>
    <div style={{ fontSize: 15, color, fontWeight: "bold" }}>
      {val}<span style={{ fontSize: 11, color: "#475569" }}> {unit}</span>
    </div>
    {delta !== undefined && (
      <div style={{ fontSize: 11, color: delta >= 0 ? "#4ade80" : "#ef4444", marginTop: 2 }}>
        {delta >= 0 ? "▲ +" : "▼ "}{Math.abs(delta).toFixed(2)} {unit}
      </div>
    )}
  </div>
);

export default function EfficiencyOptimizer() {
  const baseline = IE_CLASSES[0];

  // Committed (applied) params
  const [committed, setCommitted] = useState({
    R_stator: 4.20, P_core: 28, slip_factor: 1.00, airgap_mm: 0.50, friction: 12
  });

  // Draft (pending) params — what sliders show
  const [draft, setDraft] = useState({
    R_stator: 4.20, P_core: 28, slip_factor: 1.00, airgap_mm: 0.50, friction: 12
  });

  const [selectedIE,  setSelectedIE]  = useState("IE1");
  const [marker,      setMarker]      = useState(75);
  const [baseData,    setBaseData]    = useState([]);
  const [optData,     setOptData]     = useState([]);
  const [refreshAnim, setRefreshAnim] = useState(false);

  // Check if draft differs from committed
  const hasPending = JSON.stringify(draft) !== JSON.stringify(committed);

  useEffect(() => {
    setBaseData(generateData({ ...baseline, airgap_mm: 0.50 }));
    setOptData(generateData({ R_stator: 4.20, P_core: 28, slip_factor: 1.00, airgap_mm: 0.50, friction: 12 }));
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshAnim(true);
    setTimeout(() => setRefreshAnim(false), 600);
    setCommitted({ ...draft });
    setOptData(generateData(draft));
  }, [draft]);

  const handleReset = () => {
    const ie1 = { R_stator: 4.20, P_core: 28, slip_factor: 1.00, airgap_mm: 0.50, friction: 12 };
    setDraft(ie1);
    setCommitted(ie1);
    setOptData(generateData(ie1));
    setSelectedIE("IE1");
  };

  const applyIEClass = (ie) => {
    setSelectedIE(ie.id);
    const p = { R_stator: ie.R_stator, P_core: ie.P_core,
                slip_factor: ie.slip_factor, airgap_mm: ie.airgap, friction: ie.friction };
    setDraft(p);
  };

  const updateDraft = (key, val) => {
    setDraft(prev => ({ ...prev, [key]: val }));
    // Detect IE class match
    const match = IE_CLASSES.find(ie =>
      Math.abs(ie.R_stator - (key === "R_stator" ? val : draft.R_stator)) < 0.01 &&
      Math.abs(ie.P_core   - (key === "P_core"   ? val : draft.P_core))   < 0.5  &&
      Math.abs(ie.airgap   - (key === "airgap_mm"? val : draft.airgap_mm))< 0.01
    );
    setSelectedIE(match ? match.id : "custom");
  };

  const basePoint = baseData.find(d => d.load === marker) || {};
  const optPoint  = optData.find(d  => d.load === marker) || {};
  const bestBase  = baseData.reduce((b, d) => d.efficiency > (b.efficiency||0) ? d : b, {});
  const bestOpt   = optData.reduce((b, d)  => d.efficiency > (b.efficiency||0) ? d : b, {});

  const compData = baseData.map((b, i) => ({
    load:      b.load,
    baseline:  b.efficiency,
    optimized: optData[i] ? optData[i].efficiency : null,
    pf_base:   b.pf,
    pf_opt:    optData[i] ? optData[i].pf : null,
  }));

  return (
    <div>
      <h2 style={{ color: "#38bdf8", marginBottom: 4 }}>🔬 Efficiency Optimizer</h2>
      <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 16 }}>
        Adjust parameters → click <strong style={{ color: "#4ade80" }}>Apply Changes</strong> to update graphs
      </p>

      {/* IE Class quick select */}
      <div style={{ background: "#1e293b", borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
        <div style={{ color: "#64748b", fontSize: 12, marginBottom: 10 }}>
          Quick Select — IE Efficiency Class:
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {IE_CLASSES.map(ie => (
            <button key={ie.id} onClick={() => applyIEClass(ie)}
              style={{
                padding: "8px 16px", borderRadius: 8, border: "2px solid",
                borderColor: selectedIE === ie.id ? ie.color : "transparent",
                cursor: "pointer",
                background: selectedIE === ie.id ? ie.color + "22" : "#0f172a",
                color: selectedIE === ie.id ? ie.color : "#64748b",
                fontWeight: selectedIE === ie.id ? "bold" : "normal", fontSize: 13
              }}>
              {ie.label}
            </button>
          ))}
          {selectedIE === "custom" && (
            <span style={{ color: "#a78bfa", fontSize: 13, alignSelf: "center", padding: "0 8px" }}>
              ✏️ Custom
            </span>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>

        {/* ── LEFT: Sliders + Refresh ── */}
        <div style={{ flex: "0 0 320px", minWidth: 280 }}>
          <h3 style={{ color: "#e2e8f0", marginBottom: 12, fontSize: 15 }}>🔧 Design Parameters</h3>

          <SLIDER label="Stator Resistance (R)"
            value={draft.R_stator} min={0.8} max={5.0} step={0.1} unit="Ω" color="#ef4444"
            onChange={v => updateDraft("R_stator", v)}
            description="Lower = less copper loss"
            pending={draft.R_stator !== committed.R_stator} />

          <SLIDER label="Core Loss"
            value={draft.P_core} min={6} max={40} step={1} unit="W" color="#f97316"
            onChange={v => updateDraft("P_core", v)}
            description="Better steel = lower"
            pending={draft.P_core !== committed.P_core} />

          <SLIDER label="Air Gap Length"
            value={draft.airgap_mm} min={0.2} max={1.2} step={0.05} unit="mm" color="#38bdf8"
            onChange={v => updateDraft("airgap_mm", v)}
            description="Smaller = better PF"
            pending={draft.airgap_mm !== committed.airgap_mm} />

          <SLIDER label="Slip Factor"
            value={draft.slip_factor} min={0.2} max={1.5} step={0.05} unit="×" color="#a78bfa"
            onChange={v => updateDraft("slip_factor", v)}
            description="Lower = better rotor"
            pending={draft.slip_factor !== committed.slip_factor} />

          <SLIDER label="Friction & Windage"
            value={draft.friction} min={3} max={20} step={0.5} unit="W" color="#facc15"
            onChange={v => updateDraft("friction", v)}
            description="Better bearings = lower"
            pending={draft.friction !== committed.friction} />

          {/* ── REFRESH BUTTON GROUP ── */}
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>

            {/* Apply button */}
            <button onClick={handleRefresh}
              style={{
                width: "100%", padding: "14px", borderRadius: 10, border: "none",
                cursor: hasPending ? "pointer" : "not-allowed",
                background: hasPending ? "#16a34a" : "#1e293b",
                color: hasPending ? "#fff" : "#475569",
                fontWeight: "bold", fontSize: 15,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                transition: "all 0.2s",
                transform: refreshAnim ? "scale(0.97)" : "scale(1)",
                boxShadow: hasPending ? "0 0 16px #16a34a55" : "none"
              }}>
              <span style={{
                display: "inline-block",
                animation: refreshAnim ? "spin 0.5s linear" : "none",
                fontSize: 18
              }}>🔄</span>
              {hasPending ? "Apply Changes" : "Up to Date ✓"}
            </button>

            {/* Pending changes indicator */}
            {hasPending && (
              <div style={{ background: "#fbbf2415", border: "1px solid #fbbf2440",
                borderRadius: 8, padding: "8px 12px" }}>
                <div style={{ color: "#fbbf24", fontSize: 12, marginBottom: 4 }}>
                  ⚠️ Pending changes:
                </div>
                {[
                  ["R stator",  draft.R_stator,    committed.R_stator,    "Ω"],
                  ["Core Loss", draft.P_core,       committed.P_core,      "W"],
                  ["Air Gap",   draft.airgap_mm,    committed.airgap_mm,   "mm"],
                  ["Slip ×",    draft.slip_factor,  committed.slip_factor, "×"],
                  ["Friction",  draft.friction,     committed.friction,    "W"],
                ].filter(([, dv, cv]) => dv !== cv).map(([label, dv, cv, unit]) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between",
                    fontSize: 11, color: "#94a3b8", marginBottom: 2 }}>
                    <span>{label}</span>
                    <span>
                      <span style={{ color: "#ef4444" }}>{cv} {unit}</span>
                      <span style={{ color: "#64748b" }}> → </span>
                      <span style={{ color: "#4ade80" }}>{dv} {unit}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Reset button */}
            <button onClick={handleReset}
              style={{
                width: "100%", padding: "10px", borderRadius: 10, border: "1px solid #334155",
                cursor: "pointer", background: "#0f172a",
                color: "#64748b", fontWeight: "normal", fontSize: 13,
              }}>
              ↩ Reset to IE1 Baseline
            </button>
          </div>

          {/* Parameter summary */}
          <div style={{ background: "#0f172a", borderRadius: 10, padding: "12px 16px", marginTop: 12 }}>
            <div style={{ color: "#64748b", fontSize: 12, marginBottom: 8 }}>Applied Parameters</div>
            {[
              ["R stator",  committed.R_stator + " Ω",    baseline.R_stator + " Ω", "#ef4444"],
              ["Core Loss", committed.P_core + " W",      baseline.P_core + " W",   "#f97316"],
              ["Air Gap",   committed.airgap_mm + " mm",  "0.50 mm",                "#38bdf8"],
              ["Slip ×",    committed.slip_factor + "×",  "1.00×",                  "#a78bfa"],
              ["Friction",  committed.friction + " W",    baseline.friction + " W", "#facc15"],
            ].map(([label, val, base, color]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ color: "#64748b", fontSize: 12 }}>{label}</span>
                <span style={{ color, fontSize: 12, fontWeight: "bold" }}>{val}</span>
                <span style={{ color: "#334155", fontSize: 11 }}>base: {base}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT: Charts ── */}
        <div style={{ flex: 1, minWidth: 300 }}>

          {/* Operating point */}
          <div style={{ background: "#1e293b", borderRadius: 10, padding: "12px 16px", marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ color: "#94a3b8", fontSize: 13 }}>
                Operating Point: <strong style={{ color: "#38bdf8" }}>{marker}% Load</strong>
              </span>
              <span style={{ color: "#64748b", fontSize: 12 }}>
                Best η: <span style={{ color: "#4ade80" }}>{bestOpt.load}% ({bestOpt.efficiency}%)</span>
              </span>
            </div>
            <input type="range" min="0" max="150" step="2" value={marker}
              onChange={e => setMarker(Number(e.target.value))}
              style={{ width: "100%", accentColor: "#38bdf8" }} />
          </div>

          {/* KPI cards */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <CARD label="Baseline η"   val={basePoint.efficiency} unit="%" color="#ef4444" />
            <CARD label="Optimized η"  val={optPoint.efficiency}  unit="%" color="#4ade80"
              delta={optPoint.efficiency && basePoint.efficiency
                ? parseFloat((optPoint.efficiency - basePoint.efficiency).toFixed(2)) : undefined} />
            <CARD label="Baseline PF"  val={basePoint.pf} unit="" color="#f97316" />
            <CARD label="Optimized PF" val={optPoint.pf}  unit="" color="#facc15"
              delta={optPoint.pf && basePoint.pf
                ? parseFloat((optPoint.pf - basePoint.pf).toFixed(3)) : undefined} />
            <CARD label="Best η Base" val={bestBase.efficiency} unit="%" color="#94a3b8" />
            <CARD label="Best η Opt"  val={bestOpt.efficiency}  unit="%" color="#38bdf8"
              delta={bestOpt.efficiency && bestBase.efficiency
                ? parseFloat((bestOpt.efficiency - bestBase.efficiency).toFixed(2)) : undefined} />
          </div>

          {/* Efficiency chart */}
          <div style={{ background: "#1e293b", borderRadius: 10, padding: 14, marginBottom: 14 }}>
            <h3 style={{ color: "#e2e8f0", margin: "0 0 4px", fontSize: 14 }}>
              Efficiency — Baseline vs Optimized
              {hasPending && <span style={{ color: "#fbbf24", fontSize: 11, marginLeft: 8 }}>
                (showing last applied — click Apply to update)
              </span>}
            </h3>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={compData} margin={{ top: 5, right: 30, left: 5, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#0f172a" />
                <XAxis dataKey="load" tick={{ fill: "#94a3b8", fontSize: 11 }}
                  label={{ value: "Load (%)", position: "insideBottom", offset: -10, fill: "#94a3b8" }} />
                <YAxis domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 11 }}
                  label={{ value: "Efficiency (%)", angle: -90, position: "insideLeft", fill: "#94a3b8" }} />
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", color: "#e2e8f0" }}
                  formatter={(v, name) => [v + " %", name]}
                  labelFormatter={l => "Load: " + l + "%"} />
                <Legend wrapperStyle={{ color: "#94a3b8" }} />
                <ReferenceLine x={marker} stroke="#38bdf8" strokeDasharray="5 3"
                  label={{ value: marker + "%", fill: "#38bdf8", fontSize: 10 }} />
                <ReferenceLine x={bestOpt.load} stroke="#4ade80" strokeDasharray="4 2"
                  label={{ value: "Best", fill: "#4ade80", fontSize: 10 }} />
                <Area type="monotone" dataKey="baseline"  stroke="#ef4444" fill="#ef444420"
                  strokeWidth={2} dot={false} name="IE1 Baseline" />
                <Area type="monotone" dataKey="optimized" stroke="#4ade80" fill="#4ade8030"
                  strokeWidth={2.5} dot={false} name="Optimized" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* PF chart */}
          <div style={{ background: "#1e293b", borderRadius: 10, padding: 14, marginBottom: 14 }}>
            <h3 style={{ color: "#e2e8f0", margin: "0 0 4px", fontSize: 14 }}>Power Factor — Baseline vs Optimized</h3>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={compData} margin={{ top: 5, right: 30, left: 5, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#0f172a" />
                <XAxis dataKey="load" tick={{ fill: "#94a3b8", fontSize: 11 }}
                  label={{ value: "Load (%)", position: "insideBottom", offset: -10, fill: "#94a3b8" }} />
                <YAxis domain={[0, 1]} tick={{ fill: "#94a3b8", fontSize: 11 }}
                  label={{ value: "Power Factor", angle: -90, position: "insideLeft", fill: "#94a3b8" }} />
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", color: "#e2e8f0" }}
                  formatter={(v, name) => [v, name]} labelFormatter={l => "Load: " + l + "%"} />
                <Legend wrapperStyle={{ color: "#94a3b8" }} />
                <ReferenceLine x={marker} stroke="#38bdf8" strokeDasharray="5 3" />
                <Line type="monotone" dataKey="pf_base" stroke="#f97316" strokeWidth={2}
                  dot={false} name="Baseline PF" strokeDasharray="5 3" />
                <Line type="monotone" dataKey="pf_opt"  stroke="#facc15" strokeWidth={2.5}
                  dot={false} name="Optimized PF" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Loss reduction */}
          <div style={{ background: "#1e293b", borderRadius: 10, padding: 14 }}>
            <h3 style={{ color: "#e2e8f0", margin: "0 0 12px", fontSize: 14 }}>
              🔥 Loss Reduction at {marker}% Load
            </h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                ["Copper Loss",  basePoint.P_copper,   optPoint.P_copper,   "#ef4444"],
                ["Core Loss",    basePoint.P_core,     optPoint.P_core,     "#f97316"],
                ["Friction",     basePoint.P_friction, optPoint.P_friction, "#facc15"],
                ["Total Losses", basePoint.P_loss,     optPoint.P_loss,     "#94a3b8"],
              ].map(([label, base, opt, color]) => {
                const saved = base && opt ? (base - opt).toFixed(1) : "—";
                const pct   = base && opt && base > 0 ? ((base-opt)/base*100).toFixed(1) : "—";
                return (
                  <div key={label} style={{ background: "#0f172a", borderRadius: 8,
                    padding: "10px 14px", flex: 1, minWidth: 130 }}>
                    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: 13, color: "#94a3b8" }}>
                      <span style={{ color }}>{base} W</span>
                      <span style={{ color: "#475569" }}> → </span>
                      <span style={{ color: "#4ade80" }}>{opt} W</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#4ade80", marginTop: 2 }}>
                      saved: {saved} W ({pct}%)
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
