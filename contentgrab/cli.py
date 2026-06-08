from __future__ import annotations

import argparse
from pathlib import Path

from .collectors import collect_sources
from .config import load_config
from .exporters import read_json, write_json, write_markdown
from .review import select_leads


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="contentgrab")
    subparsers = parser.add_subparsers(dest="command", required=True)

    collect_parser = subparsers.add_parser("collect", help="Collect content leads")
    collect_parser.add_argument("--config", required=True, help="Path to sources TOML")
    collect_parser.add_argument("--query", help="Optional query for legacy search URL sources")
    collect_parser.add_argument("--limit", type=int, default=20, help="Maximum leads per source")
    collect_parser.add_argument("--min-score", type=int, help="Only export leads at or above this score")
    collect_parser.add_argument("--markdown", default="leads.md", help="Markdown output path")
    collect_parser.add_argument("--json", default="leads.json", help="JSON output path")

    select_parser = subparsers.add_parser("select", help="Create a shortlist from a JSON leads file")
    select_parser.add_argument("--input", default="leads.json", help="Input JSON leads file")
    select_parser.add_argument("--indexes", default="", help="Comma-separated indexes or ranges, for example 1,3-5")
    select_parser.add_argument("--tag", action="append", default=[], help="Require at least one tag; repeatable")
    select_parser.add_argument("--min-score", type=int, help="Only include leads at or above this score")
    select_parser.add_argument("--include-errors", action="store_true", help="Keep failed source notes in the shortlist")
    select_parser.add_argument("--markdown", default="shortlist.md", help="Markdown shortlist output path")
    select_parser.add_argument("--json", default="shortlist.json", help="JSON shortlist output path")

    args = parser.parse_args(argv)
    if args.command == "collect":
        default_query, sources = load_config(args.config)
        query = (args.query or default_query).strip()
        leads = collect_sources(sources, query=query, limit_per_source=args.limit)
        if args.min_score is not None:
            leads = [lead for lead in leads if lead.score >= args.min_score or lead.status != "ok"]
        write_markdown(leads, Path(args.markdown))
        write_json(leads, Path(args.json))
        print(f"Wrote {len(leads)} leads to {args.markdown} and {args.json}")
        return 0

    if args.command == "select":
        leads = read_json(args.input)
        selected = select_leads(
            leads,
            indexes=args.indexes,
            tags=tuple(args.tag),
            min_score=args.min_score,
            include_errors=args.include_errors,
        )
        write_markdown(selected, Path(args.markdown))
        write_json(selected, Path(args.json))
        print(f"Wrote {len(selected)} selected leads to {args.markdown} and {args.json}")
        return 0

    return 1


if __name__ == "__main__":
    raise SystemExit(main())
