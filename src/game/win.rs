use std::collections::{HashMap, HashSet};

use tracing::{info, warn};

use crate::game::{
    capture::Capture,
    state::{GameMove, Player},
};

#[derive(Clone, Debug)]
pub struct Win {
    pub player_id: Player,
    pub win_seq: Option<Vec<(usize, usize)>>,
    pub is_by_five: bool,
    pub is_flanked: bool,
}

pub trait GameWin {}

impl Win {
    const CAPTURES_TO_WIN: usize = 5;
    const STONES_TO_WIN: usize = 5;

    pub fn check_for_win(
        game_move: &GameMove,
        game_captures: &Option<Capture>,
        _board: &Vec<Vec<Option<Player>>>,
        history_captures: &HashMap<Player, (usize, HashSet<usize>)>,
    ) -> Option<Win> {
        info!("Checking for win:");

        let current_player = game_move.player_id;
        info!("Current player: {:?}", current_player);

        // Check win by captures
        if let Some(win) = game_captures.as_ref().and_then(|cap| {
            info!("Capture found: {:?}", cap);
            Self::check_win_by_captures(current_player, cap, history_captures)
        }) {
            return Some(win);
        }

        if let Some(win) = Self::check_win_by_five_in_a_row(game_move, _board) {
            return Some(win);
        }

        None
    }

    fn check_win_by_five_in_a_row(
        game_move: &GameMove,
        board: &Vec<Vec<Option<Player>>>,
    ) -> Option<Win> {
        info!("Checking for five in a row win condition");
        info!("Current player: {:?}", game_move.player_id);

        let mut flanked_win: Option<Win> = None;

        for (dx, dy) in [(1, 0), (0, 1), (1, 1), (1, -1)] {
            if let Some(win) =
                Self::check_direction_for_win(board, game_move, dx, dy)
            {
                // return immediately if non-flanked win found
                if !win.is_flanked {
                    info!("Non-flanked win found, returning immediately");
                    return Some(win);
                } else {
                    info!(
                        "Flanked win detected - storing for potential win next turn"
                    );
                    flanked_win = Some(win);
                }
            }
        }

        // Return flanked win if found (opponent has a chance to cut the line)
        flanked_win
    }

    fn check_flanked_in_direction(
        board: &Vec<Vec<Option<Player>>>,
        x: usize,
        y: usize,
        dx: isize,
        dy: isize,
        current_player: Player,
    ) -> bool {
        let opponent = current_player.opponent();

        // Count stones in both directions from current position
        let mut count = 1; // Start with current stone
        let mut forward_steps = 0;
        let mut backward_steps = 0;

        // Count forward
        let mut i = 1;
        loop {
            let nx = x as isize + i * dx;
            let ny = y as isize + i * dy;

            if !Self::is_position_in_bounds(board, nx, ny) {
                break;
            }

            if board[ny as usize][nx as usize] == Some(current_player) {
                count += 1;
                forward_steps = i;
                i += 1;
            } else {
                break;
            }
        }

        // Count backward
        let mut i = 1;
        loop {
            let nx = x as isize - i * dx;
            let ny = y as isize - i * dy;

            if !Self::is_position_in_bounds(board, nx, ny) {
                break;
            }

            if board[ny as usize][nx as usize] == Some(current_player) {
                count += 1;
                backward_steps = i;
                i += 1;
            } else {
                break;
            }
        }

        // Check if exactly 2 stones
        if count != 2 {
            return false;
        }

        // Get edge cells
        let forward_edge_x = x as isize + (forward_steps + 1) * dx;
        let forward_edge_y = y as isize + (forward_steps + 1) * dy;
        let backward_edge_x = x as isize - (backward_steps + 1) * dx;
        let backward_edge_y = y as isize - (backward_steps + 1) * dy;

        // Check if edges are in bounds
        let forward_in_bounds =
            Self::is_position_in_bounds(board, forward_edge_x, forward_edge_y);
        let backward_in_bounds = Self::is_position_in_bounds(
            board,
            backward_edge_x,
            backward_edge_y,
        );

        // Skip if one edge is out of bounds
        if !forward_in_bounds || !backward_in_bounds {
            return false;
        }

        let forward_edge =
            board[forward_edge_y as usize][forward_edge_x as usize];
        let backward_edge =
            board[backward_edge_y as usize][backward_edge_x as usize];

        // Check if one edge is empty and other is opponent
        let flanked = (forward_edge.is_none()
            && backward_edge == Some(opponent))
            || (forward_edge == Some(opponent) && backward_edge.is_none());

        if flanked {
            warn!(
                "Flanked found at ({}, {}) in direction ({}, {}): {} stones with edges {:?} and {:?}",
                x, y, dx, dy, count, backward_edge, forward_edge
            );
        }

        flanked
    }

