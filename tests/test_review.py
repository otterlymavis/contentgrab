import unittest

from contentgrab.models import Lead
from contentgrab.review import select_leads


class ReviewTests(unittest.TestCase):
    def test_select_leads_by_index_range(self) -> None:
        leads = [
            Lead(title="one", url="https://example.com/1", source="test", score=1),
            Lead(title="two", url="https://example.com/2", source="test", score=1),
            Lead(title="three", url="https://example.com/3", source="test", score=1),
        ]

        selected = select_leads(leads, indexes="2-3")

        self.assertEqual([lead.title for lead in selected], ["two", "three"])

    def test_select_leads_filters_tags_scores_and_errors(self) -> None:
        leads = [
            Lead(title="x", url="https://example.com/x", source="test", score=8, tags=("x",)),
            Lead(title="low", url="https://example.com/low", source="test", score=1, tags=("x",)),
            Lead(title="error", url="https://example.com/error", source="test", score=9, tags=("x",), status="error"),
        ]

        selected = select_leads(leads, tags=("x",), min_score=5)

        self.assertEqual([lead.title for lead in selected], ["x"])
