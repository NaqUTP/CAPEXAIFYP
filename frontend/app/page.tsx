"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import DataTab from "@/components/tabs/DataTab";
import PreprocessTab from "@/components/tabs/PreprocessTab";
import ProjectBuilderTab from "@/components/tabs/ProjectBuilderTab";
import MonteCarloTab from "@/components/tabs/MonteCarloTab";
import CompareTab from "@/components/tabs/CompareTab";
import AdvisorTab from "@/components/tabs/AdvisorTab";

const TABS: Record<string, { label: string; crumb: string; group: string; el: any }> = {
  data:    { label: "Data & Models",  crumb: "estimation / data & models",  group: "ESTIMATION", el: DataTab },
  pre:     { label: "Preprocessing",  crumb: "estimation / preprocessing",  group: "ESTIMATION", el: PreprocessTab },
  project: { label: "Project Builder",crumb: "estimation / project builder",group: "ESTIMATION", el: ProjectBuilderTab },
  mc:      { label: "Monte Carlo",    crumb: "analysis / monte carlo",      group: "ANALYSIS",   el: MonteCarloTab },
  cmp:     { label: "Compare",        crumb: "analysis / compare",          group: "ANALYSIS",   el: CompareTab },
  ai:      { label: "Cost Advisor",   crumb: "analysis / cost advisor",     group: "ANALYSIS",   el: AdvisorTab },
};

export default function Page() {
  const [tab, setTab] = useState("data");
  const [health, setHealth] = useState<any>(null);

  useEffect(() => {
    const poll = () => api.health().then(setHealth).catch(() => setHealth(null));
    poll();
    const id = setInterval(poll, 8000);
    return () => clearInterval(id);
  }, []);

  const Active = TABS[tab].el;
  const groups = ["ESTIMATION", "ANALYSIS"];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "216px 1fr", minHeight: "100vh" }}>
      {/* rail */}
      <aside style={{ background: "#12161C", color: "#B4BCC8", borderRight: "1px solid rgba(255,255,255,.06)", position: "sticky", top: 0, height: "100vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "18px 18px 16px", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
          <div style={{ fontFamily: "Sora, sans-serif", fontWeight: 700, fontSize: 15, background: "linear-gradient(135deg,#00A19B,#6C4DD3)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>CAPEX AI</div>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: 10.5, color: "#5B6472", marginTop: 3, letterSpacing: ".04em" }}>RT2026 · cost model</div>
        </div>
        <nav style={{ padding: "8px 0", flex: 1 }}>
          {groups.map((g) => (
            <div key={g}>
              <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: 10, color: "#5B6472", padding: "16px 18px 6px", letterSpacing: ".12em" }}>{g}</div>
              {Object.entries(TABS).filter(([, t]) => t.group === g).map(([k, t]) => {
                const on = k === tab;
                return (
                  <a key={k} onClick={() => setTab(k)}
                     style={{
                       display: "block", padding: "10px 18px", fontSize: 13.5, cursor: "pointer", fontFamily: "Inter, sans-serif",
                       color: on ? "#fff" : "#B4BCC8", background: on ? "rgba(0,161,155,.14)" : "transparent",
                       borderLeft: `3px solid ${on ? "#00A19B" : "transparent"}`,
                       fontWeight: on ? 500 : 400,
                     }}>
                    {t.label}
                  </a>
                );
              })}
            </div>
          ))}
        </nav>
        <div style={{ borderTop: "1px solid rgba(255,255,255,.06)", padding: "14px 18px", fontFamily: "Inter, sans-serif", fontSize: 11 }}>
          <Stat k="backend" v={health ? "live" : "offline"} dot={health ? "live" : "off"} />
          <Stat k="pytorch / mlp" v={health?.torch ? "on" : "off"} />
          <Stat k="models trained" v={health?.models ?? 0} />
          <Stat k="datasets" v={health?.datasets ?? 0} />
        </div>
      </aside>

      {/* main */}
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ background: "#12161C", borderBottom: "1px solid rgba(255,255,255,.06)", padding: "16px 26px", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-.01em", fontFamily: "Sora, sans-serif" }}>{TABS[tab].label}</h1>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: 11, color: "var(--muted)", marginTop: 3 }}>{TABS[tab].crumb}</div>
          </div>
        </div>
        <div style={{ padding: 26, maxWidth: 1180 }}>
          <Active />
        </div>
      </div>
    </div>
  );
}

function Stat({ k, v, dot }: { k: string; v: any; dot?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", color: "#5B6472" }}>
      <span>{k}</span>
      <b style={{ color: "#B4BCC8", fontWeight: 500 }}>
        {dot && <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", marginRight: 6, background: dot === "live" ? "#3FB27F" : "#E5654B", boxShadow: dot === "live" ? "0 0 6px #3FB27F" : "none" }} />}
        {v}
      </b>
    </div>
  );
}
