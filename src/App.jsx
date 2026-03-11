import { useState } from "react";
import CurrentGraph from "./components/CurrentGraph.jsx";
import MotorSpecs from "./components/MotorSpecs.jsx";
import FaultComparison from "./components/FaultComparison.jsx";
import LoadTest from "./components/LoadTest.jsx";

export default function App() {
  const [activeTab, setActiveTab] = useState("specs");
  const tabs = [
    { id: "specs",   label: "⚙️ Motor Specs" },
    { id: "current", label: "⚡ Current Graph" },
    { id: "fault",   label: "🔴 Fault Comparison" },
    { id: "load",    label: "⚖️ Load Test" },
  ];

  return (
    <div style={{ fontFamily: "sans-serif", background: "#0f172a", minHeight: "100vh", color: "#e2e8f0" }}>
      <div style={{ background: "#1e293b", padding: "16px 24px", borderBottom: "1px solid #334155" }}>
        <h1 style={{ margin: 0, color: "#38bdf8", fontSize: 22 }}>🔧 Induction Motor Virtual Testbench</h1>
        <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>1HP | 220V | 60Hz | 4-pole | Squirrel Cage</p>
      </div>
      <div style={{ display: "flex", gap: 8, padding: "16px 24px 0", flexWrap: "wrap" }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "8px 20px", borderRadius: 8, border: "none", cursor: "pointer",
              background: activeTab === tab.id ? "#0ea5e9" : "#1e293b",
              color: activeTab === tab.id ? "#fff" : "#94a3b8",
              fontWeight: activeTab === tab.id ? "bold" : "normal"
            }}>
            {tab.label}
          </button>
        ))}
      </div>
      <div style={{ padding: 24 }}>
        {activeTab === "specs"   && <MotorSpecs />}
        {activeTab === "current" && <CurrentGraph />}
        {activeTab === "fault"   && <FaultComparison />}
        {activeTab === "load"    && <LoadTest />}
      </div>
    </div>
  );
}
