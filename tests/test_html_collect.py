import unittest

from contentgrab.html_collect import LinkParser


class LinkParserTests(unittest.TestCase):
    def test_link_parser_collects_absolute_links(self) -> None:
        parser = LinkParser("https://example.jp/board/")
        parser.feed('<a href="/topics/123">映画の新作が話題</a>')

        self.assertEqual(parser.links, [("映画の新作が話題", "https://example.jp/topics/123")])
