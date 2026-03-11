import { MOTOR } from "../motorParams.js";

export default function MotorSpecs() {
  const specs = [
    ["Power", "1 HP / 746 W"],
    ["Voltage", "220V / 380V"],
    ["Current", "3.02A / 1.75A"],
    ["Frequency", "60 Hz"],
    ["Poles", "4"],
    ["Sync Speed", "1800 rpm"],
    ["Rated Speed", "1715 rpm"],
    ["Slip", "4.72%"],
    ["Torque", "4.1 Nm"],
    ["Rotor Bars", "34"],
    ["Rotor Type", "Squirrel Cage"],
    ["Sample Rate", "50 kHz"],
  ];

  return (
    <div style={{ maxWidth: 600 }}>
      <h2 style={{ color: "#38bdf8", marginBottom: 16 }}>⚙️ Motor Nameplate Specifications</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {specs.map(([label, value]) => (
          <div key={label} style={{ background: "#1e293b", borderRadius: 8, padding: "12px 16px" }}>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 16, color: "#e2e8f0", fontWeight: "bold" }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
