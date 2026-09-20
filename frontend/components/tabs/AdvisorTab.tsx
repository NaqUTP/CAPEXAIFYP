"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { SectionHead, Panel } from "@/components/ui/primitives";

const CHIPS = ["Main cost driver?", "Why is CAPEX high?", "Water depth impact?", "If costs rise 20%?", "CAPEX vs production?"];

export default function AdvisorTab() {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(text: string) {
    const q = text.trim(); if (!q) return;
    const next = [...messages, { role: "user", content: q }];
    setMessages(next); setInput(""); setBusy(true);
    try {
      const r = await api.chat({ messages: next, use_context: true });
      setMessages([...next, { role: "assistant", content: r.reply }]);
    } catch (e: any) {
      setMessages([...next, { role: "assistant", content: "The advisor is not reachable right now." }]);
    } finally { setBusy(false); }
  }

  return (
    <div>
      <SectionHead title="Cost advisor" idx="grounded in loaded data" />
      <Panel title="Ask the model" note="context: your datasets & trained models">
        <div style={{ marginBottom: 12 }}>
          {CHIPS.map((c) => (
            <button key={c} onClick={() => send(c)} className="tag"
              style={{ cursor: "pointer", padding: "5px 10px", marginRight: 6, marginBottom: 6, background: "var(--panel)" }}>
              {c}
            </button>
          ))}
        </div>

        <div className="panel" style={{ minHeight: 160, marginBottom: 12 }}>
          {messages.length === 0 && (
            <div className="pb" style={{ color: "var(--muted)", fontSize: 13 }}>
              Ask about cost drivers, feature effects, or what-if scenarios. Answers use your loaded datasets and trained models.
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} style={{ padding: "14px 16px", borderBottom: "1px solid var(--rule2)", background: m.role === "user" ? "var(--panel2)" : "transparent" }}>
              <div style={{ fontFamily: "Inter, sans-serif", fontSize: 10, color: "var(--muted)", marginBottom: 5, letterSpacing: ".04em" }}>
                {m.role === "user" ? "YOU" : "ADVISOR"}
              </div>
              <div style={{ fontSize: 13.5, lineHeight: 1.6, whiteSpace: "pre-wrap", fontFamily: m.role === "user" ? "Inter, sans-serif" : "inherit" }}>
                {m.content}
              </div>
            </div>
          ))}
          {busy && <div className="pb" style={{ color: "var(--muted)", fontSize: 12 }}>thinking…</div>}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <input className="inp" style={{ flex: 1 }} value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(input)} placeholder="Ask about cost drivers or a what-if scenario" />
          <button className="btn" onClick={() => send(input)} disabled={busy}>Send</button>
        </div>
      </Panel>
    </div>
  );
}
