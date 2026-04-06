from typing import List, Optional, Tuple

# ==================================================
# Constants
# ==================================================

BOARD_SIZE = 19

EMPTY = 0
AI_PLAYER = 1
OPPONENT_PLAYER = 2

WIN_SCORE = 10_000_000
LOSE_SCORE = -10_000_000

DEFAULT_DEPTH = 3
NEIGHBOR_RADIUS = 2

DIRECTIONS = [
    (1, 0),   # horizontal
    (0, 1),   # vertical
    (1, 1),   # diagonal down-right
    (1, -1),  # diagonal up-right
]

Board = List[List[int]]
Move = Tuple[int, int]


# ==================================================
# Basic helpers
# ==================================================

def create_board() -> Board:
    return [[EMPTY for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]


def is_in_bounds(x: int, y: int) -> bool:
    return 0 <= x < BOARD_SIZE and 0 <= y < BOARD_SIZE


def get_opponent(player: int) -> int:
    return AI_PLAYER if player == OPPONENT_PLAYER else OPPONENT_PLAYER


def get_cell(board: Board, x: int, y: int) -> int:
    if not is_in_bounds(x, y):
        return -1
    return board[y][x]


# ==================================================
# Win detection
# ==================================================

def check_five_in_a_row(board: Board, x: int, y: int, player: int) -> bool:
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
    for y in range(BOARD_SIZE):
        for x in range(BOARD_SIZE):
            if board[y][x] == player and check_five_in_a_row(board, x, y, player):
                return True
    return False


# ==================================================
# Captures
# ==================================================

def apply_move_with_captures(
    board: Board,
    x: int,
    y: int,
    player: int,
    captures: dict[int, int],
) -> List[Tuple[int, int, int]]:
    """
    Place the stone and apply captures.

    Returns a history list:
    - first item is always the placed stone
    - next items are removed stones, so undo is easy

    Each history entry is (x, y, previous_value).
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
    captures: dict[int, int],
    player: int,
    history: List[Tuple[int, int, int]],
) -> None:
    """
    Undo a move made by apply_move_with_captures.
    """
    removed_count = len(history) - 1
    captures[player] -= removed_count

    for hx, hy, old_value in reversed(history):
        board[hy][hx] = old_value


def is_winning_move_by_alignment(board: Board, x: int, y: int, player: int) -> bool:
    if board[y][x] != EMPTY:
        return False
    board[y][x] = player
    won = check_five_in_a_row(board, x, y, player)
    board[y][x] = EMPTY
    return won


# ==================================================
# Candidate moves
# ==================================================

def get_candidate_moves(board: Board) -> List[Move]:
    stones = []

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
        coords = []
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
    A simple and practical free-three test:
    after placing at (x, y), if one extra move in the same direction
    can create an open four, then this direction contains a free-three.
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
    captures: dict[int, int],
) -> bool:
    """
    Rule used here:
    - occupied cell => illegal
    - if the move captures, it is legal even if it creates double-three
    - otherwise, a move creating 2 or more free-threes is illegal
    """
    if not is_in_bounds(x, y) or board[y][x] != EMPTY:
        return False

    history = apply_move_with_captures(board, x, y, player, captures)
    made_capture = len(history) > 1

    legal = True
    if not made_capture:
        if count_free_threes(board, player, x, y) >= 2:
            legal = False

    undo_move_with_captures(board, captures, player, history)
    return legal


def get_legal_moves(
    board: Board,
    player: int,
    captures: dict[int, int],
) -> List[Move]:
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
    captures: dict[int, int],
) -> bool:
    """
    Return True if the opponent has at least one legal move
    that captures and removes the five-in-a-row threat.
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


def get_terminal_score(
    board: Board,
    captures: dict[int, int],
) -> Optional[int]:
    """
    Return terminal score if game is finished, else None.

    Priority:
    1) capture win (10 stones captured)
    2) five-in-row that cannot be broken by capture
    """
    if captures[AI_PLAYER] >= 10:
        return WIN_SCORE

    if captures[OPPONENT_PLAYER] >= 10:
        return LOSE_SCORE

    ai_has_five = has_player_won(board, AI_PLAYER)
    opp_has_five = has_player_won(board, OPPONENT_PLAYER)

    if ai_has_five:
        if not can_break_opponent_five_by_capture(board, AI_PLAYER, captures):
            return WIN_SCORE

    if opp_has_five:
        if not can_break_opponent_five_by_capture(board, OPPONENT_PLAYER, captures):
            return LOSE_SCORE

    return None


# ==================================================
# Heuristic
# ==================================================

def pattern_score(length: int, open_ends: int) -> float:
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
    total = 0.0

    for y in range(BOARD_SIZE):
        for x in range(BOARD_SIZE):
            if board[y][x] != player:
                continue

            for dx, dy in DIRECTIONS:
                prev_x = x - dx
                prev_y = y - dy

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


def evaluate_board(board: Board, captures: dict[int, int]) -> float:
    score = score_player(board, AI_PLAYER) - score_player(board, OPPONENT_PLAYER)

    # Captures matter a lot in this subject
    score += captures[AI_PLAYER] * 1200
    score -= captures[OPPONENT_PLAYER] * 1200

    return score


# ==================================================
# Minimax
# ==================================================

def minimax(
    board: Board,
    captures: dict[int, int],
    depth: int,
    alpha: float,
    beta: float,
    maximizing: bool,
) -> float:
    terminal = get_terminal_score(board, captures)
    if terminal is not None:
        return terminal

    if depth == 0:
        return evaluate_board(board, captures)

    current_player = AI_PLAYER if maximizing else OPPONENT_PLAYER
    moves = get_legal_moves(board, current_player, captures)

    if not moves:
        return evaluate_board(board, captures)

    if maximizing:
        best_score = float("-inf")

        for x, y in moves:
            history = apply_move_with_captures(board, x, y, AI_PLAYER, captures)
            score = minimax(board, captures, depth - 1, alpha, beta, False)
            undo_move_with_captures(board, captures, AI_PLAYER, history)

            if score > best_score:
                best_score = score

            if best_score > alpha:
                alpha = best_score

            if beta <= alpha:
                break

        return best_score

    else:
        best_score = float("inf")

        for x, y in moves:
            history = apply_move_with_captures(board, x, y, OPPONENT_PLAYER, captures)
            score = minimax(board, captures, depth - 1, alpha, beta, True)
            undo_move_with_captures(board, captures, OPPONENT_PLAYER, history)

            if score < best_score:
                best_score = score

            if best_score < beta:
                beta = best_score

            if beta <= alpha:
                break

        return best_score


# ==================================================
# Public API
# ==================================================

def choose_best_move(
    board: Board,
    depth: int = DEFAULT_DEPTH,
    ai_captures: int = 0,
    opponent_captures: int = 0,
) -> Optional[Move]:
    """
    Main function to call from backend later.

    Parameters:
    - board: 19x19 matrix
    - depth: minimax depth
    - ai_captures: number of stones already captured by AI
    - opponent_captures: number of stones already captured by opponent

    Returns:
    - (x, y) best move
    - None if no legal move exists
    """
    captures = {
        AI_PLAYER: ai_captures,
        OPPONENT_PLAYER: opponent_captures,
    }

    legal_moves = get_legal_moves(board, AI_PLAYER, captures)
    if not legal_moves:
        return None

    # 1) Immediate terminal win by capture or safe five
    for x, y in legal_moves:
        history = apply_move_with_captures(board, x, y, AI_PLAYER, captures)
        terminal = get_terminal_score(board, captures)
        undo_move_with_captures(board, captures, AI_PLAYER, history)

        if terminal == WIN_SCORE:
            return (x, y)

    # 2) Block opponent immediate terminal win if possible
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
            return move

    # 3) Minimax search
    best_move = None
    best_score = float("-inf")

    for x, y in legal_moves:
        history = apply_move_with_captures(board, x, y, AI_PLAYER, captures)
        score = minimax(board, captures, depth - 1, float("-inf"), float("inf"), False)
        undo_move_with_captures(board, captures, AI_PLAYER, history)

        if score > best_score:
            best_score = score
            best_move = (x, y)

    return best_move