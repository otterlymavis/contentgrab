from __future__ import annotations

import re
from urllib.parse import parse_qs, quote_plus, urlencode, urlparse

from .html_collect import LinkParser, collect_html_source, fetch_html
from .models import Lead, Source
from .scoring import score_text


def collect_sources(sources: list[Source], query: str = "", limit_per_source: int = 15) -> list[Lead]:
    leads: list[Lead] = []

    for source in sources:
        if not source.enabled:
            continue
        if source.kind == "html":
            leads.extend(collect_html_source(source, limit_per_source))
        elif source.kind == "search_url":
            leads.append(_search_url_lead(source, query))
        elif source.kind == "manual_url":
            leads.append(_manual_url_lead(source))
        elif source.kind == "x_trends_media":
            leads.extend(_x_trends_media_leads(source, limit_per_source))
        elif source.kind == "youtube_trends":
            leads.extend(_youtube_trends_leads(source, limit_per_source))
        else:
            raise ValueError(f"Unsupported source kind: {source.kind}")

    return sorted(leads, key=lambda lead: (_status_rank(lead.status), lead.score, len(lead.media_urls)), reverse=True)


def _search_url_lead(source: Source, query: str) -> Lead:
    if not source.url_template:
        raise ValueError(f"{source.name} is missing url_template")
    url = source.url_template.format(query=quote_plus(query))
    title = source.name if not query else f"{source.name}: {query}"
    return Lead(
        title=title,
        url=url,
        source=source.name,
        score=score_text(query) + source.priority,
        tags=source.tags,
        summary=source.summary or "Open this source manually; direct scraping may require auth or violate platform rules.",
        status="manual",
    )


def _manual_url_lead(source: Source) -> Lead:
    if not source.url:
        raise ValueError(f"{source.name} is missing url")
    return Lead(
        title=source.name,
        url=source.url,
        source=source.name,
        score=source.priority,
        tags=source.tags,
        summary=source.summary or "Open this source manually to review trending media posts.",
        status="manual",
    )


def _x_trends_media_leads(source: Source, limit: int) -> list[Lead]:
    if not source.url:
        raise ValueError(f"{source.name} is missing url")
    try:
        parser = LinkParser(source.url)
        parser.feed(fetch_html(source.url))
    except Exception as exc:
        return [
            Lead(
                title=f"{source.name} fetch failed",
                url=source.url,
                source=source.name,
                score=source.priority,
                tags=source.tags,
                summary=f"{type(exc).__name__}: {exc}",
                status="error",
            )
        ]

    leads: list[Lead] = []
    seen_terms: set[str] = set()
    for title, url in parser.links:
        if len(leads) >= limit:
            break
        term = _twitter_search_term(title, url)
        if not term or term in seen_terms:
            continue
        seen_terms.add(term)
        rank_score = max(limit - len(leads), 0)
        leads.append(
            Lead(
                title=f"Trending media on X: {term}",
                url=_x_media_search_url(term),
                source=source.name,
                score=source.priority + rank_score,
                tags=_merge_tags(source.tags, ("trend", "media-search")),
                summary=source.summary
                or "Current Japan X trend. Opens X search filtered to posts that contain media.",
                preview_title=term,
                preview_description="X media search for a currently trending Japan term.",
                status="media-search",
            )
        )
    return leads


def _twitter_search_term(title: str, url: str) -> str:
    parsed = urlparse(url)
    if parsed.netloc not in {"twitter.com", "x.com"} or parsed.path != "/search":
        return ""
    query = parse_qs(parsed.query).get("q", [""])[0].strip()
    return query or title.strip()


def _x_media_search_url(term: str) -> str:
    query = urlencode({"q": f"{term} filter:media", "src": "typed_query", "f": "live"})
    return f"https://twitter.com/search?{query}"


def _youtube_trends_leads(source: Source, limit: int) -> list[Lead]:
    if not source.url:
        raise ValueError(f"{source.name} is missing url")
    try:
        parser = LinkParser(source.url)
        html = fetch_html(source.url)
        parser.feed(html)
    except Exception as exc:
        return [
            Lead(
                title=f"{source.name} fetch failed",
                url=source.url,
                source=source.name,
                score=source.priority,
                tags=source.tags,
                summary=f"{type(exc).__name__}: {exc}",
                status="error",
            )
        ]

    candidates = parser.links + [
        (match.group(0), match.group(0))
        for match in re.finditer(r"https?://(?:www\.)?(?:youtube\.com/watch\?v=|youtu\.be/)[\w-]+", html)
    ]
    leads: list[Lead] = []
    seen_ids: set[str] = set()
    for title, url in candidates:
        if len(leads) >= limit:
            break
        video_id = _youtube_video_id(url)
        if not video_id or video_id in seen_ids:
            continue
        seen_ids.add(video_id)
        clean_title = (title or f"YouTube video {video_id}").strip()
        watch_url = f"https://www.youtube.com/watch?v={video_id}"
        thumbnail_url = f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"
        rank_score = max(limit - len(leads), 0)
        leads.append(
            Lead(
                title=f"YouTube trending: {clean_title[:140]}",
                url=watch_url,
                source=source.name,
                score=source.priority + rank_score + 5,
                tags=_merge_tags(source.tags, ("video", "preview")),
                summary=source.summary or "Trending YouTube video with thumbnail preview.",
                media_urls=(thumbnail_url,),
                preview_title=clean_title[:180],
                preview_description="Trending YouTube video thumbnail preview.",
                status="ok",
            )
        )
    if leads:
        return leads
    return [
        Lead(
            title=f"{source.name} found no video links",
            url=source.url,
            source=source.name,
            score=source.priority,
            tags=source.tags,
            summary="The source loaded but no YouTube video links were detected.",
            status="error",
        )
    ]


def _youtube_video_id(url: str) -> str:
    parsed = urlparse(url)
    if parsed.netloc.endswith("youtube.com") and parsed.path == "/watch":
        return parse_qs(parsed.query).get("v", [""])[0]
    if parsed.netloc.endswith("youtu.be"):
        return parsed.path.strip("/").split("/")[0]
    return ""


def _merge_tags(*groups: tuple[str, ...]) -> tuple[str, ...]:
    merged: list[str] = []
    for group in groups:
        for tag in group:
            if tag not in merged:
                merged.append(tag)
    return tuple(merged)


def _status_rank(status: str) -> int:
    if status == "media-search":
        return 3
    if status == "ok":
        return 2
    if status == "manual":
        return 1
    return 0
