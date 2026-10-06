from dataclasses import dataclass

from hypothesis import given
from hypothesis import strategies as st

from app.services.ordering import place, renumber


@dataclass(eq=False)
class Item:
    name: str
    position: int = -1


def test_renumber_makes_positions_dense_in_list_order() -> None:
    items = [Item("a", 7), Item("b", 3), Item("c", 9)]
    renumber(items)
    assert [item.position for item in items] == [0, 1, 2]


@given(st.integers(min_value=0, max_value=6), st.integers(min_value=0, max_value=10))
def test_place_inserts_at_the_index_or_the_end(size, index) -> None:
    items = [Item(str(each)) for each in range(size)]
    moved = Item("moved")
    place(items, moved, index)
    assert items.index(moved) == min(index, size)
    assert [item.position for item in items] == list(range(size + 1))
    assert [item.name for item in items if item is not moved] == [str(each) for each in range(size)]
