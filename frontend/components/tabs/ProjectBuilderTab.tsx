"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { SectionHead, Panel, Field, Empty } from "@/components/ui/primitives";

export default function ProjectBuilderTab() {
  const [projects, setProjects] = useState<any[]>([]);
  const [datasets, setDatasets] = useState<any[]>([]);
  const [active, setActive] = useState("");
  const [newName, setNewName] = useState("");
  const [compType, setCompType] = useState("");
  const [compDataset, setCompDataset] = useState("");
  const [features, setFeatures] = useState<Record<string, string>>({});
  const [cols, setCols] = useState<string[]>([]);
  const [busy, setBusy] = useState("");

  const refresh = () => api.listProjects().then((p) => { setProjects(p); if (!active && p[0]) setActive(p[0].name); });
  useEffect(() => { refresh(); api.listDatasets().then(setDatasets); }, []);
  useEffect(() => {
    if (compDataset) api.getModel(compDataset)
      .then((m) => setCols(m.features.filter((f: string) => !f.includes("_"))))
      .catch(() => setCols([]));
  }, [compDataset]);

  async function create() {
    if (!newName.trim()) return;
    await api.createProject(newName.trim()); setNewName(""); await refresh(); setActive(newName.trim());
  }
  async function addComponent() {
    if (!active || !compDataset || !compType) return;
    setBusy("add");
    const parsed: any = {};
    Object.entries(features).forEach(([k, v]) => { if (v !== "") parsed[k] = isNaN(+v) ? v : +v; });
    try { await api.addComponent({ project: active, dataset: compDataset, component_type: compType, features: parsed }); await refresh(); }
    catch (e: any) { alert(e.message); } finally { setBusy(""); }
  }

  const proj = projects.find((p) => p.name === active);

  return (
    <div>
      <SectionHead title="Project builder" idx="multi-facility rollup" />

      <Panel title="Projects" note={`${projects.length} defined`}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input className="inp" style={{ width: 220 }} placeholder="new project name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <button className="btn" onClick={create}>Create project</button>
          {projects.map((p) => (
            <button key={p.name} onClick={() => setActive(p.name)} className="tag"
              style={{ cursor: "pointer", padding: "6px 12px", borderColor: p.name === active ? "var(--deep)" : "var(--rule)" }}>
              {p.name}
            </button>
          ))}
        </div>
      </Panel>

      {active && (
        <Panel title="Add component" note={active}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <Field label="component name" value={compType} onChange={(e: any) => setCompType(e.target.value)} placeholder="e.g. WHP-A" />
            <div>
              <label className="flabel">from trained dataset</label>
              <select className="inp" value={compDataset} onChange={(e) => setCompDataset(e.target.value)}>
                <option value="">select…</option>
                {datasets.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
              </select>
            </div>
          </div>
          {cols.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 14 }}>
              {cols.map((f) => (
                <Field key={f} label={f} value={features[f] || ""} placeholder="blank = impute"
                  onChange={(e: any) => setFeatures({ ...features, [f]: e.target.value })} />
              ))}
            </div>
          )}
          <button className="btn" onClick={addComponent} disabled={busy === "add" || !compDataset}>
            {busy === "add" ? "Adding…" : "Add to project"}
          </button>
        </Panel>
      )}

      {proj && (
        <Panel title={proj.name} note={`${proj.components.length} components`}>
          {proj.components.length === 0 ? (
            <Empty>No components yet. Add a facility above to build up the project cost.</Empty>
          ) : (
            <>
              <table>
                <thead><tr><th>Component</th><th>Type</th><th className="num">CAPEX (MM USD)</th></tr></thead>
                <tbody>
                  {proj.components.map((c: any, i: number) => (
                    <tr key={i}><td>{c.type}</td><td>{c.dataset}</td><td className="num">{c.capex}</td></tr>
                  ))}
                </tbody>
              </table>
              <div style={{ borderTop: "2px solid var(--ink)", marginTop: 8, display: "flex", justifyContent: "space-between", padding: "11px 14px", background: "#FBFAF7" }}>
                <span style={{ fontSize: 13, color: "var(--steel)" }}>Project CAPEX</span>
                <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 22, fontWeight: 600 }}>{proj.total} MM USD</span>
              </div>
            </>
          )}
        </Panel>
      )}
    </div>
  );
}
