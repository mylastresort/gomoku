from ai.gomoku_ai import (
    AI_PLAYER,
    OPPONENT_PLAYER,
    create_board,
    choose_best_move,
    choose_best_move_with_stats,
    apply_move_with_captures,
    undo_move_with_captures,
    get_terminal_score,
    is_legal_move,
)

# -----------------------------------------
# Small helpers
# -----------------------------------------

def print_board(board):
    symbols = {
        0: ".",
        AI_PLAYER: "X",
        OPPONENT_PLAYER: "O",
    }

    print("   " + " ".join(f"{i:02}" for i in range(len(board[0]))))
    for y, row in enumerate(board):
        print(f"{y:02} " + " ".join(symbols[cell] for cell in row))
    print()


def make_captures(ai=0, opp=0):
    return {
        AI_PLAYER: ai,
        OPPONENT_PLAYER: opp,
    }


def run_test(name, func):
    print(f"===== {name} =====")
    try:
        func()
        print("PASS\n")
    except AssertionError as e:
        print("FAIL:", e, "\n")
    except Exception as e:
        print("ERROR:", e, "\n")


# -----------------------------------------
# Tests
# -----------------------------------------

def test_empty_board_center():
    board = create_board()
    move = choose_best_move(board)
    assert move == (9, 9), f"expected (9, 9), got {move}"


def test_ai_finishes_five():
    board = create_board()

    # X X X X .
    board[9][5] = AI_PLAYER
    board[9][6] = AI_PLAYER
    board[9][7] = AI_PLAYER
    board[9][8] = AI_PLAYER

    move = choose_best_move(board)
    assert move in [(4, 9), (9, 9)], f"expected winning move at (4,9) or (9,9), got {move}"


def test_ai_blocks_opponent_five():
    board = create_board()

    # O O O O .
    board[9][5] = OPPONENT_PLAYER
    board[9][6] = OPPONENT_PLAYER
    board[9][7] = OPPONENT_PLAYER
    board[9][8] = OPPONENT_PLAYER

    move = choose_best_move(board)
    assert move in [(4, 9), (9, 9)], f"expected block at (4,9) or (9,9), got {move}"


def test_capture_application_and_undo():
    board = create_board()
    captures = make_captures()

    # X O O .
    # AI plays at the dot and captures the 2 O stones
    board[9][5] = AI_PLAYER
    board[9][6] = OPPONENT_PLAYER
    board[9][7] = OPPONENT_PLAYER

    history = apply_move_with_captures(board, 8, 9, AI_PLAYER, captures)

    assert board[9][8] == AI_PLAYER, "AI stone should be placed"
    assert board[9][6] == 0 and board[9][7] == 0, "captured stones should be removed"
    assert captures[AI_PLAYER] == 2, f"expected AI captures = 2, got {captures[AI_PLAYER]}"

    undo_move_with_captures(board, captures, AI_PLAYER, history)

    assert board[9][8] == 0, "placed stone should be removed after undo"
    assert board[9][6] == OPPONENT_PLAYER and board[9][7] == OPPONENT_PLAYER, "captured stones should be restored"
    assert captures[AI_PLAYER] == 0, f"expected AI captures back to 0, got {captures[AI_PLAYER]}"


def test_capture_win_terminal():
    board = create_board()
    captures = make_captures(ai=10, opp=0)

    terminal = get_terminal_score(board, captures)
    assert terminal is not None, "game should be terminal when AI has 10 captures"
    assert terminal > 0, f"expected positive terminal score, got {terminal}"


def test_simple_double_three_illegal():
    board = create_board()
    captures = make_captures()

    # Build a classic cross shape around (9,9)
    #
    # Horizontal around center:
    # . X . X .
    # Vertical around center:
    # . X . X .
    #
    # Playing at (9,9) creates two free-threes in many practical implementations.
    board[9][8] = AI_PLAYER
    board[9][10] = AI_PLAYER
    board[8][9] = AI_PLAYER
    board[10][9] = AI_PLAYER

    legal = is_legal_move(board, 9, 9, AI_PLAYER, captures)
    assert legal is False, f"expected move (9,9) to be illegal due to double-three, got {legal}"


def test_capture_move_can_still_be_legal():
    board = create_board()
    captures = make_captures()

    # Simple capture pattern:
    # X O O .
    # AI plays at the dot
    board[9][5] = AI_PLAYER
    board[9][6] = OPPONENT_PLAYER
    board[9][7] = OPPONENT_PLAYER

    legal = is_legal_move(board, 8, 9, AI_PLAYER, captures)
    assert legal is True, f"expected capture move to be legal, got {legal}"


def test_choose_best_move_with_stats():
    board = create_board()

    board[9][9] = AI_PLAYER
    board[9][10] = OPPONENT_PLAYER
    board[10][10] = AI_PLAYER

    result = choose_best_move_with_stats(board, max_depth=3, time_limit_ms=300)

    assert result.move is not None, "expected a move"
    assert result.depth_reached >= 1, f"expected depth_reached >= 1, got {result.depth_reached}"
    assert result.stats.nodes >= 1, f"expected nodes >= 1, got {result.stats.nodes}"
    assert result.stats.elapsed_ms >= 0, f"expected elapsed time >= 0, got {result.stats.elapsed_ms}"


def test_print_example_position():
    board = create_board()
    board[9][9] = AI_PLAYER
    board[9][10] = OPPONENT_PLAYER
    board[10][10] = AI_PLAYER
    print_board(board)


# -----------------------------------------
# Main
# -----------------------------------------

if __name__ == "__main__":
    run_test("Empty board -> center", test_empty_board_center)
    run_test("AI finishes five", test_ai_finishes_five)
    run_test("AI blocks opponent five", test_ai_blocks_opponent_five)
    run_test("Capture apply + undo", test_capture_application_and_undo)
    run_test("Capture win terminal", test_capture_win_terminal)
    run_test("Simple double-three illegal", test_simple_double_three_illegal)
    run_test("Capture move stays legal", test_capture_move_can_still_be_legal)
    run_test("Search stats available", test_choose_best_move_with_stats)
    run_test("Board print example", test_print_example_position)