"use client";
import { useState, useRef, useEffect } from "react";
import { Send, Settings, Trash2 } from "lucide-react";
import { SectionTitle, Button, Banner, Spinner } from "@/components/ui/primitives";
import { api } from "@/lib/api";

const CHIPS = [
  ["Main cost driver?", "What is the main cost driver for offshore CAPEX, and which feature usually has the strongest influence?"],
  ["Why is CAPEX high?", "What are the top 5 reasons for CAPEX overruns in oil and gas projects?"],
  ["Water depth impact?", "How does water depth affect CAPEX for offshore platforms? Give a parametric rule of thumb."],
  ["What if costs rise 20%?", "If material and labour costs rise 20% due to inflation, how would that affect CAPEX estimates?"],
  ["CAPEX vs production?", "What is the typical relationship between production capacity (kbopd) and CAPEX for an FPSO?"],
  ["Cost overrun causes?", "List the most common causes of cost overruns in upstream projects and how to mitigate them."],
];

export default function AIAdvisorTab() {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [backend, setBackend] = useState("ollama");
  const [ollamaModel, setOllamaModel] = useState("llama3");
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text: string) => {
    if (!text.trim()) return;
    const next = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const r = await api.chat({
        messages: next,
        backend,
        ollama_model: ollamaModel,
        ollama_url: ollamaUrl,
      });
      setMessages([...next, { role: "assistant", content: r.reply }]);
    } catch (e: any) {
      setMessages([...next, { role: "assistant", content: `Error: ${e.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card p-5 flex flex-col" style={{ minHeight: "70vh" }}>
      <div className="flex items-center justify-between">
        <SectionTitle>AI CAPEX Advisor</SectionTitle>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="text-gray-400 hover:text-petronas-teal transition"
        >
          <Settings size={18} />
        </button>
      </div>
      <p className="text-sm text-gray-500 -mt-2 mb-1">
        Primed as a senior oil &amp; gas cost engineer.
      </p>
      <div className="mb-3">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#CCEFE9] text-[#0B6B64]">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Context-aware · sees your loaded datasets &amp; trained models
        </span>
      </div>

      {showSettings && (
        <div className="card p-4 mb-4 bg-gray-50">
          <div className="flex flex-wrap gap-3 items-center">
            <select
              className="input max-w-[200px]"
              value={backend}
              onChange={(e) => setBackend(e.target.value)}
            >
              <option value="ollama">Ollama (local)</option>
              <option value="anthropic">Anthropic API</option>
            </select>
            {backend === "ollama" && (
              <>
                <input
                  className="input max-w-[160px]"
                  value={ollamaModel}
                  onChange={(e) => setOllamaModel(e.target.value)}
                  placeholder="model"
                />
                <input
                  className="input max-w-[240px]"
                  value={ollamaUrl}
                  onChange={(e) => setOllamaUrl(e.target.value)}
                  placeholder="ollama url"
                />
              </>
            )}
          </div>
          {backend === "anthropic" && (
            <p className="text-xs text-gray-500 mt-2">
              Set <code>ANTHROPIC_API_KEY</code> in the backend environment.
            </p>
          )}
        </div>
      )}

      {/* quick chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {CHIPS.map(([label, prompt]) => (
          <button
            key={label}
            onClick={() => send(prompt)}
            className="text-xs px-3 py-1.5 rounded-full border border-black/10 hover:border-petronas-teal hover:text-petronas-teal transition"
          >
            {label}
          </button>
        ))}
      </div>

      {/* messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {messages.length === 0 && (
          <Banner>Ask anything about CAPEX, cost drivers, or what-if scenarios.</Banner>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                m.role === "user"
                  ? "text-white"
                  : "bg-gray-100 text-petronas-ink"
              }`}
              style={
                m.role === "user"
                  ? { background: "linear-gradient(to right,#00A19B,#6C4DD3)" }
                  : undefined
              }
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && <Spinner label="Thinking…" />}
        <div ref={endRef} />
      </div>

      {/* input */}
      <div className="flex gap-2 mt-4 items-center">
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            className="text-gray-400 hover:text-red-500 transition"
            title="Clear chat"
          >
            <Trash2 size={18} />
          </button>
        )}
        <input
          className="input flex-1"
          placeholder="Ask about CAPEX, cost drivers, what-if scenarios…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send(input)}
        />
        <Button onClick={() => send(input)} disabled={loading} className="inline-flex items-center gap-2">
          <Send size={16} /> Send
        </Button>
      </div>
    </div>
  );
}
