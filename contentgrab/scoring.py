from __future__ import annotations

ENTERTAINMENT_KEYWORDS = (
    "映画",
    "ドラマ",
    "テレビ",
    "tv",
    "配信",
    "netflix",
    "amazon",
    "disney",
    "俳優",
    "女優",
    "芸能",
    "アイドル",
    "アニメ",
    "声優",
    "主演",
    "出演",
    "公開",
    "予告",
    "炎上",
    "話題",
)


def score_text(text: str) -> int:
    normalized = text.lower()
    score = 0
    for keyword in ENTERTAINMENT_KEYWORDS:
        if keyword.lower() in normalized:
            score += 2
    if any(marker in normalized for marker in ("ranking", "hot", "popular", "trend", "話題")):
        score += 1
    return score
