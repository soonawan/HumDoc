"""
DocHuman - AI Document Humanizer
Streamlit frontend for the local DOCX humanizer pipeline.
"""

import streamlit as st
import io
import time
from humanizer import DocxHumanizer

# ── Page config ──────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="DocHuman – AI Humanizer",
    page_icon="✍️",
    layout="centered",
    initial_sidebar_state="collapsed",
)

# ── Inject custom CSS ─────────────────────────────────────────────────────────
st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Mono:wght@400;500&display=swap');

html, body, [class*="css"] {
    font-family: 'DM Mono', monospace;
    background: #0d0d0d;
    color: #e8e3d9;
}

h1, h2, h3 {
    font-family: 'DM Serif Display', serif;
}

.block-container { max-width: 780px; padding-top: 2rem; }

/* Upload zone */
[data-testid="stFileUploadDropzone"] {
    background: #141414 !important;
    border: 2px dashed #3a3a3a !important;
    border-radius: 12px !important;
    transition: border-color 0.3s;
}
[data-testid="stFileUploadDropzone"]:hover {
    border-color: #c9a96e !important;
}

/* Buttons */
.stButton > button {
    background: #c9a96e;
    color: #0d0d0d;
    font-family: 'DM Mono', monospace;
    font-weight: 500;
    border: none;
    border-radius: 8px;
    padding: 0.6rem 2rem;
    width: 100%;
    font-size: 1rem;
    letter-spacing: 0.04em;
    transition: background 0.2s, transform 0.1s;
}
.stButton > button:hover {
    background: #e0be82;
    transform: translateY(-1px);
}

/* Download button */
[data-testid="stDownloadButton"] > button {
    background: #1a2e1a;
    color: #7ecb7e;
    border: 1px solid #3a5c3a;
    font-family: 'DM Mono', monospace;
    border-radius: 8px;
    width: 100%;
    font-size: 1rem;
    transition: background 0.2s;
}
[data-testid="stDownloadButton"] > button:hover {
    background: #223322;
}

/* Progress bar */
[data-testid="stProgressBar"] > div > div {
    background: linear-gradient(90deg, #c9a96e, #e0be82);
    border-radius: 4px;
}

/* Sidebar */
[data-testid="stSidebar"] {
    background: #111 !important;
}

/* Expander */
[data-testid="stExpander"] {
    background: #141414;
    border: 1px solid #2a2a2a;
    border-radius: 10px;
}

/* Selectbox / slider */
[data-testid="stSelectbox"], [data-testid="stSlider"] {
    color: #e8e3d9;
}

/* Info / success boxes */
.stAlert {
    background: #141414 !important;
    border-radius: 8px !important;
}

/* Metric */
[data-testid="stMetric"] {
    background: #141414;
    border-radius: 10px;
    padding: 0.8rem 1.2rem;
    border: 1px solid #2a2a2a;
}
</style>
""", unsafe_allow_html=True)

# ── Header ────────────────────────────────────────────────────────────────────
st.markdown("## ✍️ DocHuman")
st.markdown("*Local AI pipeline — zero API costs, zero data leaks.*")
st.divider()

# ── Sidebar: settings ─────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown("### ⚙️ Settings")
    model = st.selectbox(
        "Ollama model",
        ["llama3:8b", "phi3:mini", "mistral:7b", "gemma:7b"],
        index=0,
    )
    typo_rate = st.slider("Typo injection rate (%)", 0, 5, 1)
    burstiness = st.select_slider(
        "Sentence burstiness",
        options=["Low", "Medium", "High"],
        value="High",
    )
    st.divider()
    st.markdown("**Ollama status**")
    if st.button("Check connection"):
        import requests
        try:
            r = requests.get("http://localhost:11434/api/tags", timeout=2)
            if r.status_code == 200:
                models = [m["name"] for m in r.json().get("models", [])]
                st.success(f"Connected ✓\n\nModels: {', '.join(models) or 'none pulled yet'}")
            else:
                st.error("Ollama responded but returned an error.")
        except Exception:
            st.error("Cannot reach Ollama at localhost:11434.\n\nRun: `ollama serve`")

# ── File upload ───────────────────────────────────────────────────────────────
uploaded = st.file_uploader(
    "Drop your .docx file here",
    type=["docx"],
    help="Only the paragraph text is modified. Tables, images, and formatting are preserved.",
)

if uploaded:
    file_bytes = uploaded.read()
    fname = uploaded.name.replace(".docx", "")

    st.success(f"📄 **{uploaded.name}** loaded ({len(file_bytes)/1024:.1f} KB)")

    # Preview paragraph count
    with st.expander("📊 Document preview"):
        from docx import Document
        doc_preview = Document(io.BytesIO(file_bytes))
        paras = [p.text for p in doc_preview.paragraphs if p.text.strip()]
        st.metric("Paragraphs to process", len(paras))
        st.metric("Estimated time", f"{len(paras) * 3}–{len(paras) * 6}s")
        with st.container():
            st.markdown("**First 3 paragraphs:**")
            for p in paras[:3]:
                st.markdown(f"> {p[:200]}{'…' if len(p) > 200 else ''}")

    st.divider()

    # ── Humanize button ───────────────────────────────────────────────────────
    if st.button("🚀 Humanize Document"):
        progress = st.progress(0, text="Initialising pipeline…")
        status   = st.empty()
        log_box  = st.empty()
        logs     = []

        def update(msg, pct):
            logs.append(msg)
            status.markdown(f"**{msg}**")
            progress.progress(pct, text=msg)
            log_box.code("\n".join(logs[-8:]), language=None)

        try:
            humanizer = DocxHumanizer(
                model=model,
                typo_rate=typo_rate / 100,
                burstiness=burstiness.lower(),
            )

            update("Extracting paragraphs…", 5)
            time.sleep(0.3)

            result_bytes, stats = humanizer.humanize(
                file_bytes,
                progress_callback=update,
            )

            progress.progress(100, text="✅ Complete!")
            status.empty()
            log_box.empty()

            st.balloons()
            st.success("✅ Humanization complete!")

            col1, col2, col3 = st.columns(3)
            col1.metric("Paragraphs rewritten", stats["rewritten"])
            col2.metric("Typos injected",        stats["typos"])
            col3.metric("AI words replaced",     stats["replacements"])

            st.divider()
            out_name = f"{fname}_Humanized.docx"
            st.download_button(
                label=f"⬇️ Download {out_name}",
                data=result_bytes,
                file_name=out_name,
                mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            )

        except ConnectionError as e:
            st.error(f"❌ Ollama not reachable: {e}\n\nMake sure `ollama serve` is running.")
        except Exception as e:
            st.error(f"❌ Error: {e}")
            st.exception(e)

else:
    st.info("👆 Upload a .docx file to get started.")

# ── Footer ────────────────────────────────────────────────────────────────────
st.divider()
st.markdown(
    "<div style='text-align:center;opacity:0.4;font-size:0.75rem'>"
    "100% local · no API keys · no data leaves your machine"
    "</div>",
    unsafe_allow_html=True,
)
