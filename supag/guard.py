"""Hard guardrails. Each one fails closed: when in doubt, SUPAG stops and says why."""
from __future__ import annotations

import fnmatch
import os
import subprocess

from .config import ROOT, SUPAG, WRITABLE_GLOBS


class GuardError(RuntimeError):
    """Raised when a guardrail blocks the run. The message goes into the run report."""


def kill_switch() -> str | None:
    """Return a reason to stop, or None. Two ways to pause SUPAG without touching code:
    set the repository variable SUPAG_ENABLED=false, or commit a file named supag/PAUSE."""
    if os.environ.get("SUPAG_ENABLED", "true").strip().lower() in ("false", "0", "no", "off"):
        return "Paused: repository variable SUPAG_ENABLED is false."
    if (SUPAG / "PAUSE").exists():
        return "Paused: supag/PAUSE exists. Delete it to resume."
    return None


def changed_paths() -> list[str]:
    out = subprocess.run(["git", "status", "--porcelain", "--untracked-files=all"],
                         cwd=ROOT, capture_output=True, text=True, check=True).stdout
    paths = []
    for line in out.splitlines():
        p = line[3:].strip()
        if " -> " in p:                                  # renames: check both sides
            paths.extend(x.strip() for x in p.split(" -> "))
        else:
            paths.append(p)
    return [p.strip('"') for p in paths if p and "__pycache__" not in p and not p.endswith(".pyc")]


def check_write_scope(paths: list[str] | None = None) -> None:
    """Abort if anything outside the writable set changed. SUPAG never edits code, workflows or the HTML."""
    paths = changed_paths() if paths is None else paths
    bad = [p for p in paths if not any(fnmatch.fnmatch(p, g) for g in WRITABLE_GLOBS)]
    if bad:
        raise GuardError("Write-scope guard: refusing to publish changes outside dashboard/data/ and "
                         "supag/runs/: " + ", ".join(sorted(bad)))


class Budget:
    """Per-run ceilings on fetches and model calls, so a loop or a hostile page can't run up cost."""

    def __init__(self, fetches: int, llm_calls: int):
        self.fetches_left, self.llm_left = fetches, llm_calls
        self.fetches_used = self.llm_used = 0

    def take_fetch(self) -> None:
        if self.fetches_left <= 0:
            raise GuardError("Budget guard: fetch limit for this run reached.")
        self.fetches_left -= 1; self.fetches_used += 1

    def take_llm(self) -> None:
        if self.llm_left <= 0:
            raise GuardError("Budget guard: model-call limit for this run reached.")
        self.llm_left -= 1; self.llm_used += 1
