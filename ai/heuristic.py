"""
heuristic.py

Board evaluation (the "brain" that scores positions for minimax).
It stays simple: line patterns + capture count bonus.
"""

from __future__ import annotations

from typing import Dict

from .board import get_cell, is_in_bounds
from .constants import AI_PLAYER, BOARD_SIZE, DIRECTIONS, EMPTY, OPPONENT_PLAYER
from .types import Board


def pattern_score(length: int, open_ends: int) -> float:
    """
    Score one consecutive line segment.
    Open ends matter because open shapes are much stronger.
    """
    if length >= 5:
        return 50_000.0

    values = {
        1: 3,
        2: 25,
        3: 220,
        4: 4_000,
    }

    base = values.get(length, 0)
    if base == 0:
        return 0.0

    if open_ends == 2:
        return float(base)
    if open_ends == 1:
        return float(base) * 0.35
    return float(base) * 0.08


def score_player(board: Board, player: int) -> float:
    """
    Score all streaks for one player.
    Each streak is counted once from its starting cell.
    """
    total = 0.0

    for y in range(BOARD_SIZE):
        for x in range(BOARD_SIZE):
            if board[y][x] != player:
                continue

            for dx, dy in DIRECTIONS:
                prev_x = x - dx
                prev_y = y - dy

                # Only start scoring from the beginning of a streak
                if is_in_bounds(prev_x, prev_y) and board[prev_y][prev_x] == player:
                    continue

                length = 0
                cx, cy = x, y

                while is_in_bounds(cx, cy) and board[cy][cx] == player:
                    length += 1
                    cx += dx
                    cy += dy

                left_cell = get_cell(board, x - dx, y - dy)
                right_cell = get_cell(board, x + length * dx, y + length * dy)

                open_ends = 0
                if left_cell == EMPTY:
                    open_ends += 1
                if right_cell == EMPTY:
                    open_ends += 1

                total += pattern_score(length, open_ends)

    return total


def evaluate_board(board: Board, captures: Dict[int, int]) -> float:
    """
    Heuristic score from AI perspective.
    Positive = good for AI, negative = good for opponent.
    """
    score = score_player(board, AI_PLAYER) - score_player(board, OPPONENT_PLAYER)

    # Captures are very important in this subject
    score += captures[AI_PLAYER] * 1200
    score -= captures[OPPONENT_PLAYER] * 1200

    return score

