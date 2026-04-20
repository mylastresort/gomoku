"""
rules.py

All "game rules" in one place:
- five-in-a-row detection
- candidate move generation and legality (double-three rule)
- endgame capture logic (breaking a five by capture)
- terminal state scoring (win/lose or None)
"""

from __future__ import annotations

from typing import Dict, List, Optional

from .board import get_opponent, is_in_bounds
from .captures import apply_move_with_captures, undo_move_with_captures
from .constants import (
    AI_PLAYER,
    BOARD_SIZE,
    DIRECTIONS,
    EMPTY,
    LOSE_SCORE,
    NEIGHBOR_RADIUS,
    OPPONENT_PLAYER,
    WIN_SCORE,
)
from .types import Board, Move


# ==================================================
# Win detection
# ==================================================

def check_five_in_a_row(board: Board, x: int, y: int, player: int) -> bool:
    """Check whether the stone at (x, y) is part of a line of 5 or more."""
    for dx, dy in DIRECTIONS:
        count = 1

        nx, ny = x + dx, y + dy
        while is_in_bounds(nx, ny) and board[ny][nx] == player:
            count += 1
            nx += dx
            ny += dy

        nx, ny = x - dx, y - dy
        while is_in_bounds(nx, ny) and board[ny][nx] == player:
            count += 1
            nx -= dx
            ny -= dy

        if count >= 5:
            return True

    return False


def has_player_won(board: Board, player: int) -> bool:
    """Return True if the player has any 5-in-a-row on the board."""
    for y in range(BOARD_SIZE):
        for x in range(BOARD_SIZE):
            if board[y][x] == player and check_five_in_a_row(board, x, y, player):
                return True
    return False


# ==================================================
# Candidate moves
# ==================================================

def get_candidate_moves(board: Board) -> List[Move]:
    """
    Generate empty cells near existing stones.
    This is much faster than checking all 361 cells.
    """
    stones: List[Move] = []

    for y in range(BOARD_SIZE):
        for x in range(BOARD_SIZE):
            if board[y][x] != EMPTY:
                stones.append((x, y))

    if not stones:
        return [(BOARD_SIZE // 2, BOARD_SIZE // 2)]

    candidates = set()

    for sx, sy in stones:
        for dy in range(-NEIGHBOR_RADIUS, NEIGHBOR_RADIUS + 1):
            for dx in range(-NEIGHBOR_RADIUS, NEIGHBOR_RADIUS + 1):
                nx, ny = sx + dx, sy + dy
                if is_in_bounds(nx, ny) and board[ny][nx] == EMPTY:
                    candidates.add((nx, ny))

    return list(candidates)


# ==================================================
# Double-three detection
# ==================================================

def has_open_four_in_direction(board: Board, player: int, x: int, y: int, dx: int, dy: int) -> bool:
    """
    Return True if there is a 4-stone line with two open ends
    in this direction and that line contains (x, y).
    """
    for offset in range(-3, 1):
        coords: List[Move] = []

        for i in range(4):
            cx = x + (offset + i) * dx
            cy = y + (offset + i) * dy
            if not is_in_bounds(cx, cy):
                coords = []
                break
            coords.append((cx, cy))

        if not coords:
            continue

        if (x, y) not in coords:
            continue

        if not all(board[cy][cx] == player for cx, cy in coords):
            continue

        left_x = x + (offset - 1) * dx
        left_y = y + (offset - 1) * dy
        right_x = x + (offset + 4) * dx
        right_y = y + (offset + 4) * dy

        if (
            is_in_bounds(left_x, left_y)
            and is_in_bounds(right_x, right_y)
            and board[left_y][left_x] == EMPTY
            and board[right_y][right_x] == EMPTY
        ):
            return True

    return False


def is_free_three_in_direction(board: Board, player: int, x: int, y: int, dx: int, dy: int) -> bool:
    """
    Practical free-three test:
    if one extra move in this direction can create an open four,
    this direction behaves like a free-three.
    """
    for step in range(-4, 5):
        tx = x + step * dx
        ty = y + step * dy

        if not is_in_bounds(tx, ty):
            continue
        if board[ty][tx] != EMPTY:
            continue

        board[ty][tx] = player
        found = has_open_four_in_direction(board, player, x, y, dx, dy)
        board[ty][tx] = EMPTY

        if found:
            return True

    return False


def count_free_threes(board: Board, player: int, x: int, y: int) -> int:
    """Count the number of free-threes created by the move at (x, y)."""
    total = 0
    for dx, dy in DIRECTIONS:
        if is_free_three_in_direction(board, player, x, y, dx, dy):
            total += 1
    return total


def is_legal_move(
    board: Board,
    x: int,
    y: int,
    player: int,
    captures: Dict[int, int],
) -> bool:
    """
    Legal move rules used here:
    - cell must be empty
    - if the move captures, it is legal even if it creates double-three
    - otherwise, 2 or more free-threes means illegal
    """
    if not is_in_bounds(x, y) or board[y][x] != EMPTY:
        return False

    history = apply_move_with_captures(board, x, y, player, captures)
    made_capture = len(history) > 1

    legal = True
    if not made_capture and count_free_threes(board, player, x, y) >= 2:
        legal = False

    undo_move_with_captures(board, captures, player, history)
    return legal


def get_legal_moves(board: Board, player: int, captures: Dict[int, int]) -> List[Move]:
    """Return candidate moves filtered by legality."""
    return [
        (x, y)
        for x, y in get_candidate_moves(board)
        if is_legal_move(board, x, y, player, captures)
    ]


# ==================================================
# Endgame capture logic
# ==================================================

def can_break_opponent_five_by_capture(
    board: Board,
    player_with_five: int,
    captures: Dict[int, int],
) -> bool:
    """
    Return True if the opponent has a legal move that captures
    and destroys the existing 5-in-a-row.
    """
    opponent = get_opponent(player_with_five)
    legal_moves = get_legal_moves(board, opponent, captures)

    for x, y in legal_moves:
        history = apply_move_with_captures(board, x, y, opponent, captures)
        made_capture = len(history) > 1
        still_has_five = has_player_won(board, player_with_five)
        undo_move_with_captures(board, captures, opponent, history)

        if made_capture and not still_has_five:
            return True

    return False


def get_terminal_score(board: Board, captures: Dict[int, int]) -> Optional[int]:
    """
    Return terminal score if game is over, else None.

    Order:
    1) capture win
    2) five-in-row that cannot be broken by capture
    """
    if captures[AI_PLAYER] >= 10:
        return WIN_SCORE
    if captures[OPPONENT_PLAYER] >= 10:
        return LOSE_SCORE

    ai_has_five = has_player_won(board, AI_PLAYER)
    opp_has_five = has_player_won(board, OPPONENT_PLAYER)

    if ai_has_five and not can_break_opponent_five_by_capture(board, AI_PLAYER, captures):
        return WIN_SCORE

    if opp_has_five and not can_break_opponent_five_by_capture(board, OPPONENT_PLAYER, captures):
        return LOSE_SCORE

    return None

