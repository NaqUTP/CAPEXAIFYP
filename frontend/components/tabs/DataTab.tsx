"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { SectionHead, Panel, Field, Metrics, Figure, Empty, Spinner } from "@/components/ui/primitives";

export default function DataTab() {
  const [datasets, setDatasets] = useState<any[]>([]);
  const [active, setActive] = useState<string>("");
  const [model, setModel] = useState<any>(null);
  const [busy, setBusy] = useState("");
  const [testSize, setTestSize] = useState(0.2);
  const [features, setFeatures] = useState<Record<string, string>>({});
  const [breakdown, setBreakdown] = useState<any>(null);
  const [shap, setShap] = useState<any>(null);

  const refresh = () => api.listDatasets().then((d) => { setDatasets(d); if (!active && d[0]) setActive(d[0].name); });
  useEffect(() => { refresh(); }, []);
  useEffect(() => { if (active) api.getModel(active).then(setModel).catch(() => setModel(null)); }, [active]);

  async function onUpload(e: any) {
    const f = e.target.files?.[0]; if (!f) return;
    setBusy("upload");
    try { const r = await api.uploadDataset(f); setActive(r.name); await refresh(); }
    finally { setBusy(""); }
  }
  async function onTrain() {
    setBusy("train"); setShap(null); setBreakdown(null);
    try { setModel(await api.train({ dataset: active, test_size: testSize })); }
    catch (e: any) { alert(e.message); } finally { setBusy(""); }
  }
  async function onPredict() {
    setBusy("predict");
    const parsed: any = {};
    Object.entries(features).forEach(([k, v]) => { if (v !== "") parsed[k] = isNaN(+v) ? v : +v; });
    try {
      const r = await api.predict({ dataset: active, features: parsed });
      setBreakdown(r.breakdown);
      try { setShap(await api.explain({ dataset: active, features: parsed })); } catch { setShap(null); }
    } catch (e: any) { alert(e.message); } finally { setBusy(""); }
  }

  const scored = model ? Object.entries(model.results).filter(([, r]: any) => r.r2 != null) : [];
  const maxR2 = scored.length ? Math.max(...scored.map(([, r]: any) => r.r2)) : 1;
  const featureCols = model ? model.features.filter((f: string) => !f.includes("_")) : [];

  return (
    <div>
      <SectionHead title="Training dataset" idx={active || "none loaded"} />

      <Panel title="Datasets" note={`${datasets.length} loaded`}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <label className="btn" style={{ display: "inline-block" }}>
            {busy === "upload" ? "Uploading…" : "Upload CSV"}
            <input type="file" accept=".csv" onChange={onUpload} style={{ display: "none" }} />
          </label>
          {datasets.map((d) => (
            <button key={d.name} onClick={() => setActive(d.name)}
              className="tag" style={{ cursor: "pointer", borderColor: d.name === active ? "#00A19B" : "var(--rule)", color: d.name === active ? "#00A19B" : "#B4BCC8" }}>
              {d.name} · {d.rows}
            </button>
          ))}
          {!datasets.length && <span style={{ color: "var(--muted)", fontSize: 13 }}>No datasets. Upload a CSV; the last column is treated as CAPEX.</span>}
        </div>
      </Panel>

      {active && (
        <Panel title="Model performance" note={busy === "train" ? "training…" : "4 models // best by R²"}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
            <span className="flabel" style={{ margin: 0 }}>test set</span>
            <input type="range" min={0.1} max={0.4} step={0.05} value={testSize} onChange={(e) => setTestSize(+e.target.value)} />
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12 }}>{Math.round(testSize * 100)}%</span>
            <button className="btn" onClick={onTrain} disabled={busy === "train"} style={{ marginLeft: "auto" }}>
              {busy === "train" ? "Training…" : "Train models"}
            </button>
          </div>

          {!model && <Empty>Train to compare Random Forest, Gradient Boosting, MLP and TabPFN.</Empty>}

          {model && (
            <>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 26, height: 190, padding: "10px 6px 0", borderBottom: "1px solid var(--rule)" }}>
                {scored.map(([name, r]: any) => (
                  <div key={name} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
                    <div style={{ width: "100%", maxWidth: 96, height: `${(r.r2 / maxR2) * 100}%`, background: name === model.best_model ? "#6C4DD3" : "#00A19B" }} />
                    <div style={{ fontFamily: "Inter, sans-serif", fontSize: 11, marginTop: 8, color: "#B4BCC8", textAlign: "center" }}>
                      <b style={{ display: "block", color: "var(--text)", fontSize: 12 }}>{r.r2}</b>{name}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "Inter, sans-serif", fontSize: 10, color: "var(--muted)", padding: "6px 6px 0" }}>
                <span>R² on held-out test set</span><span>best: {model.best_model}</span>
              </div>
            </>
          )}
        </Panel>
      )}

      {model && (
        <Panel title="Predict CAPEX" note={`active model // ${model.best_model}`}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 14 }}>
            {featureCols.map((f: string) => (
              <Field key={f} label={f} value={features[f] || ""} placeholder="blank = impute"
                onChange={(e: any) => setFeatures({ ...features, [f]: e.target.value })} />
            ))}
          </div>
          <button className="btn" onClick={onPredict} disabled={busy === "predict"}>
            {busy === "predict" ? "Running…" : "Run prediction"}
          </button>
          {breakdown && (
            <div style={{ marginTop: 16 }}>
              <Metrics>
                <Figure label="base capex" value={breakdown.base} unit="MM USD" deep />
                <Figure label="contingency" value={breakdown.contingency} />
                <Figure label="escalation" value={breakdown.escalation} />
                <Figure label="grand total" value={breakdown.grand_total} unit="MM USD" />
              </Metrics>
            </div>
          )}
        </Panel>
      )}

      {shap?.available && (
        <Panel title="Why this estimate" note={`SHAP // vs dataset mean ${shap.mean_target}`}>
          {shap.contributions.slice(0, 6).map((c: any) => {
            const mag = Math.min(Math.abs(c.value) / (Math.abs(shap.contributions[0].value) || 1), 1) * 44;
            const inc = c.value > 0;
            return (
              <div key={c.feature} style={{ display: "grid", gridTemplateColumns: "130px 1fr 62px", alignItems: "center", gap: 10, padding: "5px 0" }}>
                <span style={{ fontFamily: "Inter, sans-serif", fontSize: 11.5, color: "#B4BCC8", textAlign: "right" }}>{c.feature}</span>
                <div style={{ position: "relative", height: 16, background: "rgba(255,255,255,.06)" }}>
                  <div style={{ position: "absolute", left: "50%", top: -2, bottom: -2, width: 1, background: "#B4BCC8" }} />
                  <div style={{ position: "absolute", top: 0, height: "100%", background: inc ? "#6C4DD3" : "#00A19B", left: inc ? "50%" : `${50 - mag}%`, width: `${mag}%` }} />
                </div>
                <span style={{ fontFamily: "Inter, sans-serif", fontSize: 11.5, textAlign: "right" }}>{c.value > 0 ? "+" : ""}{c.value}</span>
              </div>
            );
          })}
          <div style={{ display: "flex", gap: 16, marginTop: 12, fontFamily: "Inter, sans-serif", fontSize: 11, color: "var(--muted)" }}>
            <span><i style={{ display: "inline-block", width: 10, height: 10, background: "#6C4DD3", marginRight: 5 }} />raises CAPEX</span>
            <span><i style={{ display: "inline-block", width: 10, height: 10, background: "#00A19B", marginRight: 5 }} />lowers CAPEX</span>
          </div>
        </Panel>
      )}
    </div>
  );
}
