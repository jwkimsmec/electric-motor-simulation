import { useState, useEffect } from "react";
import {
  ComposedChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, Area
} from "recharts";
import { MOTOR } from "../motorParams.js";

function generatePerformanceData() {
  const data = [];
  for (let load = 0; load <= 150; load += 2) {
    const lf         = load / 100;
    const I_noload   = MOTOR.current_low * 0.35;
    const I_rms      = I_noload + (MOTOR.current_low - I_noload) * Math.pow(lf, 0.85);
    const slip       = 0.005 + MOTOR.slip * lf;
    const rpm        = MOTOR.rpm_sync * (1 - slip);
    const torque     = MOTOR.torque_nm * lf;
    const P_out      = torque * rpm * 2 * Math.PI / 60;
    const V          = MOTOR.voltage_low;
    const pf         = load < 5 ? 0.18 : Math.min(0.88, 0.30 + 0.58 * Math.pow(lf, 0.45));
    const P_in       = Math.sqrt(3) * V * I_rms * pf;
    const P_copper   = 3 * Math.pow(I_rms, 2) * 4.2;
    const P_core     = 28;
    const P_friction = 12 + 3 * lf;
    const P_stray    = P_in * 0.005;
    const P_loss     = P_copper + P_core + P_friction + P_stray;
    const efficiency = load > 3 ? Math.min(91, (P_out / P_in) * 100) : 0;
    data.push({
      load:       parseFloat(load.toFixed(1)),
      current:    parseFloat(I_rms.toFixed(3)),
      rpm:        parseFloat(rpm.toFixed(1)),
      torque:     parseFloat(torque.toFixed(3)),
      P_in:       parseFloat(P_in.toFixed(1)),
      P_out:      parseFloat(P_out.toFixed(1)),
      P_copper:   parseFloat(P_copper.toFixed(1)),
      P_core:     parseFloat(P_core.toFixed(1)),
      P_friction: parseFloat(P_friction.toFixed(1)),
      P_loss:     parseFloat(P_loss.toFixed(1)),
      efficiency: parseFloat(efficiency.toFixed(2)),
      pf:         parseFloat(pf.toFixed(3)),
      slip_pct:   parseFloat((slip * 100).toFixed(3)),
    });
  }
  return data;
}

const TABS = [
  { id: "efficiency", label: "⚡ Efficiency & PF"  },
  { id: "power",      label: "🔋 Power Flow"       },
  { id: "losses",     label: "🔥 Loss Breakdown"   },
  { id: "mechanical", label: "⚙️ Mechanical"       },
  { id: "summary",    label: "📋 Data Table"       },
];

const CARD = ({ label, val, unit, color, sub }) => (
  <div style={{ background: "#0f172a", borderRadius: 10, padding: "12px 16px", minWidth: 130, flex: 1 }}>
    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 3 }}>{label}</div>
    <div style={{ fontSize: 17, color, fontWeight: "bold" }}>
      {val} <span style={{ fontSize: 11, color: "#475569" }}>{unit}</span>
    </div>
    {sub && <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{sub}</div>}
  </div>
);

const TIP = ({ color, text }) => (
  <div style={{ background: "#0f172a", borderRadius: 8, padding: "8px 14px", flex: 1, minWidth: 200 }}>
    <span style={{ color, fontWeight: "bold" }}>● </span>
    <span style={{ color: "#94a3b8", fontSize: 12 }}>{text}</span>
  </div>
);

