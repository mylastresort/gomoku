"""
compatibility wrapper
"""

from __future__ import annotations

# Public API
from .ai import choose_best_move, choose_best_move_with_stats

# Commonly used constants
from .constants import (
    AI_PLAYER,
    BOARD_SIZE,
    DEFAULT_MAX_DEPTH,
    DEFAULT_TIME_LIMIT_MS,
    DIRECTIONS,
    EMPTY,
    LOSE_SCORE,
    NEIGHBOR_RADIUS,
    OPPONENT_PLAYER,
    WIN_SCORE,
)

# Types / result objects
from .types import Board, Move, SearchResult, SearchStats

# Helpers & rules (used by tests / debugging)
from .board import board_key, create_board, get_cell, get_opponent, is_in_bounds
from .captures import apply_move_with_captures, undo_move_with_captures
from .heuristic import evaluate_board, pattern_score, score_player
from .rules import (
    can_break_opponent_five_by_capture,
    check_five_in_a_row,
    count_free_threes,
    get_candidate_moves,
    get_legal_moves,
    get_terminal_score,
    has_open_four_in_direction,
    has_player_won,
    is_free_three_in_direction,
    is_legal_move,
)
from .search import minimax, move_order_score, order_moves

__all__ = [
    # API
    "choose_best_move",
    "choose_best_move_with_stats",
    # constants
    "BOARD_SIZE",
    "EMPTY",
    "AI_PLAYER",
    "OPPONENT_PLAYER",
    "WIN_SCORE",
    "LOSE_SCORE",
    "DEFAULT_MAX_DEPTH",
    "DEFAULT_TIME_LIMIT_MS",
    "NEIGHBOR_RADIUS",
    "DIRECTIONS",
    # types / debug
    "Board",
    "Move",
    "SearchStats",
    "SearchResult",
    # helpers
    "create_board",
    "is_in_bounds",
    "get_opponent",
    "get_cell",
    "board_key",
    # rules / mechanics
    "check_five_in_a_row",
    "has_player_won",
    "apply_move_with_captures",
    "undo_move_with_captures",
    "get_candidate_moves",
    "has_open_four_in_direction",
    "is_free_three_in_direction",
    "count_free_threes",
    "is_legal_move",
    "get_legal_moves",
    "can_break_opponent_five_by_capture",
    "get_terminal_score",
    # heuristic
    "pattern_score",
    "score_player",
    "evaluate_board",
    # search
    "move_order_score",
    "order_moves",
    "minimax",
]