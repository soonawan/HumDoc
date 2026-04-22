"""
humanizer.py  –  DocHuman core pipeline
Modules:
  1. Smart DOCX extraction   (python-docx)
  2. Semantic rewrite        (Ollama local LLM)
  3. Noise injection         (NLTK + regex + typos)
  4. Reassembly & export     (python-docx in-place edit)
"""

from __future__ import annotations

import io
import json
import random
import re
import string
import time
from typing import Callable

import requests
from docx import Document
from docx.oxml.ns import qn

# ── Optional NLP imports (graceful fallback) ──────────────────────────────────
try:
    import nltk
    # Download quietly on first run
    for pkg in ("punkt", "punkt_tab", "averaged_perceptron_tagger"):
        try:
            nltk.data.find(f"tokenizers/{pkg}")
        except LookupError:
            nltk.download(pkg, quiet=True)
    NLTK_OK = True
except ImportError:
    NLTK_OK = False


# ── Replacement dictionaries ──────────────────────────────────────────────────
AI_WORDS: dict[str, str] = {
    r"\bfurthermore\b":         "also",
    r"\bmoreover\b":            "on top of that",
    r"\badditionally\b":        "and",
    r"\bnevertheless\b":        "still",
    r"\bnotwithstanding\b":     "even so",
    r"\bsubsequently\b":        "then",
    r"\bconsequently\b":        "so",
    r"\bdelve\b":               "look into",
    r"\bdelves\b":              "looks into",
    r"\bdelved\b":              "looked into",
    r"\bdelving\b":             "looking into",
    r"\butilize\b":             "use",
    r"\butilizes\b":            "uses",
    r"\butilized\b":            "used",
    r"\butilization\b":         "use",
    r"\bin conclusion\b":       "to wrap up",
    r"\bin summary\b":          "in short",
    r"\bit is worth noting\b":  "note that",
    r"\bit is important to note\b": "importantly",
    r"\bfacilitate\b":          "help",
    r"\bleverage\b":            "use",
    r"\bsynergy\b":             "teamwork",
    r"\bparadigm\b":            "model",
    r"\boptimal\b":             "best",
    r"\bcomprehensive\b":       "thorough",
    r"\brobust\b":              "strong",
    r"\bseamless\b":            "smooth",
    r"\bstreamline\b":          "simplify",
    r"\bproactive\b":           "ahead of the curve",
    r"\binnovative\b":          "new",
    r"\bcutting[- ]edge\b":     "latest",
    r"\bstate[- ]of[- ]the[- ]art\b": "modern",
    r"\bpivot\b":               "shift",
    r"\bin light of\b":         "given",
    r"\bthat being said\b":     "that said",
    r"\bwith that being said\b":"with that said",
}

# Common character-swap typos that look plausible
TYPO_SWAPS: list[tuple[str, str]] = [
    ("the", "teh"),
    ("and", "adn"),
    ("that", "taht"),
    ("with", "wiht"),
    ("have", "hvae"),
    ("this", "tihs"),
    ("from", "form"),
    ("they", "tehy"),
    ("were", "wree"),
    ("your", "yuor"),
    ("would", "wuold"),
    ("about", "abotu"),
    ("which", "whcih"),
    ("their", "thier"),
    ("there", "tehre"),
]


