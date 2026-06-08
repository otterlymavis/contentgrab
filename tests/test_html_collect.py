import unittest

from contentgrab.html_collect import LinkParser


class LinkParserTests(unittest.TestCase):
    def test_link_parser_collects_absolute_links(self) -> None:
        parser = LinkParser("https://example.jp/board/")
        parser.feed('<a href="/topics/123">映画の新作が話題</a>')

        self.assertEqual(parser.links, [("映画の新作が話題", "https://example.jp/topics/123")])

    def test_link_parser_collects_image_sources(self) -> None:
        parser = LinkParser("https://example.jp/board/")
        parser.feed('<img src="/media/still.webp"><video src="/media/clip.mp4"></video>')

        self.assertEqual(
            parser.media_urls,
            ["https://example.jp/media/still.webp"],
        )

    def test_link_parser_associates_images_inside_links(self) -> None:
        parser = LinkParser("https://example.jp/board/")
        parser.feed('<a href="/topics/123"><img data-src="/media/still.webp">Story</a>')

        self.assertEqual(parser.links, [("Story", "https://example.jp/topics/123")])
        self.assertEqual(
            parser.link_media_urls,
            {"https://example.jp/topics/123": ["https://example.jp/media/still.webp"]},
        )
