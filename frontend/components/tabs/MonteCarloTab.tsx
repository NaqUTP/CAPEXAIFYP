"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { SectionHead, Panel, Metrics, Figure, Empty } from "@/components/ui/primitives";

export default function MonteCarloTab() {
  const [datasets, setDatasets] = useState<any[]>([]);
  const [active, setActive] = useState("");
  const [cols, setCols] = useState<string[]>([]);
  const [features, setFeatures] = useState<Record<string, string>>({});
  const [nSims, setNSims] = useState(1000);
  const [uncertainty, setUncertainty] = useState(0.10);
  const [budget, setBudget] = useState("");
  const [res, setRes] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.listDatasets().then((d) => { setDatasets(d); if (d[0]) setActive(d[0].name); }); }, []);
  useEffect(() => {
    if (active) api.getModel(active)
      .then((m) => setCols(m.features.filter((f: string) => !f.includes("_"))))
      .catch(() => setCols([]));
  }, [active]);

  async function run() {
    setBusy(true);
    const parsed: any = {};
    cols.forEach((f) => { parsed[f] = features[f] !== undefined && features[f] !== "" ? +features[f] : 0; });
    try {
      setRes(await api.montecarlo({ dataset: active, features: parsed, n_sims: nSims, uncertainty, budget: budget ? +budget : null }));
    } catch (e: any) { alert(e.message); } finally { setBusy(false); }
  }

  const maxH = res ? Math.max(...res.hist) : 1;

  return (
    <div>
      <SectionHead title="Monte Carlo" idx={`${nSims} simulations`} />

      <Panel title="Simulation inputs" note="risk on the cost drivers">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <div>
            <label className="flabel">dataset</label>
            <select className="inp" value={active} onChange={(e) => setActive(e.target.value)}>
              {datasets.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="flabel">budget (MM USD, optional)</label>
            <input className="inp" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="e.g. 1000" />
          </div>
        </div>
        {cols.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 14 }}>
            {cols.map((f) => (
              <div key={f}>
                <label className="flabel">{f}</label>
                <input className="inp" value={features[f] || ""} onChange={(e) => setFeatures({ ...features, [f]: e.target.value })} placeholder="base value" />
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <span className="flabel" style={{ margin: 0 }}>uncertainty</span>
          <input type="range" min={0.05} max={0.3} step={0.05} value={uncertainty} onChange={(e) => setUncertainty(+e.target.value)} />
          <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 12 }}>{Math.round(uncertainty * 100)}%</span>
          <button className="btn" onClick={run} disabled={busy || !cols.length} style={{ marginLeft: "auto" }}>{busy ? "Running…" : "Run Monte Carlo"}</button>
        </div>
        {!cols.length && <p style={{ marginTop: 10, fontSize: 12, color: "var(--muted)" }}>Train a model for this dataset first (Data & Models tab).</p>}
      </Panel>

      {res && (
        <>
          <Metrics>
            <Figure label="P50" value={res.p50} unit="MM" />
            <Figure label="P80" value={res.p80} unit="MM" />
            <Figure label="P90" value={res.p90} unit="MM" />
            <Figure label="P(> budget)" value={res.p_over_budget ?? "—"} unit={res.p_over_budget != null ? "%" : ""} signal />
          </Metrics>
          <Panel title="Total cost distribution" note={`${res.n} simulations`}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 150, borderBottom: "1px solid var(--rule)", paddingTop: 8 }}>
              {res.hist.map((h: number, i: number) => (
                <div key={i} style={{ flex: 1, height: `${(h / maxH) * 100}%`, background: "var(--deep2)", opacity: 0.85 }} />
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "IBM Plex Mono, monospace", fontSize: 10, color: "var(--muted)", paddingTop: 6 }}>
              <span>{res.min} MM</span><span>{res.p50} MM (P50)</span><span>{res.max} MM</span>
            </div>
          </Panel>
        </>
      )}
      {!res && <Empty>Run a simulation to see the P50, P80 and P90 cost distribution.</Empty>}
    </div>
  );
}
