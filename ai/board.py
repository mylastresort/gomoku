"""
board.py

Very small helpers around the board representation:
- create an empty board
- bounds checks
- safe cell access (edges count as blocked)
- lightweight board hashing for the transposition table
"""

from __future__ import annotations

from .constants import AI_PLAYER, BOARD_SIZE, EMPTY, OPPONENT_PLAYER
from .types import Board


def create_board() -> Board:
    """Create and return an empty 19x19 board."""
    return [[EMPTY for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]


def is_in_bounds(x: int, y: int) -> bool:
    """Return True if (x, y) is inside the board."""
    return 0 <= x < BOARD_SIZE and 0 <= y < BOARD_SIZE


def get_opponent(player: int) -> int:
    """Return the opposite player."""
    return AI_PLAYER if player == OPPONENT_PLAYER else OPPONENT_PLAYER


def get_cell(board: Board, x: int, y: int) -> int:
    """
    Safe board access.
    Returns -1 when out of bounds so edges behave like blocked cells.
    """
    if not is_in_bounds(x, y):
        return -1
    return board[y][x]


def board_key(board: Board) -> tuple[tuple[int, ...], ...]:
    """Convert board to a hashable immutable structure for transposition table."""
    return tuple(tuple(row) for row in board)

