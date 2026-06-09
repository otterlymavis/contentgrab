import unittest
from unittest.mock import patch

from contentgrab.html_collect import LinkParser, _is_media_url, collect_html_source
from contentgrab.models import Source


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

    def test_collect_html_source_keeps_article_photo_set(self) -> None:
        list_html = '<a href="/topics/123"><img src="/media/thumb.jpg">Story</a>'
        detail_html = "".join(f'<img src="/media/{index}.jpg">' for index in range(14))
        source = Source(
            name="Photos",
            kind="html",
            url="https://example.jp/board/",
            link_patterns=("/topics/",),
            require_media=True,
        )

        def fake_fetch(url: str, timeout: int = 20) -> str:
            if url == "https://example.jp/topics/123":
                return detail_html
            return list_html

        with patch("contentgrab.html_collect.fetch_html", side_effect=fake_fetch):
            leads = collect_html_source(source, limit=1)

        self.assertEqual(len(leads), 1)
        self.assertEqual(len(leads[0].media_urls), 12)
        self.assertEqual(leads[0].media_urls[0], "https://example.jp/media/thumb.jpg")
        self.assertEqual(leads[0].media_urls[1], "https://example.jp/media/0.jpg")

    def test_placeholder_images_are_not_media(self) -> None:
        self.assertFalse(_is_media_url("https://example.jp/common/loading.gif"))
        self.assertFalse(_is_media_url("https://example.jp/common/goods_blank.png"))
        self.assertFalse(_is_media_url("https://example.jp/media/noimage.webp"))
        self.assertTrue(_is_media_url("https://example.jp/media/still.webp"))
