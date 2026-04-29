from __future__ import annotations

import json
import sys

from .ai import choose_best_move
from .constants import (
    AI_PLAYER,
    BOARD_SIZE,
    DEFAULT_MAX_DEPTH,
    DEFAULT_TIME_LIMIT_MS,
    EMPTY,
    OPPONENT_PLAYER,
)


def _to_ai_board(rows: list, ai_is_black: bool) -> list[list[int]]:
    out: list[list[int]] = []
    for row in rows:
        r: list[int] = []
        for c in row:
            if c is None or c == 0:
                r.append(EMPTY)
            elif c == 1:
                r.append(AI_PLAYER if ai_is_black else OPPONENT_PLAYER)
            elif c == 2:
                r.append(OPPONENT_PLAYER if ai_is_black else AI_PLAYER)
            else:
                raise ValueError("invalid cell")
        out.append(r)
    return out


def main() -> None:
    data = json.load(sys.stdin)
    rows = data["board"]
    if len(rows) != BOARD_SIZE or any(len(r) != BOARD_SIZE for r in rows):
        print(
            json.dumps({"ok": False, "error": "board size mismatch"}),
            flush=True,
        )
        sys.exit(1)
    ai = data["ai"]
    ai_is_black = ai == "Black"
    black_captures = int(data.get("black_captures", 0))
    white_captures = int(data.get("white_captures", 0))
    if ai_is_black:
        ai_captures = black_captures
        opponent_captures = white_captures
    else:
        ai_captures = white_captures
        opponent_captures = black_captures
    max_depth = int(data.get("max_depth", DEFAULT_MAX_DEPTH))
    time_limit_ms = int(data.get("time_limit_ms", DEFAULT_TIME_LIMIT_MS))
    board = _to_ai_board(rows, ai_is_black)
    move = choose_best_move(
        board,
        max_depth=max_depth,
        ai_captures=ai_captures,
        opponent_captures=opponent_captures,
        time_limit_ms=time_limit_ms,
    )
    if move is None:
        print(json.dumps({"ok": True, "move": None}), flush=True)
    else:
        x, y = move
        print(json.dumps({"ok": True, "move": [x, y]}), flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)}), flush=True)
        sys.exit(1)
