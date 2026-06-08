from __future__ import annotations

from .models import Lead


def select_leads(
    leads: list[Lead],
    indexes: str = "",
    tags: tuple[str, ...] = (),
    min_score: int | None = None,
    include_errors: bool = False,
) -> list[Lead]:
    selected_indexes = _parse_indexes(indexes)
    selected: list[Lead] = []

    for position, lead in enumerate(leads, start=1):
        if not include_errors and lead.status == "error":
            continue
        if selected_indexes and position not in selected_indexes:
            continue
        if tags and not set(tags).intersection(lead.tags):
            continue
        if min_score is not None and lead.score < min_score:
            continue
        selected.append(lead)

    return selected


def _parse_indexes(value: str) -> set[int]:
    indexes: set[int] = set()
    for raw_part in value.split(","):
        part = raw_part.strip()
        if not part:
            continue
        if "-" in part:
            start_text, end_text = part.split("-", 1)
            start = int(start_text)
            end = int(end_text)
            indexes.update(range(start, end + 1))
        else:
            indexes.add(int(part))
    return indexes
