"""
captures.py

Implements capture rules plus an undo-friendly move history:
- apply_move_with_captures() returns a list of changes (history)
- undo_move_with_captures() restores the board and capture counts
"""

from __future__ import annotations

from typing import Dict, List, Tuple

from .board import get_opponent, is_in_bounds
from .constants import DIRECTIONS, EMPTY
from .types import Board


def apply_move_with_captures(
    board: Board,
    x: int,
    y: int,
    player: int,
    captures: Dict[int, int],
) -> List[Tuple[int, int, int]]:
    """
    Place a move and apply captures.

    Returns a history list so the move can be undone later.
    Each item is (x, y, old_value).
    """
    board[y][x] = player
    history = [(x, y, EMPTY)]

    opponent = get_opponent(player)

    for dx, dy in DIRECTIONS:
        for sign in (1, -1):
            sdx = dx * sign
            sdy = dy * sign

            x1, y1 = x + sdx, y + sdy
            x2, y2 = x + 2 * sdx, y + 2 * sdy
            x3, y3 = x + 3 * sdx, y + 3 * sdy

            if not (is_in_bounds(x1, y1) and is_in_bounds(x2, y2) and is_in_bounds(x3, y3)):
                continue

            if (
                board[y1][x1] == opponent
                and board[y2][x2] == opponent
                and board[y3][x3] == player
            ):
                history.append((x1, y1, opponent))
                history.append((x2, y2, opponent))
                board[y1][x1] = EMPTY
                board[y2][x2] = EMPTY
                captures[player] += 2

    return history


def undo_move_with_captures(
    board: Board,
    captures: Dict[int, int],
    player: int,
    history: List[Tuple[int, int, int]],
) -> None:
    """Undo a move created by apply_move_with_captures."""
    removed_count = len(history) - 1
    captures[player] -= removed_count

    for hx, hy, old_value in reversed(history):
        board[hy][hx] = old_value

