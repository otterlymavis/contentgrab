from __future__ import annotations

import argparse
import json
import mimetypes
import posixpath
from dataclasses import asdict
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from .collectors import collect_sources
from .config import load_config
from .exporters import read_json, write_json, write_markdown
from .models import Lead
from .review import select_leads

ROOT = Path(__file__).resolve().parent.parent
STATIC_DIR = Path(__file__).resolve().parent / "static"
DEFAULT_CONFIG = ROOT / "configs" / "sources.example.toml"
LEADS_PATH = ROOT / "leads.json"
SHORTLIST_PATH = ROOT / "shortlist.json"
SHORTLIST_MD_PATH = ROOT / "shortlist.md"


def lead_to_dict(lead: Lead) -> dict[str, object]:
    return asdict(lead)


def leads_to_payload(leads: list[Lead]) -> list[dict[str, object]]:
    return [lead_to_dict(lead) for lead in leads]


def load_saved_leads(path: Path = LEADS_PATH) -> list[Lead]:
    if not path.exists():
        return []
    return read_json(path)


def write_shortlist(leads: list[Lead]) -> None:
    write_json(leads, SHORTLIST_PATH)
    write_markdown(leads, SHORTLIST_MD_PATH)


class ContentGrabHandler(BaseHTTPRequestHandler):
    server_version = "contentgrab/0.1"

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/":
            self._send_file(STATIC_DIR / "index.html")
            return
        if parsed.path.startswith("/static/"):
            static_path = _static_path(parsed.path.removeprefix("/static/"))
            if static_path is None:
                self.send_error(HTTPStatus.NOT_FOUND)
                return
            self._send_file(static_path)
            return
        if parsed.path == "/api/state":
            self._send_json(self._state_payload())
            return
        if parsed.path == "/api/config":
            query, sources = load_config(DEFAULT_CONFIG)
            search_sources = [source for source in sources if source.kind != "html"]
            search_buttons = collect_sources(search_sources, query=query, limit_per_source=1)
            self._send_json(
                {
                    "default_query": query,
                    "config_path": str(DEFAULT_CONFIG),
                    "sources": [asdict(source) for source in sources],
                    "search_buttons": leads_to_payload(search_buttons),
                }
            )
            return
        if parsed.path == "/api/export/shortlist.md":
            self._send_file(SHORTLIST_MD_PATH)
            return
        self.send_error(HTTPStatus.NOT_FOUND)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/collect":
            payload = self._read_json_body()
            default_query, sources = load_config(DEFAULT_CONFIG)
            requested_query = str(payload.get("query") or default_query).strip()
            limit = _positive_int(payload.get("limit"), default=15)
            min_score = _optional_int(payload.get("min_score"))
            leads = collect_sources(sources, query=requested_query, limit_per_source=limit)
            if min_score is not None:
                leads = [lead for lead in leads if lead.score >= min_score or lead.status != "ok"]
            write_json(leads, LEADS_PATH)
            self._send_json({"leads": leads_to_payload(leads), "shortlist": leads_to_payload(_load_shortlist())})
            return
        if parsed.path == "/api/shortlist":
            payload = self._read_json_body()
            leads = load_saved_leads()
            try:
                selected = _select_from_payload(leads, payload)
            except ValueError as exc:
                self._send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
                return
            write_shortlist(selected)
            self._send_json({"shortlist": leads_to_payload(selected)})
            return
        if parsed.path == "/api/shortlist/add":
            payload = self._read_json_body()
            index = _positive_int(payload.get("index"), default=0)
            leads = load_saved_leads()
            current = _load_shortlist()
            if index < 1 or index > len(leads):
                self._send_json({"error": "Lead index is out of range."}, HTTPStatus.BAD_REQUEST)
                return
            selected = _dedupe_leads(current + [leads[index - 1]])
            write_shortlist(selected)
            self._send_json({"shortlist": leads_to_payload(selected)})
            return
        if parsed.path == "/api/shortlist/remove":
            payload = self._read_json_body()
            url = str(payload.get("url", ""))
            selected = [lead for lead in _load_shortlist() if lead.url != url]
            write_shortlist(selected)
            self._send_json({"shortlist": leads_to_payload(selected)})
            return
        if parsed.path == "/api/shortlist/clear":
            write_shortlist([])
            self._send_json({"shortlist": []})
            return
        self.send_error(HTTPStatus.NOT_FOUND)

    def log_message(self, format: str, *args: object) -> None:
        return

    def _state_payload(self) -> dict[str, object]:
        return {"leads": leads_to_payload(load_saved_leads()), "shortlist": leads_to_payload(_load_shortlist())}

    def _read_json_body(self) -> dict[str, object]:
        length = int(self.headers.get("Content-Length", "0"))
        if length == 0:
            return {}
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def _send_json(self, payload: object, status: HTTPStatus = HTTPStatus.OK) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_file(self, path: Path) -> None:
        if not path.exists() or not path.is_file():
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        body = path.read_bytes()
        content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        if path.suffix in {".html", ".css", ".js", ".md"}:
            content_type += "; charset=utf-8"
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def _load_shortlist() -> list[Lead]:
    if not SHORTLIST_PATH.exists():
        return []
    return read_json(SHORTLIST_PATH)


def _static_path(value: str) -> Path | None:
    normalized = posixpath.normpath(value).lstrip("/")
    if normalized.startswith("../") or normalized == "..":
        return None
    return STATIC_DIR / normalized


def _select_from_payload(leads: list[Lead], payload: dict[str, object]) -> list[Lead]:
    tags = tuple(str(tag) for tag in payload.get("tags", []) if str(tag).strip())
    return select_leads(
        leads,
        indexes=str(payload.get("indexes", "")),
        tags=tags,
        min_score=_optional_int(payload.get("min_score")),
        include_errors=bool(payload.get("include_errors", False)),
    )


def _dedupe_leads(leads: list[Lead]) -> list[Lead]:
    deduped: list[Lead] = []
    seen: set[str] = set()
    for lead in leads:
        if lead.url in seen:
            continue
        seen.add(lead.url)
        deduped.append(lead)
    return deduped


def _positive_int(value: object, default: int) -> int:
    try:
        parsed = int(str(value))
    except (TypeError, ValueError):
        return default
    return parsed if parsed > 0 else default


def _optional_int(value: object) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(str(value))
    except (TypeError, ValueError):
        return None


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="contentgrab-web")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args(argv)

    server = ThreadingHTTPServer((args.host, args.port), ContentGrabHandler)
    print(f"contentgrab app running at http://{args.host}:{args.port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("Stopping contentgrab app")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
