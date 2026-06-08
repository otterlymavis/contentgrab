# contentgrab

`contentgrab` is a small local CLI for collecting daily content leads from Japanese culture and entertainment sources. It is designed for creators who want links, context, and light metadata first, then choose what is worth turning into a post.

The tool does not download images or videos. It collects links to posts, pages, and obvious media URLs so you can review sources yourself and stay mindful of platform rules and copyright.

## What it does

- Reads source definitions from a TOML config.
- Collects links from HTML pages such as forums, rankings, and news pages.
- Adds search URLs for sources that are not safe or practical to scrape directly, such as X/Twitter.
- Scores leads with Japanese entertainment keywords.
- Exports Markdown for daily review and JSON for automation.

## Quick start

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e .
.\.venv\Scripts\python.exe -m contentgrab collect --config configs\sources.example.toml --query "映画 ドラマ 芸能" --limit 25 --markdown leads.md --json leads.json
```

Open `leads.md` after the run and pick the links you want to investigate.

## Example sources

The example config includes:

- Girls Channel ranking pages.
- 5ch board pages.
- X/Twitter search links.
- Yahoo realtime search links.

Some platforms change markup often, require login, or prohibit automated scraping. For those, `contentgrab` can generate useful search links instead of pretending it can reliably fetch everything.

## Config

See [configs/sources.example.toml](configs/sources.example.toml).

HTML sources support:

- `url`: page to fetch.
- `link_patterns`: optional substrings that candidate URLs must contain.
- `tags`: labels added to each lead.

Search URL sources support:

- `url_template`: template containing `{query}`.
- `tags`: labels added to the generated lead.

## Next ideas

- Add a lightweight review UI.
- Add per-source rate limits and caching.
- Add official API adapters where available.
- Package the workflow as a Codex skill that runs the CLI and summarizes the leads.
