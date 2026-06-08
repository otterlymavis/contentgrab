from __future__ import annotations

from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

from .models import Lead, Source
from .scoring import score_text

MEDIA_EXTENSIONS = (".jpg", ".jpeg", ".png", ".gif", ".webp", ".mp4", ".mov", ".m3u8")


class LinkParser(HTMLParser):
    def __init__(self, base_url: str) -> None:
        super().__init__()
        self.base_url = base_url
        self._active_href: str | None = None
        self._active_text: list[str] = []
        self.links: list[tuple[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag != "a":
            return
        attr_map = dict(attrs)
        href = attr_map.get("href")
        if href:
            self._active_href = urljoin(self.base_url, href)
            self._active_text = []

    def handle_data(self, data: str) -> None:
        if self._active_href:
            self._active_text.append(data.strip())

    def handle_endtag(self, tag: str) -> None:
        if tag != "a" or not self._active_href:
            return
        title = " ".join(part for part in self._active_text if part).strip()
        self.links.append((title, self._active_href))
        self._active_href = None
        self._active_text = []


def fetch_html(url: str, timeout: int = 20) -> str:
    request = Request(
        url,
        headers={
            "User-Agent": "contentgrab/0.1 (+https://github.com/) creator research tool",
            "Accept-Language": "ja,en-US;q=0.8,en;q=0.5",
        },
    )
    with urlopen(request, timeout=timeout) as response:
        charset = response.headers.get_content_charset() or "utf-8"
        return response.read().decode(charset, errors="replace")


def collect_html_source(source: Source, limit: int) -> list[Lead]:
    if not source.url:
        return []

    parser = LinkParser(source.url)
    parser.feed(fetch_html(source.url))
    leads: list[Lead] = []
    seen: set[str] = set()

    for title, url in parser.links:
        if len(leads) >= limit:
            break
        if not _is_candidate(url, source.link_patterns) or url in seen:
            continue
        seen.add(url)
        display_title = title or urlparse(url).path.strip("/") or url
        media_urls = tuple(link for _, link in parser.links if _is_media_url(link))
        leads.append(
            Lead(
                title=display_title[:180],
                url=url,
                source=source.name,
                score=score_text(display_title + " " + url),
                tags=source.tags,
                media_urls=media_urls[:5],
            )
        )

    return leads


def _is_candidate(url: str, patterns: tuple[str, ...]) -> bool:
    if url.startswith(("mailto:", "javascript:")):
        return False
    return not patterns or any(pattern in url for pattern in patterns)


def _is_media_url(url: str) -> bool:
    return urlparse(url).path.lower().endswith(MEDIA_EXTENSIONS)
