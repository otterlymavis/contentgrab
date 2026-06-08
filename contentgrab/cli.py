from __future__ import annotations

import argparse
from pathlib import Path

from .collectors import collect_sources
from .config import load_config
from .exporters import write_json, write_markdown


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="contentgrab")
    subparsers = parser.add_subparsers(dest="command", required=True)

    collect_parser = subparsers.add_parser("collect", help="Collect content leads")
    collect_parser.add_argument("--config", required=True, help="Path to sources TOML")
    collect_parser.add_argument("--query", help="Search query for search URL sources")
    collect_parser.add_argument("--limit", type=int, default=20, help="Maximum leads per source")
    collect_parser.add_argument("--markdown", default="leads.md", help="Markdown output path")
    collect_parser.add_argument("--json", default="leads.json", help="JSON output path")

    args = parser.parse_args(argv)
    if args.command == "collect":
        default_query, sources = load_config(args.config)
        query = (args.query or default_query).strip()
        if not query:
            parser.error("Provide --query or default_query in the config")

        leads = collect_sources(sources, query=query, limit_per_source=args.limit)
        write_markdown(leads, Path(args.markdown))
        write_json(leads, Path(args.json))
        print(f"Wrote {len(leads)} leads to {args.markdown} and {args.json}")
        return 0

    return 1


if __name__ == "__main__":
    raise SystemExit(main())
