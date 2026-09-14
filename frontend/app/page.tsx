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
      <aside style={{ background: "var(--rail-bg,#1A1E22)", color: "#C7CDD2", position: "sticky", top: 0, height: "100vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "18px 18px 16px", borderBottom: "1px solid #2A2F34" }}>
          <div style={{ fontFamily: "IBM Plex Mono, monospace", fontWeight: 600, fontSize: 13, color: "#fff" }}>CAPEX&nbsp;AI</div>
          <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 10.5, color: "#7C858E", marginTop: 3 }}>RT2026 // cost model</div>
        </div>
        <nav style={{ padding: "8px 0", flex: 1 }}>
          {groups.map((g) => (
            <div key={g}>
              <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 10, color: "#7C858E", padding: "14px 18px 6px", letterSpacing: ".08em" }}>{g}</div>
              {Object.entries(TABS).filter(([, t]) => t.group === g).map(([k, t]) => {
                const on = k === tab;
                return (
                  <a key={k} onClick={() => setTab(k)}
                     style={{
                       display: "block", padding: "9px 18px", fontSize: 13.5, cursor: "pointer",
                       color: on ? "#fff" : "#C7CDD2", background: on ? "#22272C" : "transparent",
                       borderLeft: `2px solid ${on ? "var(--signal)" : "transparent"}`,
                       fontWeight: on ? 500 : 400,
                     }}>
                    {t.label}
                  </a>
                );
              })}
            </div>
          ))}
        </nav>
        <div style={{ borderTop: "1px solid #2A2F34", padding: "12px 18px", fontFamily: "IBM Plex Mono, monospace", fontSize: 11 }}>
          <Stat k="backend" v={health ? "live" : "offline"} dot={health ? "live" : "off"} />
          <Stat k="pytorch / mlp" v={health?.torch ? "on" : "off"} />
          <Stat k="models trained" v={health?.models ?? 0} />
          <Stat k="datasets" v={health?.datasets ?? 0} />
        </div>
      </aside>

      {/* main */}
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ background: "var(--panel)", borderBottom: "1px solid var(--rule)", padding: "14px 26px", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div>
            <h1 style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-.01em" }}>{TABS[tab].label}</h1>
            <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{TABS[tab].crumb}</div>
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
    <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color: "#7C858E" }}>
      <span>{k}</span>
      <b style={{ color: "#C7CDD2", fontWeight: 500 }}>
        {dot && <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", marginRight: 6, background: dot === "live" ? "#3FB27F" : "#C8442A" }} />}
        {v}
      </b>
    </div>
  );
}
