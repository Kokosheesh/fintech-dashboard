"""Paths, settings and the source allowlist. Everything SUPAG may touch is defined here."""
from __future__ import annotations

import json
import os
import pathlib
from urllib.parse import urlparse

ROOT = pathlib.Path(__file__).resolve().parents[1]          # repo root
SUPAG = ROOT / "supag"
DATA = ROOT / "dashboard" / "data"
RUNS = SUPAG / "runs"
SOURCES_FILE = SUPAG / "sources.json"
DASHBOARD_URL_LIVE = "https://fintech.pelicanx.in/fintech_dashboard.html"

# The only files a SUPAG run is allowed to change. Anything else in the diff aborts the run.
WRITABLE_GLOBS = ("dashboard/data/*.json", "supag/runs/*.json")

MODEL = os.environ.get("SUPAG_MODEL") or "claude-sonnet-5-5"     # empty repo variable → default


def load_sources() -> dict:
    return json.loads(SOURCES_FILE.read_text(encoding="utf-8"))


def allowlist() -> set[str]:
    return {h.lower() for h in load_sources()["allowlist"]}


def budgets() -> dict:
    return load_sources()["budgets"]


def host_allowed(url: str, allowed: set[str] | None = None) -> bool:
    """True only for https URLs whose host is on the allowlist (exact host match, no wildcards)."""
    allowed = allowed if allowed is not None else allowlist()
    p = urlparse(url)
    return p.scheme == "https" and (p.hostname or "").lower() in allowed


def read_json(name: str) -> dict:
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def write_json(name: str, obj: dict) -> None:
    (DATA / name).write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