    fn check_flanked(
        board: &Vec<Vec<Option<Player>>>,
        x: usize,
        y: usize,
        current_player: Player,
    ) -> bool {
        // Check all four directions: horizontal, vertical, and both diagonals
        for (dx, dy) in [(1, 0), (0, 1), (1, 1), (1, -1)] {
            if Self::check_flanked_in_direction(
                board,
                x,
                y,
                dx,
                dy,
                current_player,
            ) {
                return true;
            }
        }

        false
    }

    fn is_position_in_bounds(
        board: &Vec<Vec<Option<Player>>>,
        x: isize,
        y: isize,
    ) -> bool {
        x >= 0 && y >= 0 && x < board.len() as isize && y < board.len() as isize
    }

    fn count_stones_in_direction(
        board: &Vec<Vec<Option<Player>>>,
        start_x: usize,
        start_y: usize,
        dx: isize,
        dy: isize,
        direction_multiplier: isize,
        current_player: Player,
        win_seq: &mut Vec<(usize, usize)>,
    ) -> usize {
        info!("Counting stones in direction: {}", direction_multiplier);
        let mut stones = 0;
        let mut j = 1;

        loop {
            info!("Checking position offset by {} * ({}, {})", j, dx, dy);
            let nx = start_x as isize + direction_multiplier * j * dx;
            let ny = start_y as isize + direction_multiplier * j * dy;

            if !Self::is_position_in_bounds(board, nx, ny) {
                info!("Out of bounds at ({}, {}), stopping count", nx, ny);
                break;
            }

            let cell_value = board[ny as usize][nx as usize];
            info!(
                "Cell at board[{}][{}] (row={}, col={}): {:?}",
                ny, nx, ny, nx, cell_value
            );

            match cell_value {
                Some(player) if player == current_player => {
                    info!(
                        "Found stone for player {:?} at ({}, {})",
                        current_player, nx, ny
                    );
                    stones += 1;
                    win_seq.push((nx as usize, ny as usize));
                }
                Some(_) => {
                    info!("Found opponent's stone at ({}, {})", nx, ny);
                    break;
                }
                None => break,
            }
            j += 1;
        }

        stones
    }

    fn check_direction_for_win(
        board: &Vec<Vec<Option<Player>>>,
        game_move: &GameMove,
        dx: isize,
        dy: isize,
    ) -> Option<Win> {
        let current_player = game_move.player_id;
        let mut stones = 1;
        let mut win_seq = vec![(game_move.x, game_move.y)];
        let mut is_flanked = false;

        info!(
            "Checking direction dx: {}, dy: {} for five in a row",
            dx, dy
        );

        // Count stones in both directions
        for direction in [-1, 1] {
            let count = Self::count_stones_in_direction(
                board,
                game_move.x,
                game_move.y,
                dx,
                dy,
                direction,
                current_player,
                &mut win_seq,
            );
            stones += count;
        }

        info!("Total stones in a row: {}", stones);

        if stones >= Self::STONES_TO_WIN {
            // Check if any stone in the winning sequence can be flanked
            for (stone_x, stone_y) in &win_seq {
                if Self::check_flanked(
                    board,
                    *stone_x,
                    *stone_y,
                    current_player,
                ) {
                    is_flanked = true;
                    info!("Stone at ({}, {}) can be flanked", stone_x, stone_y);
                    break;
                }
            }

            info!(
                "Player {:?} has five in a row! (flanked: {})",
                current_player, is_flanked
            );
            return Some(Win {
                is_by_five: true,
                player_id: game_move.player_id,
                win_seq: Some(win_seq),
                is_flanked,
            });
        }

        None
    }

    fn check_win_by_captures(
        player: Player,
        current_capture: &Capture,
        history_captures: &HashMap<Player, (usize, HashSet<usize>)>,
    ) -> Option<Win> {
        let previous_captures = history_captures
            .get(&player)
            .map(|(count, _)| *count)
            .unwrap_or(0);

        let total_captures = previous_captures + current_capture.num_captures;

        info!(
            "Current player {:?} has {} captures",
            player, previous_captures
        );

        if total_captures >= Self::CAPTURES_TO_WIN {
            info!("Player {:?} wins by captures!", player);
            return Some(Win {
                player_id: player,
                win_seq: None,
                is_by_five: false,
                is_flanked: false,
            });
        }

        None
    }
}
