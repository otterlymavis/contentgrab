# contentgrab

`contentgrab` is a small local app and CLI for finding Japanese hit-tweet leads that point toward posts with images or video. It is designed for creators who want links, context, and light metadata first, then choose what is worth turning into a post.

The tool does not download images or videos. It collects links to posts, pages, and obvious media URLs so you can review sources yourself and stay mindful of platform rules and copyright.

## What it does

- Reads source definitions from a TOML config.
- Collects links from HTML pages such as forums, rankings, and news pages.
- Opens X/Twitter search lanes for high-engagement Japanese tweets that contain images or video.
- Keeps trend-topic media searches as backup context, not the primary workflow.
- Adds manual trend URLs for sources that are not safe or practical to scrape directly.
- Scores leads with Japanese entertainment keywords.
- Exports Markdown for daily review and JSON for automation.

## Quick start

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e .
.\.venv\Scripts\python.exe -m contentgrab collect --config configs\sources.example.toml --limit 25 --markdown leads.md --json leads.json
```

Open `leads.md` after the run and pick the links you want to investigate.

## Daily workflow

Collect hit-tweet and media leads:

```powershell
.\.venv\Scripts\python.exe -m contentgrab collect --config configs\sources.example.toml --limit 15 --min-score 1
```

Create a shortlist by lead number:

```powershell
.\.venv\Scripts\python.exe -m contentgrab select --input leads.json --indexes 1,3-5 --markdown shortlist.md --json shortlist.json
```

Create a shortlist by source tag and score:

```powershell
.\.venv\Scripts\python.exe -m contentgrab select --input leads.json --tag x --tag yahoo --min-score 6
```

## Local app

Run the review dashboard:

```powershell
.\.venv\Scripts\python.exe -m contentgrab.webapp --host 127.0.0.1 --port 8765
```

Open [http://127.0.0.1:8765](http://127.0.0.1:8765).

The app lets you collect hit-tweet leads, filter by source/status/preview availability, add individual leads to a shortlist, build a shortlist by indexes/tags/score, clear stale shortlists, and open the exported Markdown shortlist.

## Example sources

The example config includes:

- X/Twitter hit-tweet search lanes using media and engagement filters.
- Japan X/Twitter trend terms converted into media-filtered searches as a backup source.
- Japan YouTube trending videos with thumbnail previews when detected.
- Girls Channel ranking pages with media links when detected.
- Manual cross-check links for X Explore, Yahoo realtime, Google Trends Japan, and TikTok Creative Center Japan.

Some platforms change markup often, require login, or prohibit automated scraping. For those, `contentgrab` can generate useful search links instead of pretending it can reliably fetch everything.

## Config

See [configs/sources.example.toml](configs/sources.example.toml).

HTML sources support:

- `url`: page to fetch.
- `link_patterns`: optional substrings that candidate URLs must contain.
- `tags`: labels added to each lead.
- `priority`: source score boost for your favorite sources.
- `require_media`: skip fetched leads when no media URL is detected.

Trend and manual sources support:

- `kind = "x_hit_media_search"`: creates X search lanes for individual high-engagement media tweets.
- `kind = "x_trends_media"`: fetches Japan trend terms and creates X media-search leads.
- `kind = "youtube_trends"`: fetches Japan YouTube trend links and creates thumbnail preview leads.
- `kind = "manual_url"`: creates a manual review link for blocked or personalized trend surfaces.
- `url_template`: template containing `{query}`.
- `tags`: labels added to the generated lead.
- `priority`: source score boost for your favorite sources.

## Next ideas

- Add a lightweight review UI.
- Add per-source rate limits and caching.
- Add official API adapters where available.
- Package the workflow as a Codex skill that runs the CLI and summarizes the leads.
