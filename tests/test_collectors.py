import unittest

from contentgrab.collectors import collect_sources
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
