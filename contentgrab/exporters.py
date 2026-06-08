from __future__ import annotations

import json
from dataclasses import asdict
from pathlib import Path

from .models import Lead


def write_json(leads: list[Lead], path: str | Path) -> None:
    payload = [asdict(lead) for lead in leads]
    Path(path).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def read_json(path: str | Path) -> list[Lead]:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    return [
        Lead(
            title=str(item["title"]),
            url=str(item["url"]),
            source=str(item["source"]),
            score=int(item["score"]),
            tags=tuple(item.get("tags", [])),
            summary=str(item.get("summary", "")),
            media_urls=tuple(item.get("media_urls", [])),
            preview_title=str(item.get("preview_title", "")),
            preview_description=str(item.get("preview_description", "")),
            status=str(item.get("status", "ok")),
            collected_at=str(item.get("collected_at", "")),
        )
        for item in payload
    ]


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
                f"- Status: {lead.status}",
                f"- Tags: {tags}",
                f"- URL: {lead.url}",
            ]
        )
        if lead.summary:
            lines.append(f"- Note: {lead.summary}")
        if lead.preview_title:
            lines.append(f"- Preview: {lead.preview_title}")
        if lead.preview_description:
            lines.append(f"- Preview detail: {lead.preview_description}")
        if lead.media_urls:
            lines.append("- Media links:")
            lines.extend(f"  - {media_url}" for media_url in lead.media_urls)
        lines.append("")

    Path(path).write_text("\n".join(lines), encoding="utf-8")
