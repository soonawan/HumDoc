# ✍️ DocHuman – Local AI Document Humanizer

> **100% free · 100% local · zero API keys · zero data leaves your machine**

---

## What it does

Drops your AI-written `.docx` through a 3-pass pipeline:
1. **Semantic rewrite** — local Llama 3 / Phi-3 via Ollama rewrites each paragraph with natural language and varied sentence rhythm  
2. **AI-word scrubbing** — regex removes "furthermore", "delve", "utilize", etc.  
3. **Noise injection** — optional low-rate typos make output indistinguishable from human writing

Tables, images, headers, fonts, and all formatting are **completely untouched**.

---

## Quick-start (5 minutes)

### 1. Install Ollama
```bash
# macOS / Linux
curl -fsSL https://ollama.com/install.sh | sh

# Windows: download from https://ollama.com/download
```

### 2. Pull a model (pick one)
```bash
ollama pull llama3:8b      # Best quality (~4.7 GB)
ollama pull phi3:mini      # Fastest, good quality (~2.3 GB)
ollama pull mistral:7b     # Alternative option (~4.1 GB)
```

### 3. Start Ollama server
```bash
ollama serve
# Leave this terminal open
```

### 4. Install Python dependencies
```bash
# In a new terminal, inside this folder:
pip install -r requirements.txt
```

### 5. Launch the app
```bash
streamlit run app.py
```

A browser tab opens at **http://localhost:8501** — drag in your `.docx` and click **Humanize**.

---

## Settings (sidebar)

| Setting | Description |
|---|---|
| **Ollama model** | Which local LLM to use for rewriting |
| **Typo injection rate** | 0% = none, 1% = subtle (recommended), 5% = heavy |
| **Sentence burstiness** | Controls how much sentence length varies |

---

## File structure

```
docx_humanizer/
├── app.py          ← Streamlit UI
├── humanizer.py    ← Core pipeline (extraction → LLM → noise → reassembly)
├── requirements.txt
└── README.md
```

---

## Troubleshooting

**"Cannot reach Ollama"**  
→ Make sure `ollama serve` is running in a separate terminal.

**"No suitable paragraphs found"**  
→ The document may be mostly tables/images. The tool only processes paragraph text.

**Rewrite sounds robotic**  
→ Try `llama3:8b` instead of `phi3:mini`, and set burstiness to **High**.

**Very slow**  
→ Normal for CPU-only. Expect ~3–8 seconds per paragraph. An Nvidia GPU with CUDA will be 10–20× faster.

---

## Privacy note

All processing happens locally. The document bytes never leave your computer.