# ── Burstiness helpers ────────────────────────────────────────────────────────
def _bust_sentence(sent: str, level: str) -> str:
    """Randomly split or merge a sentence for rhythm variation."""
    words = sent.split()
    if level == "high" and len(words) > 12 and random.random() < 0.35:
        mid = random.randint(len(words) // 3, 2 * len(words) // 3)
        part1 = " ".join(words[:mid]).rstrip(",;")
        part2 = " ".join(words[mid:])
        if part2:
            part2 = part2[0].upper() + part2[1:]
        return f"{part1}. {part2}"
    return sent


def _vary_opener(sent: str) -> str:
    """Occasionally start a sentence with a casual connector."""
    openers = ["Look, ", "Honestly, ", "In practice, ", "Truth is, ", "So, "]
    if random.random() < 0.08:
        return random.choice(openers) + sent[0].lower() + sent[1:]
    return sent


# ── Ollama prompt builder ─────────────────────────────────────────────────────
SYSTEM_PROMPT = """You are a rewriting assistant. Your ONLY job is to rephrase the given text so it sounds natural, conversational, and human-written. Strict rules:

1. Preserve ALL technical terms, numbers, citations, proper nouns, and acronyms exactly.
2. Vary sentence length aggressively — mix short punchy sentences with longer ones.
3. Never use: furthermore, moreover, additionally, notwithstanding, delve, utilize, leverage, synergy, paradigm, robust, seamless, cutting-edge, innovative.
4. Use contractions where natural (it's, don't, can't, isn't).
5. No bullet points, no numbered lists, no headers — plain prose only.
6. Output ONLY the rewritten paragraph. No preamble, no explanation."""


def _build_prompt(paragraph: str, burstiness: str) -> str:
    burst_note = {
        "low":    "Keep it fairly formal but natural.",
        "medium": "Mix sentence lengths moderately.",
        "high":   "Use very varied sentence lengths — some very short, some long.",
    }[burstiness]
    return f"{burst_note}\n\nRewrite this:\n\n{paragraph}"


# ── Main class ────────────────────────────────────────────────────────────────
class DocxHumanizer:
    OLLAMA_URL = "http://localhost:11434/api/generate"
    MIN_PARA_WORDS = 6   # skip very short headings / captions

    def __init__(
        self,
        model: str = "llama3:8b",
        typo_rate: float = 0.01,
        burstiness: str = "high",
        ollama_timeout: int = 120,
    ):
        self.model = model
        self.typo_rate = typo_rate
        self.burstiness = burstiness
        self.ollama_timeout = ollama_timeout

    # ── PUBLIC ─────────────────────────────────────────────────────────────────
    def humanize(
        self,
        docx_bytes: bytes,
        progress_callback: Callable[[str, int], None] | None = None,
    ) -> tuple[bytes, dict]:
        """
        Full pipeline: extract → rewrite → inject noise → reassemble.
        Returns (modified_docx_bytes, stats_dict).
        """
        def _progress(msg: str, pct: int):
            if progress_callback:
                progress_callback(msg, pct)

        _progress("Parsing document structure…", 8)
        doc = Document(io.BytesIO(docx_bytes))

        # Collect eligible paragraphs (skip blanks, headings-only, table cells)
        eligible: list[int] = []
        for i, para in enumerate(doc.paragraphs):
            txt = para.text.strip()
            if len(txt.split()) >= self.MIN_PARA_WORDS:
                eligible.append(i)

        total = len(eligible)
        if total == 0:
            raise ValueError("No suitable paragraphs found in the document.")

        _progress(f"Found {total} paragraphs. Starting rewrite…", 12)

        stats = {"rewritten": 0, "typos": 0, "replacements": 0}

        for step, idx in enumerate(eligible):
            para = doc.paragraphs[idx]
            original = para.text.strip()

            pct = 12 + int((step / total) * 80)
            _progress(
                f"Rewriting paragraph {step + 1}/{total}…",
                pct,
            )

            # Pass 1: LLM semantic rewrite
            rewritten = self._ollama_rewrite(original)

            # Pass 2: noise injection
            rewritten, rep_count = self._replace_ai_words(rewritten)
            rewritten, typo_count = self._inject_typos(rewritten)
            if NLTK_OK:
                rewritten = self._apply_burstiness(rewritten)

            stats["replacements"] += rep_count
            stats["typos"]        += typo_count
            stats["rewritten"]    += 1

            # Pass 3: inject back (preserve runs structure where possible)
            self._set_paragraph_text(para, rewritten)

        _progress("Assembling output file…", 95)
        out = io.BytesIO()
        doc.save(out)
        out.seek(0)

        _progress("Done!", 100)
        return out.read(), stats

    # ── PASS 1: Ollama rewrite ─────────────────────────────────────────────────
    def _ollama_rewrite(self, text: str) -> str:
        payload = {
            "model":  self.model,
            "prompt": _build_prompt(text, self.burstiness),
            "system": SYSTEM_PROMPT,
            "stream": False,
            "options": {
                "temperature": 0.85,
                "top_p": 0.92,
                "repeat_penalty": 1.15,
            },
        }
        try:
            resp = requests.post(
                self.OLLAMA_URL,
                json=payload,
                timeout=self.ollama_timeout,
            )
            resp.raise_for_status()
            data = resp.json()
            result = data.get("response", "").strip()
            return result if result else text
        except requests.exceptions.ConnectionError:
            raise ConnectionError(
                "Cannot reach Ollama. Is `ollama serve` running?"
            )
        except Exception:
            return text   # fallback: keep original

    # ── PASS 2a: AI word replacement ───────────────────────────────────────────
    def _replace_ai_words(self, text: str) -> tuple[str, int]:
        count = 0
        for pattern, replacement in AI_WORDS.items():
            new_text, n = re.subn(pattern, replacement, text, flags=re.IGNORECASE)
            if n:
                text = new_text
                count += n
        return text, count

    # ── PASS 2b: Typo injection ────────────────────────────────────────────────
    def _inject_typos(self, text: str) -> tuple[str, int]:
        if self.typo_rate == 0:
            return text, 0
        count = 0
        for correct, typo in TYPO_SWAPS:
            if random.random() < self.typo_rate:
                pattern = rf"\b{re.escape(correct)}\b"
                new_text, n = re.subn(pattern, typo, text, count=1)
                if n:
                    text = new_text
                    count += n
        return text, count

    # ── PASS 2c: Burstiness (NLTK sentence splitting) ─────────────────────────
    def _apply_burstiness(self, text: str) -> str:
        if not NLTK_OK:
            return text
        from nltk.tokenize import sent_tokenize
        sentences = sent_tokenize(text)
        processed = []
        for sent in sentences:
            sent = _bust_sentence(sent, self.burstiness)
            if random.random() < 0.05:
                sent = _vary_opener(sent)
            processed.append(sent)
        return " ".join(processed)

    # ── PASS 3: Reassemble paragraph ──────────────────────────────────────────
    @staticmethod
    def _set_paragraph_text(para, new_text: str):
        """
        Replace all run text in a paragraph while preserving run formatting.
        Strategy: put all text in the first run, clear the rest.
        """
        runs = para.runs
        if not runs:
            # No runs — use raw XML approach
            for child in list(para._p):
                tag = child.tag.split("}")[-1] if "}" in child.tag else child.tag
                if tag == "r":
                    para._p.remove(child)
            # Re-add a plain run
            from docx.oxml import OxmlElement
            r = OxmlElement("w:r")
            t = OxmlElement("w:t")
            t.text = new_text
            t.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
            r.append(t)
            para._p.append(r)
            return

        # Put all new text in the first run
        runs[0].text = new_text
        # Clear remaining runs
        for run in runs[1:]:
            run.text = ""
