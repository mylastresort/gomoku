"""
ai package

This package contains the Gomoku AI split into small, defense-friendly modules.

The main thing you should import is:
    from ai import choose_best_move
"""

from .ai import choose_best_move, choose_best_move_with_stats

__all__ = [
    "choose_best_move",
    "choose_best_move_with_stats",
]

