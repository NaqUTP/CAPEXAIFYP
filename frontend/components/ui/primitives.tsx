"use client";
import React from "react";

export function SectionHead({ title, idx }: { title: string; idx?: string }) {
  return (
    <div className="shead">
      <h2>{title}</h2>
      <span className="line" />
      {idx && <span className="idx">{idx}</span>}
    </div>
  );
}

export function Panel({ title, note, children }: { title?: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="panel" style={{ marginBottom: 18 }}>
      {title && (
        <div className="ph">
          <h3>{title}</h3>
          {note && <span className="note">{note}</span>}
        </div>
      )}
      <div className="pb">{children}</div>
    </div>
  );
}

export function Field({ label, ...props }: any) {
  return (
    <div>
      <label className="flabel">{label}</label>
      <input className="inp" {...props} />
    </div>
  );
}

// A meter-style figure readout; numbers are monospace by design.
export function Figure({ label, value, unit, signal, deep }: any) {
  return (
    <div style={{ padding: "14px 16px", borderRight: "1px solid var(--rule2)" }}>
      <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 10.5, color: "var(--muted)" }}>{label}</div>
      <div style={{
        fontFamily: "IBM Plex Mono, monospace", fontSize: 24, fontWeight: 600, marginTop: 6,
        letterSpacing: "-.02em", color: signal ? "var(--signal)" : deep ? "var(--deep)" : "var(--ink)",
      }}>
        {value}{unit && <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 400 }}> {unit}</span>}
      </div>
    </div>
  );
}

export function Metrics({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${React.Children.count(children)},1fr)`, border: "1px solid var(--rule)" }}>
      {children}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ border: "1px dashed var(--rule)", padding: 26, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
      {children}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 12, color: "var(--muted)" }}>{label || "working…"}</span>;
}
