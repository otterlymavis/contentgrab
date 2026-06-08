from __future__ import annotations

import tomllib
from pathlib import Path

from .models import Source


def load_config(path: str | Path) -> tuple[str, list[Source]]:
    data = tomllib.loads(Path(path).read_text(encoding="utf-8"))
    default_query = str(data.get("default_query", "")).strip()
    sources = []

    for raw in data.get("sources", []):
        sources.append(
            Source(
                name=str(raw["name"]),
                kind=str(raw["kind"]),
                url=raw.get("url"),
                url_template=raw.get("url_template"),
                link_patterns=tuple(raw.get("link_patterns", [])),
                tags=tuple(raw.get("tags", [])),
                enabled=bool(raw.get("enabled", True)),
                priority=int(raw.get("priority", 0)),
                require_media=bool(raw.get("require_media", False)),
                summary=str(raw.get("summary", "")),
            )
        )

    return default_query, sources