export default function PerformanceTest() {
  const [activeTab, setActiveTab] = useState("efficiency");
  const [data,      setData]      = useState([]);
  const [marker,    setMarker]    = useState(100);

  useEffect(() => { setData(generatePerformanceData()); }, []);

  const point   = data.find(d => d.load === marker) || data.find(d => d.load === 100) || {};
  const bestEff = data.reduce((best, d) => d.efficiency > (best.efficiency || 0) ? d : best, {});

  return (
    <div>
      <h2 style={{ color: "#38bdf8", marginBottom: 4 }}>⚡ Motor Performance Test</h2>
      <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 16 }}>
        Full performance analysis — efficiency, power factor, losses, mechanical output
      </p>

      <div style={{ background: "#1e293b", borderRadius: 10, padding: "14px 20px", marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ color: "#94a3b8", fontSize: 13 }}>
            Operating Point: <strong style={{ color: "#38bdf8" }}>{marker}% Load</strong>
          </span>
          <span style={{ color: "#94a3b8", fontSize: 13 }}>
            Best Efficiency: <strong style={{ color: "#4ade80" }}>{bestEff.load}% Load ({bestEff.efficiency}%)</strong>
          </span>
        </div>
        <input type="range" min="0" max="150" step="2" value={marker}
          onChange={e => setMarker(Number(e.target.value))}
          style={{ width: "100%", accentColor: "#38bdf8" }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#475569", marginTop: 4 }}>
          <span>No Load</span><span>Rated (100%)</span><span>Overload (150%)</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <CARD label="Efficiency"   val={point.efficiency} unit="%" color="#4ade80" sub={"Best: " + bestEff.efficiency + "% @ " + bestEff.load + "%"} />
        <CARD label="Power Factor" val={point.pf}         unit=""  color="#facc15" sub="cos φ" />
        <CARD label="Input Power"  val={point.P_in}       unit="W" color="#38bdf8" sub="3-phase" />
        <CARD label="Output Power" val={point.P_out}      unit="W" color="#a78bfa" sub="mechanical" />
        <CARD label="Total Losses" val={point.P_loss}     unit="W" color="#ef4444" sub="copper+core+mech" />
        <CARD label="RMS Current"  val={point.current}    unit="A" color="#fb923c" sub="stator" />
        <CARD label="Speed"        val={point.rpm}        unit="rpm" color="#2dd4bf" sub={"slip: " + point.slip_pct + "%"} />
        <CARD label="Torque"       val={point.torque}     unit="Nm" color="#f472b6" sub="shaft" />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{
              padding: "7px 14px", borderRadius: 8, border: "none", cursor: "pointer",
              background: activeTab === t.id ? "#0ea5e9" : "#1e293b",
              color: activeTab === t.id ? "#fff" : "#94a3b8",
              fontWeight: activeTab === t.id ? "bold" : "normal", fontSize: 13
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "efficiency" && (
        <div style={{ background: "#1e293b", borderRadius: 10, padding: 16 }}>
          <h3 style={{ color: "#e2e8f0", margin: "0 0 4px" }}>Efficiency & Power Factor vs Load</h3>
          <p style={{ color: "#64748b", fontSize: 12, margin: "0 0 12px" }}>Left: Efficiency (%) | Right: Power Factor</p>
          <ResponsiveContainer width="100%" height={340}>
            <ComposedChart data={data} margin={{ top: 5, right: 50, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#0f172a" />
              <XAxis dataKey="load" tick={{ fill: "#94a3b8", fontSize: 11 }}
                label={{ value: "Load (%)", position: "insideBottom", offset: -10, fill: "#94a3b8" }} />
              <YAxis yAxisId="eff" domain={[0, 100]} tick={{ fill: "#4ade80", fontSize: 11 }}
                label={{ value: "Efficiency (%)", angle: -90, position: "insideLeft", fill: "#4ade80" }} />
              <YAxis yAxisId="pf" orientation="right" domain={[0, 1]} tick={{ fill: "#facc15", fontSize: 11 }}
                label={{ value: "Power Factor", angle: 90, position: "insideRight", fill: "#facc15" }} />
              <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", color: "#e2e8f0" }}
                formatter={(v, name) => [name === "efficiency" ? v + " %" : v, name === "efficiency" ? "Efficiency" : "Power Factor"]}
                labelFormatter={l => "Load: " + l + "%"} />
              <Legend wrapperStyle={{ color: "#94a3b8" }} />
              <ReferenceLine yAxisId="eff" x={marker} stroke="#38bdf8" strokeDasharray="5 3"
                label={{ value: marker + "%", fill: "#38bdf8", fontSize: 10 }} />
              <ReferenceLine yAxisId="eff" x={bestEff.load} stroke="#4ade80" strokeDasharray="5 3"
                label={{ value: "Best η", fill: "#4ade80", fontSize: 10 }} />
              <Area yAxisId="eff" type="monotone" dataKey="efficiency"
                stroke="#4ade80" fill="#4ade8025" strokeWidth={2.5} dot={false} name="efficiency" />
              <Line yAxisId="pf" type="monotone" dataKey="pf"
                stroke="#facc15" strokeWidth={2.5} dot={false} name="pf" />
            </ComposedChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            <TIP color="#4ade80" text="Efficiency peaks around 75-80% load" />
            <TIP color="#facc15" text="Power factor improves with load" />
            <TIP color="#38bdf8" text="No-load PF is very low (~0.18)" />
          </div>
        </div>
      )}

      {activeTab === "power" && (
        <div style={{ background: "#1e293b", borderRadius: 10, padding: 16 }}>
          <h3 style={{ color: "#e2e8f0", margin: "0 0 4px" }}>Power Flow vs Load</h3>
          <p style={{ color: "#64748b", fontSize: 12, margin: "0 0 12px" }}>Input vs Output power — gap = total losses</p>
          <ResponsiveContainer width="100%" height={340}>
            <ComposedChart data={data} margin={{ top: 5, right: 30, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#0f172a" />
              <XAxis dataKey="load" tick={{ fill: "#94a3b8", fontSize: 11 }}
                label={{ value: "Load (%)", position: "insideBottom", offset: -10, fill: "#94a3b8" }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }}
                label={{ value: "Power (W)", angle: -90, position: "insideLeft", fill: "#94a3b8" }} />
              <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", color: "#e2e8f0" }}
                formatter={(v, name) => [v + " W", name]} labelFormatter={l => "Load: " + l + "%"} />
              <Legend wrapperStyle={{ color: "#94a3b8" }} />
              <ReferenceLine x={marker} stroke="#38bdf8" strokeDasharray="5 3" />
              <Area type="monotone" dataKey="P_in"   stroke="#38bdf8" fill="#38bdf825" strokeWidth={2.5} dot={false} name="Input Power" />
              <Area type="monotone" dataKey="P_out"  stroke="#4ade80" fill="#4ade8025" strokeWidth={2.5} dot={false} name="Output Power" />
              <Line type="monotone" dataKey="P_loss" stroke="#ef4444" strokeWidth={2}   dot={false} name="Total Losses" strokeDasharray="5 3" />
            </ComposedChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            <TIP color="#38bdf8" text={"Input: " + point.P_in + " W at " + marker + "% load"} />
            <TIP color="#4ade80" text={"Output: " + point.P_out + " W at " + marker + "% load"} />
            <TIP color="#ef4444" text={"Losses: " + point.P_loss + " W at " + marker + "% load"} />
          </div>
        </div>
      )}

      {activeTab === "losses" && (
        <div style={{ background: "#1e293b", borderRadius: 10, padding: 16 }}>
          <h3 style={{ color: "#e2e8f0", margin: "0 0 4px" }}>Loss Breakdown vs Load</h3>
          <p style={{ color: "#64748b", fontSize: 12, margin: "0 0 12px" }}>Stacked: Copper + Core + Friction losses</p>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.filter(d => d.load % 10 === 0)} margin={{ top: 5, right: 30, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#0f172a" />
              <XAxis dataKey="load" tick={{ fill: "#94a3b8", fontSize: 11 }}
                label={{ value: "Load (%)", position: "insideBottom", offset: -10, fill: "#94a3b8" }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }}
                label={{ value: "Loss (W)", angle: -90, position: "insideLeft", fill: "#94a3b8" }} />
              <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", color: "#e2e8f0" }}
                formatter={(v, name) => [v + " W", name]} labelFormatter={l => "Load: " + l + "%"} />
              <Legend wrapperStyle={{ color: "#94a3b8" }} />
              <Bar dataKey="P_copper"   stackId="a" fill="#ef4444" name="Copper Loss"         />
              <Bar dataKey="P_core"     stackId="a" fill="#f97316" name="Core Loss"           />
              <Bar dataKey="P_friction" stackId="a" fill="#facc15" name="Friction & Windage"  radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            {[
              ["Copper Loss",        point.P_copper,   "#ef4444"],
              ["Core Loss",          point.P_core,     "#f97316"],
              ["Friction & Windage", point.P_friction, "#facc15"],
              ["Total Losses",       point.P_loss,     "#94a3b8"],
            ].map(([label, val, color]) => (
              <div key={label} style={{ background: "#0f172a", borderRadius: 8, padding: "10px 16px", flex: 1, minWidth: 140 }}>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 15, color, fontWeight: "bold" }}>{val} W</div>
                <div style={{ fontSize: 11, color: "#475569" }}>
                  {point.P_loss > 0 ? ((val / point.P_loss) * 100).toFixed(1) + "% of total" : "—"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "mechanical" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[
            { key: "rpm",      label: "① Speed vs Load",  unit: "rpm", color: "#a78bfa", domain: [1700, 1805], refVal: MOTOR.rpm_sync, refLabel: "Sync 1800rpm" },
            { key: "torque",   label: "② Torque vs Load", unit: "Nm",  color: "#fb923c", domain: null,         refVal: null },
            { key: "slip_pct", label: "③ Slip vs Load",   unit: "%",   color: "#2dd4bf", domain: null,         refVal: null },
          ].map(({ key, label, unit, color, domain, refVal, refLabel }) => (
            <div key={key} style={{ background: "#1e293b", borderRadius: 10, padding: 16 }}>
              <h3 style={{ color, margin: "0 0 8px" }}>{label}</h3>
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={data} margin={{ top: 5, right: 30, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#0f172a" />
                  <XAxis dataKey="load" tick={{ fill: "#94a3b8", fontSize: 11 }}
                    label={{ value: "Load (%)", position: "insideBottom", offset: -10, fill: "#94a3b8" }} />
                  <YAxis tick={{ fill: color, fontSize: 11 }} domain={domain || ["auto","auto"]}
                    label={{ value: unit, angle: -90, position: "insideLeft", fill: color }} />
                  <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", color: "#e2e8f0" }}
                    formatter={v => [v + " " + unit, key]} labelFormatter={l => "Load: " + l + "%"} />
                  <ReferenceLine x={marker} stroke="#38bdf8" strokeDasharray="5 3" />
                  {refVal && <ReferenceLine y={refVal} stroke="#475569" strokeDasharray="4 2"
                    label={{ value: refLabel, fill: "#475569", fontSize: 10 }} />}
                  <Area type="monotone" dataKey={key} stroke={color} fill={color + "20"} strokeWidth={2.5} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ))}
        </div>
      )}

      {activeTab === "summary" && (
        <div style={{ background: "#1e293b", borderRadius: 10, padding: 16, overflowX: "auto" }}>
          <h3 style={{ color: "#e2e8f0", margin: "0 0 12px" }}>Full Performance Data Table</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #334155" }}>
                {["Load %","I (A)","Speed (rpm)","Torque (Nm)","P_in (W)","P_out (W)","Losses (W)","η (%)","PF","Slip (%)"].map(h => (
                  <th key={h} style={{ padding: "8px 10px", color: "#64748b", textAlign: "right", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.filter(d => d.load % 10 === 0).map((d, i) => (
                <tr key={i} style={{
                  borderBottom: "1px solid #0f172a",
                  background: d.load === marker ? "#0ea5e920" : i % 2 === 0 ? "#0f172a40" : "transparent"
                }}>
                  <td style={{ padding: "7px 10px", color: d.load === 100 ? "#38bdf8" : "#e2e8f0", textAlign: "right", fontWeight: d.load === 100 ? "bold" : "normal" }}>{d.load}</td>
                  <td style={{ padding: "7px 10px", color: "#fb923c", textAlign: "right" }}>{d.current}</td>
                  <td style={{ padding: "7px 10px", color: "#a78bfa", textAlign: "right" }}>{d.rpm}</td>
                  <td style={{ padding: "7px 10px", color: "#fb923c", textAlign: "right" }}>{d.torque}</td>
                  <td style={{ padding: "7px 10px", color: "#38bdf8", textAlign: "right" }}>{d.P_in}</td>
                  <td style={{ padding: "7px 10px", color: "#4ade80", textAlign: "right" }}>{d.P_out}</td>
                  <td style={{ padding: "7px 10px", color: "#ef4444", textAlign: "right" }}>{d.P_loss}</td>
                  <td style={{ padding: "7px 10px", color: "#4ade80", textAlign: "right", fontWeight: "bold" }}>{d.efficiency}</td>
                  <td style={{ padding: "7px 10px", color: "#facc15", textAlign: "right" }}>{d.pf}</td>
                  <td style={{ padding: "7px 10px", color: "#2dd4bf", textAlign: "right" }}>{d.slip_pct}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
