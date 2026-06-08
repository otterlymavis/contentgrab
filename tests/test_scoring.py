import unittest

from contentgrab.scoring import score_text


class ScoringTests(unittest.TestCase):
    def test_entertainment_keywords_score_higher(self) -> None:
        self.assertGreater(score_text("新作ドラマ 主演俳優が話題"), score_text("今日の天気"))
