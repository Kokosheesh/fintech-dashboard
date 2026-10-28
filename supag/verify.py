"""Anti-hallucination checks. A number reaches the dashboard only if the model can point to the exact
sentence it came from, that sentence really is in the page we fetched, and the number really is in it."""
from __future__ import annotations

import re
import unicodedata

_DASHES = dict.fromkeys(map(ord, "‐‑‒–—−"), "-")
_QUOTES = dict.fromkeys(map(ord, "‘’‚‛"), "'") | dict.fromkeys(map(ord, "“”„"), '"')


def norm(text: str) -> str:
    """Normalise for comparison: unicode form, dashes, quotes, rupee spellings, whitespace, case."""
    t = unicodedata.normalize("NFKC", text or "").translate(_DASHES).translate(_QUOTES)
    t = re.sub(r"\bRs\.?\s*", "₹", t, flags=re.I)
    t = re.sub(r"\bINR\s*", "₹", t)
    t = re.sub(r"\s+", " ", t)
    return t.strip().lower()


def _digits(s: str) -> str:
    return re.sub(r"(?<=\d),(?=\d)", "", s)          # 32,490 -> 32490


def quote_in_document(quote: str, document: str) -> bool:
    q, d = norm(quote), norm(document)
    if len(q) < 12:                                   # too short to prove anything
        return False
    if q in d:
        return True
    # tolerate the model dropping commas inside numbers, nothing else
    return _digits(q) in _digits(d)


def number_in_quote(value: float | int | str, quote: str) -> bool:
    """The reported number must be printed in the quote (commas ignored, trailing zeros tolerated)."""
    try:
        v = float(str(value).replace(",", ""))
    except ValueError:
        return False
    for tok in re.findall(r"\d+(?:\.\d+)?", _digits(norm(quote))):
        if abs(float(tok) - v) < 1e-9:
            return True
    return False


def numbers_grounded(text: str, document: str) -> list[str]:
    """Return numbers in model-written text (a news gist) that do not appear anywhere in the source."""
    doc = _digits(norm(document))
    missing = []
    for tok in re.findall(r"\d+(?:\.\d+)?", _digits(norm(text))):
        if not re.search(r"(?<![\d.])" + re.escape(tok) + r"(?![\d])", doc):
            missing.append(tok)
    return missing


def verify_figure(value, quote: str, url: str, documents: dict[str, str]) -> str | None:
    """Return None if the figure is grounded, else the reason it was rejected."""
    if url not in documents:
        return f"cited a page that was not fetched ({url})"
    if not quote_in_document(quote, documents[url]):
        return "quoted sentence not found in the cited page"
    if not number_in_quote(value, quote):
        return f"the value {value} does not appear in the quoted sentence"
    return None
