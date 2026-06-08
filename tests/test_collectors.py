import unittest

from contentgrab.collectors import _status_rank, _twitter_search_term, _x_media_search_url, collect_sources
from contentgrab.models import Source


class CollectorTests(unittest.TestCase):
    def test_search_url_sources_create_manual_review_leads(self) -> None:
        leads = collect_sources(
            [
                Source(
                    name="X Search",
                    kind="search_url",
                    url_template="https://twitter.com/search?q={query}",
                    tags=("x",),
                )
            ],
            query="映画 ドラマ",
            limit_per_source=5,
        )

        self.assertEqual(len(leads), 1)
        self.assertIn("twitter.com/search", leads[0].url)
        self.assertEqual(leads[0].tags, ("x",))

    def test_source_priority_adds_to_score(self) -> None:
        leads = collect_sources(
            [
                Source(
                    name="X Search",
                    kind="search_url",
                    url_template="https://twitter.com/search?q={query}",
                    priority=10,
                )
            ],
            query="映画",
            limit_per_source=5,
        )

        self.assertGreaterEqual(leads[0].score, 12)

    def test_manual_url_sources_create_manual_leads(self) -> None:
        leads = collect_sources(
            [
                Source(
                    name="X Explore",
                    kind="manual_url",
                    url="https://twitter.com/explore/tabs/trending",
                    priority=4,
                    summary="Manual trend page.",
                )
            ]
        )

        self.assertEqual(leads[0].status, "manual")
        self.assertEqual(leads[0].summary, "Manual trend page.")

    def test_x_media_search_url_adds_media_filter(self) -> None:
        url = _x_media_search_url("#CDTVライブライブ")

        self.assertIn("filter%3Amedia", url)
        self.assertIn("twitter.com/search", url)

    def test_twitter_search_term_reads_query_parameter(self) -> None:
        term = _twitter_search_term("fallback", "https://twitter.com/search?q=%23CDTV")

        self.assertEqual(term, "#CDTV")

    def test_media_search_status_ranks_first(self) -> None:
        self.assertGreater(_status_rank("media-search"), _status_rank("ok"))
