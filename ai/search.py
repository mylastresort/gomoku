"""
search.py

Minimax + alpha-beta pruning + small speed tricks:
- move ordering
- transposition table
- iterative deepening time checks (time limit handled from ai.py)
"""

from __future__ import annotations

from time import perf_counter
from typing import Dict, Tuple

from .board import board_key
from .captures import apply_move_with_captures, undo_move_with_captures
from .constants import AI_PLAYER, BOARD_SIZE, OPPONENT_PLAYER
from .heuristic import evaluate_board
from .rules import get_legal_moves, get_terminal_score
from .types import Board, Move, SearchStats


def move_order_score(board: Board, captures: Dict[int, int], player: int, move: Move) -> float:
    """
    Give a quick score to a move before minimax.
    Better ordering = more alpha-beta pruning = faster search.
    """
    x, y = move
    center = BOARD_SIZE // 2
    score = 0.0

    # Prefer center a bit
    distance_to_center = abs(x - center) + abs(y - center)
    score -= distance_to_center * 2

    # Immediate win gets top priority
    history = apply_move_with_captures(board, x, y, player, captures)
    terminal = get_terminal_score(board, captures)

    if player == AI_PLAYER and terminal is not None and terminal > 0:
        score += 1_000_000
    elif player == OPPONENT_PLAYER and terminal is not None and terminal < 0:
        score += 1_000_000

    # Prefer capture moves
    if len(history) > 1:
        score += 20_000

    # Add light heuristic
    raw = evaluate_board(board, captures)
    score += raw if player == AI_PLAYER else -raw

    undo_move_with_captures(board, captures, player, history)
    return score


def order_moves(board: Board, captures: Dict[int, int], player: int, moves: list[Move]) -> list[Move]:
    """Sort moves from most promising to least promising."""
    return sorted(
        moves,
        key=lambda move: move_order_score(board, captures, player, move),
        reverse=True,
    )


def minimax(
    board: Board,
    captures: Dict[int, int],
    depth: int,
    alpha: float,
    beta: float,
    maximizing: bool,
    start_time: float,
    time_limit_ms: int,
    stats: SearchStats,
    table: Dict[Tuple, float],
) -> float:
    """
    Recursive minimax search with:
    - alpha-beta pruning
    - node counting
    - simple time check
    - simple transposition table
    """
    stats.nodes += 1

    elapsed_ms = (perf_counter() - start_time) * 1000.0
    if elapsed_ms >= time_limit_ms:
        return evaluate_board(board, captures)

    current_depth_from_root = depth
    if current_depth_from_root > stats.max_depth_reached:
        stats.max_depth_reached = current_depth_from_root

    terminal = get_terminal_score(board, captures)
    if terminal is not None:
        return terminal

    if depth == 0:
        return evaluate_board(board, captures)

    current_player = AI_PLAYER if maximizing else OPPONENT_PLAYER

    key = (board_key(board), captures[AI_PLAYER], captures[OPPONENT_PLAYER], current_player, depth)
    if key in table:
        return table[key]

    moves = get_legal_moves(board, current_player, captures)
    if not moves:
        value = evaluate_board(board, captures)
        table[key] = value
        return value

    moves = order_moves(board, captures, current_player, moves)

    if maximizing:
        best_score = float("-inf")

        for x, y in moves:
            history = apply_move_with_captures(board, x, y, AI_PLAYER, captures)
            score = minimax(
                board,
                captures,
                depth - 1,
                alpha,
                beta,
                False,
                start_time,
                time_limit_ms,
                stats,
                table,
            )
            undo_move_with_captures(board, captures, AI_PLAYER, history)

            if score > best_score:
                best_score = score

            if best_score > alpha:
                alpha = best_score

            if beta <= alpha:
                stats.cutoffs += 1
                break

        table[key] = best_score
        return best_score

    best_score = float("inf")

    for x, y in moves:
        history = apply_move_with_captures(board, x, y, OPPONENT_PLAYER, captures)
        score = minimax(
            board,
            captures,
            depth - 1,
            alpha,
            beta,
            True,
            start_time,
            time_limit_ms,
            stats,
            table,
        )
        undo_move_with_captures(board, captures, OPPONENT_PLAYER, history)

        if score < best_score:
            best_score = score

        if best_score < beta:
            beta = best_score

        if beta <= alpha:
            stats.cutoffs += 1
            break

    table[key] = best_score
    return best_score

