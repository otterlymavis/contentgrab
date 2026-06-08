from __future__ import annotations

from urllib.parse import quote_plus

from .html_collect import collect_html_source
from .models import Lead, Source
from .scoring import score_text


def collect_sources(sources: list[Source], query: str, limit_per_source: int) -> list[Lead]:
    leads: list[Lead] = []

    for source in sources:
        if not source.enabled:
            continue
        if source.kind == "html":
            leads.extend(collect_html_source(source, limit_per_source))
        elif source.kind == "search_url":
            leads.append(_search_url_lead(source, query))
        else:
            raise ValueError(f"Unsupported source kind: {source.kind}")

    return sorted(leads, key=lambda lead: (lead.score, lead.source, lead.title), reverse=True)


def _search_url_lead(source: Source, query: str) -> Lead:
    if not source.url_template:
        raise ValueError(f"{source.name} is missing url_template")
    url = source.url_template.format(query=quote_plus(query))
    title = f"{source.name}: {query}"
    return Lead(
        title=title,
        url=url,
        source=source.name,
        score=score_text(query) + source.priority,
        tags=source.tags,
        summary="Open this search URL manually; direct scraping may require auth or violate platform rules.",
    )
