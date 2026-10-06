from typing import Protocol


class Positioned(Protocol):
    position: int


def renumber(items: list[Positioned]) -> None:
    for position, item in enumerate(items):
        item.position = position


def place(items: list[Positioned], item: Positioned, index: int) -> None:
    """Puts `item` at `index` among `items` (which must not already contain it) and renumbers the
    lot. An index past the end appends: the client may be working from a list that has since
    shrunk, and "as far down as it goes" is the only reading of that which can't fail."""
    items.insert(min(index, len(items)), item)
    renumber(items)
