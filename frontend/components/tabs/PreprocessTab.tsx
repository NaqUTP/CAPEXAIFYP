"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { SectionHead, Panel, Empty, Metrics, Figure } from "@/components/ui/primitives";

const TYPES = ["Pipeline", "WHP", "CPP"];

export default function PreprocessTab() {
  const [file, setFile] = useState<File | null>(null);
  const [detection, setDetection] = useState<any>(null);
  const [chosen, setChosen] = useState("");
  const [storeName, setStoreName] = useState("");
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState("");

  async function onFile(e: any) {
    const f = e.target.files?.[0]; if (!f) return;
    setFile(f); setResult(null); setBusy("detect");
    try { const d = await api.preDetect(f); setDetection(d); setChosen(d.detection.suggested || ""); }
    catch { alert("Detection failed. Is the backend running?"); } finally { setBusy(""); }
  }
  async function onRun() {
    if (!file || !chosen) return;
    setBusy("run");
    try { setResult(await api.preRun(file, chosen, storeName.trim())); }
    catch (e: any) { alert(e.message); } finally { setBusy(""); }
  }
  function download() {
    if (!result?.clean_csv) return;
    const url = URL.createObjectURL(new Blob([result.clean_csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = (storeName.trim() || `${chosen}_clean`) + ".csv"; a.click();
    URL.revokeObjectURL(url);
  }

  const rep = result?.report;

  return (
    <div>
      <SectionHead title="Preprocessing pipeline" idx="raw → clean" />

      <Panel title="Upload raw data" note="auto-detects facility type">
        <label style={{ cursor: "pointer" }}>
          <Empty><b>Drop a CSV here</b><br />the pipeline maps columns to cost drivers, converts units, and drops identifiers</Empty>
          <input type="file" accept=".csv" onChange={onFile} style={{ display: "none" }} />
        </label>
        {busy === "detect" && <p style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>Detecting…</p>}
      </Panel>

      {detection && (
        <Panel title="Detection" note={`suggested ${detection.detection.suggested || "unclear"} · confidence ${detection.detection.confidence}`}>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {TYPES.map((t) => (
              <button key={t} onClick={() => setChosen(t)} className="tag"
                style={{ cursor: "pointer", padding: "6px 12px", borderColor: chosen === t ? "var(--deep)" : "var(--rule)", color: chosen === t ? "var(--deep)" : "var(--steel)" }}>
                {t}
              </button>
            ))}
          </div>
          {detection.detection.confidence < 0.5 && (
            <p style={{ fontSize: 12, color: "var(--warn)", marginBottom: 10 }}>Low confidence. Check the columns and confirm the type manually.</p>
          )}
          <p style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 11, color: "var(--muted)", marginBottom: 12 }}>
            columns: {detection.columns.join(", ")}
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <input className="inp" style={{ flex: 1 }} placeholder="store as (optional)" value={storeName} onChange={(e) => setStoreName(e.target.value)} />
            <button className="btn" onClick={onRun} disabled={!chosen || busy === "run"}>{busy === "run" ? "Processing…" : "Run preprocessing"}</button>
          </div>
        </Panel>
      )}

      {rep && (
        <Panel title="Clean data ready" note={result.stored ? `stored as ${result.stored_as}` : "not stored"}>
          <div style={{ marginBottom: 14 }}>
            <Metrics>
              <Figure label="final rows" value={rep.final_rows} />
              <Figure label="drivers mapped" value={Object.keys(rep.mapped).length} deep />
              <Figure label="dropped (metadata)" value={rep.dropped_metadata.length} />
              <Figure label="rows w/o cost" value={rep.dropped_no_target} />
            </Metrics>
          </div>
          <table>
            <thead><tr><th>Raw column</th><th>Resolved as</th><th>Action</th></tr></thead>
            <tbody>
              {Object.entries(rep.mapped).map(([raw, canon]: any) => (
                <tr key={raw}><td>{raw}</td><td>{canon}</td><td><span className="tag ok">cost driver</span></td></tr>
              ))}
              {rep.dropped_metadata.map((c: string) => (
                <tr key={c}><td>{c}</td><td>—</td><td><span className="tag">dropped: identifier</span></td></tr>
              ))}
              {rep.extra_kept.map((c: string) => (
                <tr key={c}><td>{c}</td><td>extra</td><td><span className="tag warn">kept: review</span></td></tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button className="btn ghost" onClick={download}>Download clean CSV</button>
          </div>
        </Panel>
      )}
    </div>
  );
}
