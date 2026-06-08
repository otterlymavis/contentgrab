from __future__ import annotations

from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

from .models import Lead, Source
from .scoring import score_text

IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png", ".gif", ".webp")


class LinkParser(HTMLParser):
    def __init__(self, base_url: str) -> None:
        super().__init__()
        self.base_url = base_url
        self._active_href: str | None = None
        self._active_text: list[str] = []
        self.links: list[tuple[str, str]] = []
        self.link_media_urls: dict[str, list[str]] = {}
        self.media_urls: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr_map = dict(attrs)
        if tag in {"img", "source"}:
            src = attr_map.get("src") or attr_map.get("data-src") or attr_map.get("data-original")
            if not src and attr_map.get("srcset"):
                src = attr_map["srcset"].split(",")[0].strip().split(" ")[0]
            if src:
                media_url = urljoin(self.base_url, src)
                if _is_media_url(media_url):
                    if self._active_href:
                        self.link_media_urls.setdefault(self._active_href, []).append(media_url)
                    else:
                        self.media_urls.append(media_url)
            return

        if tag != "a":
            return
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
    try:
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
    seen: set[str] = set()
    page_media_urls = tuple(dict.fromkeys(parser.media_urls))

    for title, url in parser.links:
        if len(leads) >= limit:
            break
        if not _is_candidate(url, source.link_patterns) or url in seen:
            continue
        seen.add(url)
        display_title = title or urlparse(url).path.strip("/") or url
        linked_media_urls = tuple(link for _, link in parser.links if _is_media_url(link))
        article_media_urls = tuple(parser.link_media_urls.get(url, ()))
        media_urls = tuple(dict.fromkeys(page_media_urls + linked_media_urls))
        media_urls = tuple(dict.fromkeys(article_media_urls + media_urls))
        if source.require_media and not media_urls:
            continue
        leads.append(
            Lead(
                title=display_title[:180],
                url=url,
                source=source.name,
                score=score_text(display_title + " " + url) + source.priority + min(len(media_urls), 5) * 3,
                tags=source.tags,
                media_urls=media_urls[:5],
                summary=source.summary,
                preview_title=display_title[:180],
                preview_description="Fetched source with photos detected.",
            )
        )

    return leads


def _is_candidate(url: str, patterns: tuple[str, ...]) -> bool:
    if url.startswith(("mailto:", "javascript:")):
        return False
    return not patterns or any(pattern in url for pattern in patterns)


def _is_media_url(url: str) -> bool:
    return urlparse(url).path.lower().endswith(IMAGE_EXTENSIONS)
