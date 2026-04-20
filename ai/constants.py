"""
constants.py

Small shared constants for the Gomoku AI (board size, players, scoring, directions).
Kept in one place so the rest of the code reads clearly.
"""

BOARD_SIZE = 19

EMPTY = 0
AI_PLAYER = 1
OPPONENT_PLAYER = 2

WIN_SCORE = 10_000_000
LOSE_SCORE = -10_000_000

DEFAULT_MAX_DEPTH = 10
DEFAULT_TIME_LIMIT_MS = 450
NEIGHBOR_RADIUS = 2

# (dx, dy) directions used for lines, captures, and pattern checks.
DIRECTIONS = [
    (1, 0),   # horizontal
    (0, 1),   # vertical
    (1, 1),   # diagonal down-right
    (1, -1),  # diagonal up-right
]

