import { useState, useRef, useEffect } from "react";

const STAGES = [
  { id: "extract",  label: "Extracting paragraphs",   pct: 10 },
  { id: "rewrite",  label: "LLM semantic rewrite",    pct: 45 },
  { id: "noise",    label: "Injecting natural noise",  pct: 78 },
  { id: "assemble", label: "Reassembling document",   pct: 95 },
  { id: "done",     label: "Complete",                 pct: 100 },
];

const AI_MODELS = ["llama3:8b", "phi3:mini", "mistral:7b", "gemma:7b"];

function LogLine({ text, delay }) {
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVis(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return (
    <div style={{
      opacity: vis ? 1 : 0,
      transition: "opacity 0.3s",
      color: text.startsWith("✓") ? "#7ecb7e" : text.startsWith("→") ? "#c9a96e" : "#8a8a8a",
      fontFamily: "'DM Mono', monospace",
      fontSize: "0.72rem",
      lineHeight: 1.7,
    }}>
      {text}
    </div>
  );
}

export default function DocHuman() {
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [phase, setPhase] = useState("idle"); // idle | processing | done
  const [stageIdx, setStageIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState([]);
  const [model, setModel] = useState("llama3:8b");
  const [typoRate, setTypoRate] = useState(1);
  const [burstiness, setBurstiness] = useState("High");
  const [stats, setStats] = useState(null);
  const [ollamaStatus, setOllamaStatus] = useState(null);
  const fileRef = useRef();
  const logsRef = useRef();

  useEffect(() => {
    if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight;
  }, [logs]);

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f?.name.endsWith(".docx")) setFile(f);
  };

  const simulateProcess = () => {
    if (!file) return;
    setPhase("processing"); setLogs([]); setStageIdx(0); setProgress(0);

    const fakeLogs = [
      "→ Parsing document XML…",
      "→ Found 24 eligible paragraphs",
      "→ Skipping 3 tables (preserved)",
      "→ Skipping 2 images (preserved)",
      "✓ Extraction complete",
      `→ Connecting to Ollama [${model}]…`,
      "✓ Ollama reachable",
      "→ Rewriting paragraph 1/24…",
      "→ Rewriting paragraph 5/24…",
      "→ Rewriting paragraph 11/24…",
      "→ Rewriting paragraph 18/24…",
      "→ Rewriting paragraph 24/24…",
      "✓ LLM rewrite complete",
      "→ Scrubbing AI signal words…",
      `→ Replaced 7 AI phrases`,
      `→ Injecting typos @ ${typoRate}% rate…`,
      "→ Applying burstiness variation…",
      "✓ Noise injection done",
      "→ Rebuilding .docx structure…",
      "→ Verifying format integrity…",
      "✓ All tables intact",
      "✓ All images intact",
      "✓ Font styles preserved",
      "✓ Document saved",
    ];

    let logIdx = 0;
    let si = 0;

    const interval = setInterval(() => {
      si++;
      const progressPct = Math.min(100, si * 2.5);
      setProgress(progressPct);

      const stageI = STAGES.findIndex(s => progressPct < s.pct);
      setStageIdx(stageI === -1 ? STAGES.length - 1 : stageI);

      if (logIdx < fakeLogs.length && si % 3 === 0) {
        const line = fakeLogs[logIdx++];
        setLogs(prev => [...prev, line]);
      }

      if (si >= 42) {
        clearInterval(interval);
        setProgress(100);
        setStageIdx(STAGES.length - 1);
        setLogs(prev => [...prev, "✓ Humanization complete!"]);
        setStats({ rewritten: 24, typos: 3, replacements: 7 });
        setPhase("done");
      }
    }, 120);
  };

  const reset = () => {
    setFile(null); setPhase("idle"); setProgress(0);
    setLogs([]); setStats(null); setStageIdx(0);
  };

  const checkOllama = () => {
    setOllamaStatus("checking");
    setTimeout(() => setOllamaStatus("connected"), 1200);
  };

  const stage = STAGES[stageIdx];

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a0a",
      color: "#e8e3d9",
      fontFamily: "'DM Mono', monospace",
      display: "flex",
      gap: 0,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Mono:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #111; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
        input[type=range] {
          -webkit-appearance: none; appearance: none;
          height: 3px; background: #2a2a2a; border-radius: 2px; outline: none; cursor: pointer;
        }
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none; width: 14px; height: 14px;
          background: #c9a96e; border-radius: 50%;
        }
        select {
          background: #141414; color: #e8e3d9; border: 1px solid #2a2a2a;
          border-radius: 6px; padding: 6px 10px; font-family: inherit;
          font-size: 0.8rem; outline: none; cursor: pointer; width: 100%;
        }
        select:focus { border-color: #c9a96e; }
        .btn-gold {
          background: #c9a96e; color: #0a0a0a;
          border: none; border-radius: 8px; padding: 12px 24px;
          font-family: 'DM Mono', monospace; font-size: 0.9rem; font-weight: 500;
          cursor: pointer; letter-spacing: 0.04em; transition: all 0.2s;
          width: 100%;
        }
        .btn-gold:hover { background: #e0be82; transform: translateY(-1px); }
        .btn-gold:disabled { background: #3a3a3a; color: #666; cursor: default; transform: none; }
        .btn-ghost {
          background: transparent; color: #c9a96e;
          border: 1px solid #3a3a3a; border-radius: 8px; padding: 8px 16px;
          font-family: 'DM Mono', monospace; font-size: 0.75rem;
          cursor: pointer; transition: all 0.2s;
        }
        .btn-ghost:hover { border-color: #c9a96e; }
        .btn-green {
          background: #1a2e1a; color: #7ecb7e;
          border: 1px solid #3a5c3a; border-radius: 8px; padding: 12px 24px;
          font-family: 'DM Mono', monospace; font-size: 0.9rem;
          cursor: pointer; width: 100%; transition: background 0.2s;
          letter-spacing: 0.03em;
        }
        .btn-green:hover { background: #223322; }
      `}</style>

      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <div style={{
        width: 240, minWidth: 240, background: "#0d0d0d",
        borderRight: "1px solid #1a1a1a", padding: "28px 20px",
        display: "flex", flexDirection: "column", gap: 28,
      }}>
        <div>
          <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.4rem", color: "#e8e3d9" }}>
            ✍️ DocHuman
          </div>
          <div style={{ fontSize: "0.65rem", color: "#555", marginTop: 4 }}>
            local ai · zero leaks
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <div style={{ fontSize: "0.65rem", color: "#666", marginBottom: 8, letterSpacing: "0.08em" }}>
              OLLAMA MODEL
            </div>
            <select value={model} onChange={e => setModel(e.target.value)}>
              {AI_MODELS.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>

          <div>
            <div style={{ fontSize: "0.65rem", color: "#666", marginBottom: 8, letterSpacing: "0.08em" }}>
              TYPO RATE — {typoRate}%
            </div>
            <input type="range" min={0} max={5} value={typoRate}
              onChange={e => setTypoRate(+e.target.value)} />
          </div>

          <div>
            <div style={{ fontSize: "0.65rem", color: "#666", marginBottom: 8, letterSpacing: "0.08em" }}>
              BURSTINESS
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {["Low","Medium","High"].map(b => (
                <button key={b} onClick={() => setBurstiness(b)} style={{
                  flex: 1, padding: "6px 0", fontSize: "0.65rem",
                  fontFamily: "inherit", cursor: "pointer",
                  background: burstiness === b ? "#c9a96e" : "#141414",
                  color: burstiness === b ? "#0a0a0a" : "#666",
                  border: "1px solid", borderColor: burstiness === b ? "#c9a96e" : "#2a2a2a",
                  borderRadius: 6, transition: "all 0.15s",
                }}>{b}</button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div style={{ fontSize: "0.65rem", color: "#666", marginBottom: 8, letterSpacing: "0.08em" }}>
            OLLAMA STATUS
          </div>
          <button className="btn-ghost" onClick={checkOllama} style={{ width: "100%" }}>
            {ollamaStatus === "checking" ? "Checking…" :
             ollamaStatus === "connected" ? "✓ Connected" : "Check connection"}
          </button>
          {ollamaStatus === "connected" && (
            <div style={{ fontSize: "0.65rem", color: "#7ecb7e", marginTop: 6 }}>
              llama3:8b, phi3:mini found
            </div>
          )}
        </div>

        <div style={{ marginTop: "auto", fontSize: "0.6rem", color: "#333", lineHeight: 1.8 }}>
          <div>python-docx ✓</div>
          <div>nltk ✓</div>
          <div>streamlit ✓</div>
          <div>requests ✓</div>
        </div>
      </div>

      {/* ── Main area ────────────────────────────────────────────────── */}
      <div style={{ flex: 1, padding: "40px 48px", display: "flex", flexDirection: "column", gap: 28, overflowY: "auto" }}>

        {/* Header */}
        <div>
          <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "2rem", fontWeight: 400, lineHeight: 1.2 }}>
            Humanize your document
          </h1>
          <p style={{ fontSize: "0.75rem", color: "#555", marginTop: 6 }}>
            Tables · images · fonts — untouched. Only paragraph text is rewritten.
          </p>
        </div>

        {/* Upload zone */}
        {phase === "idle" && (
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => !file && fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? "#c9a96e" : file ? "#3a5c3a" : "#2a2a2a"}`,
              borderRadius: 14, padding: "40px 32px",
              background: dragging ? "#1a1500" : file ? "#0e1a0e" : "#0e0e0e",
              textAlign: "center", cursor: file ? "default" : "pointer",
              transition: "all 0.2s",
            }}
          >
            <input ref={fileRef} type="file" accept=".docx" style={{ display: "none" }}
              onChange={e => setFile(e.target.files[0])} />

            {file ? (
              <div>
                <div style={{ fontSize: "2rem", marginBottom: 10 }}>📄</div>
                <div style={{ color: "#7ecb7e", fontWeight: 500 }}>{file.name}</div>
                <div style={{ fontSize: "0.7rem", color: "#555", marginTop: 4 }}>
                  {(file.size / 1024).toFixed(1)} KB — ready to process
                </div>
                <button className="btn-ghost" onClick={e => { e.stopPropagation(); reset(); }}
                  style={{ marginTop: 14 }}>Remove</button>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: "2.5rem", marginBottom: 12, opacity: 0.4 }}>⬆</div>
                <div style={{ color: "#666", fontSize: "0.85rem" }}>
                  Drop your <span style={{ color: "#c9a96e" }}>.docx</span> here
                </div>
                <div style={{ fontSize: "0.7rem", color: "#444", marginTop: 6 }}>
                  or click to browse
                </div>
              </div>
            )}
          </div>
        )}

        {/* Document preview when file selected */}
        {phase === "idle" && file && (
          <div style={{
            background: "#0e0e0e", border: "1px solid #1e1e1e",
            borderRadius: 10, padding: "18px 22px",
          }}>
            <div style={{ fontSize: "0.65rem", color: "#555", letterSpacing: "0.08em", marginBottom: 12 }}>
              DOCUMENT PREVIEW
            </div>
            <div style={{ display: "flex", gap: 16 }}>
              {[["~24", "Paragraphs"], ["~3", "Tables (preserved)"], ["~2", "Images (preserved)"]].map(([n, l]) => (
                <div key={l} style={{ flex: 1, background: "#141414", borderRadius: 8, padding: "12px 14px", border: "1px solid #1e1e1e" }}>
                  <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.4rem", color: "#c9a96e" }}>{n}</div>
                  <div style={{ fontSize: "0.65rem", color: "#555", marginTop: 2 }}>{l}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14, fontSize: "0.7rem", color: "#555" }}>
              Est. processing time: ~2–4 min with llama3:8b on CPU
            </div>
          </div>
        )}

        {/* Processing view */}
        {(phase === "processing" || phase === "done") && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Progress bar */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: "0.75rem", color: "#c9a96e" }}>
                  {phase === "done" ? "✅ Complete" : stage?.label}
                </span>
                <span style={{ fontSize: "0.75rem", color: "#555" }}>{Math.round(progress)}%</span>
              </div>
              <div style={{ height: 6, background: "#1a1a1a", borderRadius: 3, overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${progress}%`,
                  background: "linear-gradient(90deg, #c9a96e, #e0be82)",
                  borderRadius: 3, transition: "width 0.3s ease",
                }} />
              </div>
              {/* Stage indicators */}
              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                {STAGES.slice(0, -1).map((s, i) => (
                  <div key={s.id} style={{
                    flex: 1, height: 3, borderRadius: 2,
                    background: i < stageIdx ? "#c9a96e" : "#1e1e1e",
                    transition: "background 0.3s",
                  }} />
                ))}
              </div>
            </div>

            {/* Log window */}
            <div ref={logsRef} style={{
              background: "#060606", border: "1px solid #1a1a1a",
              borderRadius: 10, padding: "16px 18px",
              maxHeight: 200, overflowY: "auto",
              fontFamily: "'DM Mono', monospace",
            }}>
              <div style={{ fontSize: "0.6rem", color: "#333", marginBottom: 10, letterSpacing: "0.1em" }}>
                PIPELINE LOG
              </div>
              {logs.map((l, i) => (
                <LogLine key={i} text={l} delay={0} />
              ))}
              {phase === "processing" && (
                <div style={{ color: "#444", fontSize: "0.72rem", animation: "pulse 1.2s infinite" }}>
                  ▊
                </div>
              )}
            </div>
          </div>
        )}

        {/* Stats + download */}
        {phase === "done" && stats && (
          <div>
            <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
              {[
                ["Paragraphs rewritten", stats.rewritten, "#c9a96e"],
                ["AI words replaced",    stats.replacements, "#a896e8"],
                ["Typos injected",       stats.typos, "#7ecb7e"],
              ].map(([label, val, col]) => (
                <div key={label} style={{
                  flex: 1, background: "#0e0e0e", border: "1px solid #1e1e1e",
                  borderRadius: 10, padding: "14px 16px",
                }}>
                  <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.6rem", color: col }}>{val}</div>
                  <div style={{ fontSize: "0.65rem", color: "#555", marginTop: 3 }}>{label}</div>
                </div>
              ))}
            </div>
            <button className="btn-green">
              ⬇ Download {file?.name.replace(".docx", "_Humanized.docx")}
            </button>
            <button className="btn-ghost" onClick={reset} style={{ marginTop: 10, width: "100%" }}>
              ← Process another document
            </button>
          </div>
        )}

        {/* Humanize button */}
        {phase === "idle" && (
          <button className="btn-gold" onClick={simulateProcess} disabled={!file}>
            {file ? "🚀 Humanize Document" : "Upload a .docx to begin"}
          </button>
        )}

        {/* Info cards */}
        {phase === "idle" && (
          <div style={{ display: "flex", gap: 12 }}>
            {[
              ["🔒", "Local only", "Nothing leaves your machine"],
              ["🖼", "Format safe", "Tables & images untouched"],
              ["⚡", "3-pass engine", "LLM + regex + noise"],
            ].map(([icon, title, desc]) => (
              <div key={title} style={{
                flex: 1, background: "#0e0e0e", border: "1px solid #1a1a1a",
                borderRadius: 10, padding: "14px 16px",
              }}>
                <div style={{ fontSize: "1.2rem", marginBottom: 6 }}>{icon}</div>
                <div style={{ fontSize: "0.75rem", color: "#c9a96e", marginBottom: 3 }}>{title}</div>
                <div style={{ fontSize: "0.65rem", color: "#555" }}>{desc}</div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: "auto", fontSize: "0.6rem", color: "#2a2a2a", textAlign: "center", paddingTop: 16 }}>
          DocHuman · python-docx + Ollama + NLTK · MIT license
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0; } }
      `}</style>
    </div>
  );
}
