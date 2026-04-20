"""
ai.py

Public entrypoint(s) for the Gomoku AI.
This file keeps the "what do I call?" API small and easy to defend:
- choose_best_move(...) -> (x, y) or None
- choose_best_move_with_stats(...) -> SearchResult with debug stats
"""

from __future__ import annotations

from time import perf_counter
from typing import Dict, Optional, Tuple

from .captures import apply_move_with_captures, undo_move_with_captures
from .constants import (
    AI_PLAYER,
    DEFAULT_MAX_DEPTH,
    DEFAULT_TIME_LIMIT_MS,
    LOSE_SCORE,
    OPPONENT_PLAYER,
    WIN_SCORE,
)
from .rules import get_legal_moves, get_terminal_score
from .search import minimax, order_moves
from .types import Board, Move, SearchResult, SearchStats


def choose_best_move(
    board: Board,
    max_depth: int = DEFAULT_MAX_DEPTH,
    ai_captures: int = 0,
    opponent_captures: int = 0,
    time_limit_ms: int = DEFAULT_TIME_LIMIT_MS,
) -> Optional[Move]:
    """
    Main function for backend use.

    Returns only the best move as (x, y).
    If you want debug info too, use choose_best_move_with_stats().
    """
    result = choose_best_move_with_stats(
        board=board,
        max_depth=max_depth,
        ai_captures=ai_captures,
        opponent_captures=opponent_captures,
        time_limit_ms=time_limit_ms,
    )
    return result.move


def choose_best_move_with_stats(
    board: Board,
    max_depth: int = DEFAULT_MAX_DEPTH,
    ai_captures: int = 0,
    opponent_captures: int = 0,
    time_limit_ms: int = DEFAULT_TIME_LIMIT_MS,
) -> SearchResult:
    """
    Same as choose_best_move(), but also returns score and debug stats.

    This is useful for testing and defense.
    """
    start_time = perf_counter()

    captures: Dict[int, int] = {
        AI_PLAYER: ai_captures,
        OPPONENT_PLAYER: opponent_captures,
    }

    legal_moves = get_legal_moves(board, AI_PLAYER, captures)
    stats = SearchStats()

    if not legal_moves:
        stats.elapsed_ms = (perf_counter() - start_time) * 1000.0
        return SearchResult(None, 0.0, 0, stats)

    # Immediate terminal win
    for x, y in legal_moves:
        history = apply_move_with_captures(board, x, y, AI_PLAYER, captures)
        terminal = get_terminal_score(board, captures)
        undo_move_with_captures(board, captures, AI_PLAYER, history)

        if terminal == WIN_SCORE:
            stats.elapsed_ms = (perf_counter() - start_time) * 1000.0
            return SearchResult((x, y), WIN_SCORE, 1, stats)

    # Immediate block of opponent terminal win
    opponent_legal_moves = get_legal_moves(board, OPPONENT_PLAYER, captures)
    dangerous = set()

    for x, y in opponent_legal_moves:
        history = apply_move_with_captures(board, x, y, OPPONENT_PLAYER, captures)
        terminal = get_terminal_score(board, captures)
        undo_move_with_captures(board, captures, OPPONENT_PLAYER, history)

        if terminal == LOSE_SCORE:
            dangerous.add((x, y))

    for move in legal_moves:
        if move in dangerous:
            stats.elapsed_ms = (perf_counter() - start_time) * 1000.0
            return SearchResult(move, 0.0, 1, stats)

    legal_moves = order_moves(board, captures, AI_PLAYER, legal_moves)

    best_move: Optional[Move] = None
    best_score = float("-inf")
    depth_reached = 0

    # Iterative deepening: search depth 1, then 2, then 3...
    # This is useful when you have a time limit.
    for depth in range(1, max_depth + 1):
        elapsed_ms = (perf_counter() - start_time) * 1000.0
        if elapsed_ms >= time_limit_ms:
            break

        current_best_move: Optional[Move] = None
        current_best_score = float("-inf")
        table: Dict[Tuple, float] = {}

        for x, y in legal_moves:
            elapsed_ms = (perf_counter() - start_time) * 1000.0
            if elapsed_ms >= time_limit_ms:
                break

            history = apply_move_with_captures(board, x, y, AI_PLAYER, captures)
            score = minimax(
                board=board,
                captures=captures,
                depth=depth - 1,
                alpha=float("-inf"),
                beta=float("inf"),
                maximizing=False,
                start_time=start_time,
                time_limit_ms=time_limit_ms,
                stats=stats,
                table=table,
            )
            undo_move_with_captures(board, captures, AI_PLAYER, history)

            if score > current_best_score:
                current_best_score = score
                current_best_move = (x, y)

        if current_best_move is not None:
            best_move = current_best_move
            best_score = current_best_score
            depth_reached = depth

    stats.elapsed_ms = (perf_counter() - start_time) * 1000.0
    return SearchResult(best_move, best_score, depth_reached, stats)

