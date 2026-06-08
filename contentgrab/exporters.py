from __future__ import annotations

import json
from dataclasses import asdict
from pathlib import Path

from .models import Lead


def write_json(leads: list[Lead], path: str | Path) -> None:
    payload = [asdict(lead) for lead in leads]
    Path(path).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def write_markdown(leads: list[Lead], path: str | Path) -> None:
    lines = ["# Content Leads", ""]
    for index, lead in enumerate(leads, start=1):
        tags = ", ".join(lead.tags) if lead.tags else "untagged"
        lines.extend(
            [
                f"## {index}. {lead.title}",
                "",
                f"- Source: {lead.source}",
                f"- Score: {lead.score}",
                f"- Tags: {tags}",
                f"- URL: {lead.url}",
            ]
        )
        if lead.summary:
            lines.append(f"- Note: {lead.summary}")
        if lead.media_urls:
            lines.append("- Media links:")
            lines.extend(f"  - {media_url}" for media_url in lead.media_urls)
        lines.append("")

    Path(path).write_text("\n".join(lines), encoding="utf-8")
