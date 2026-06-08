from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime


@dataclass(frozen=True)
class Source:
    name: str
    kind: str
    url: str | None = None
    url_template: str | None = None
    link_patterns: tuple[str, ...] = ()
    tags: tuple[str, ...] = ()
    enabled: bool = True
    priority: int = 0


@dataclass(frozen=True)
class Lead:
    title: str
    url: str
    source: str
    score: int
    tags: tuple[str, ...] = ()
    summary: str = ""
    media_urls: tuple[str, ...] = ()
    status: str = "ok"
    collected_at: str = field(default_factory=lambda: datetime.now(UTC).isoformat())
