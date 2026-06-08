import unittest

from contentgrab.models import Lead
from contentgrab.webapp import _dedupe_leads, _optional_int, _positive_int, _static_path, leads_to_payload


class WebAppTests(unittest.TestCase):
    def test_leads_to_payload_keeps_tuple_fields_json_ready(self) -> None:
        payload = leads_to_payload(
            [Lead(title="lead", url="https://example.com", source="test", score=5, tags=("x",))]
        )

        self.assertEqual(payload[0]["tags"], ("x",))
        self.assertEqual(payload[0]["score"], 5)

    def test_dedupe_leads_by_url(self) -> None:
        lead = Lead(title="lead", url="https://example.com", source="test", score=5)

        self.assertEqual(_dedupe_leads([lead, lead]), [lead])

    def test_integer_helpers(self) -> None:
        self.assertEqual(_positive_int("7", 1), 7)
        self.assertEqual(_positive_int("-1", 3), 3)
        self.assertEqual(_optional_int(""), None)
        self.assertEqual(_optional_int("9"), 9)

    def test_static_path_rejects_parent_traversal(self) -> None:
        self.assertIsNone(_static_path("../README.md"))
        self.assertIsNotNone(_static_path("app.js"))
