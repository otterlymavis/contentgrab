import unittest

from contentgrab.html_collect import LinkParser


class LinkParserTests(unittest.TestCase):
    def test_link_parser_collects_absolute_links(self) -> None:
        parser = LinkParser("https://example.jp/board/")
        parser.feed('<a href="/topics/123">映画の新作が話題</a>')

        self.assertEqual(parser.links, [("映画の新作が話題", "https://example.jp/topics/123")])

    def test_link_parser_collects_media_sources(self) -> None:
        parser = LinkParser("https://example.jp/board/")
        parser.feed('<img src="/media/still.webp"><video src="/media/clip.mp4"></video>')

        self.assertEqual(
            parser.media_urls,
            ["https://example.jp/media/still.webp", "https://example.jp/media/clip.mp4"],
        )
