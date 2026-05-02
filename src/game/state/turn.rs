use crate::{
    game::{
        capture::Capture,
        state::{GameMove, Player, types::GameTurn},
    },
    shared::types::Board,
};

const NEIGHBOR_RADIUS: isize = 2;
const DIRECTIONS: &[(isize, isize)] = &[(1, 0), (0, 1), (1, 1), (1, -1)];

impl GameTurn {
    pub fn update(&mut self, current_player: &Player, _board: &Board) {
        self.turn += 1;
        self.current_player = *current_player;
        self.forbidden_sequences =
            Self::get_forbidden_moves(_board, &self.current_player);
    }

    pub fn get_forbidden_moves(
        _board: &Board,
        _current_player: &Player,
    ) -> Vec<(usize, usize)> {
        let mut forbidden: Vec<(usize, usize)> = Vec::new();
        let n = _board.len() as isize;

        let in_bounds = |x: isize, y: isize| -> bool {
            x >= 0 && y >= 0 && x < n && y < n
        };

        let is_opponent = |cell: Option<Player>| -> bool {
            matches!(cell, Some(p) if p != *_current_player)
        };

        // Collect all existing stones to seed candidate generation
        let mut stones: Vec<(isize, isize)> = Vec::new();
        for (y, row) in _board.iter().enumerate() {
            for (x, cell) in row.iter().enumerate() {
                if cell.is_some() {
                    stones.push((x as isize, y as isize));
                }
            }
        }

        if stones.is_empty() {
            return forbidden;
        }

        // Candidate empty cells: every empty intersection within
        // NEIGHBOR_RADIUS of any existing stone
        let mut candidates: std::collections::HashSet<(isize, isize)> =
            std::collections::HashSet::new();
        for &(sx, sy) in &stones {
            for dy in -NEIGHBOR_RADIUS..=NEIGHBOR_RADIUS {
                for dx in -NEIGHBOR_RADIUS..=NEIGHBOR_RADIUS {
                    let nx = sx + dx;
                    let ny = sy + dy;
                    if in_bounds(nx, ny)
                        && _board[ny as usize][nx as usize].is_none()
                    {
                        candidates.insert((nx, ny));
                    }
                }
            }
        }

        // ----------------------------------------------------------------
        // Rule 1 helper — suicide (move into a capture)
        //
        // After placing current_player at (x, y), check whether the placed
        // stone forms a consecutive pair with an adjacent ally that is
        // already flanked on both outer ends by opponent stones, making it
        // immediately capturable by the opponent.
        //
        // For each axis direction we probe both orientations so every
        // possible pair alignment is covered.
        // ----------------------------------------------------------------
        let is_suicide = |board: &Board, x: isize, y: isize| -> bool {
            for &(dx, dy) in DIRECTIONS.iter() {
                for &(ax, ay) in &[(dx, dy), (-dx, -dy)] {
                    let partner_x = x + ax;
                    let partner_y = y + ay;
                    if !in_bounds(partner_x, partner_y) {
                        continue;
                    }
                    if board[partner_y as usize][partner_x as usize]
                        != Some(*_current_player)
                    {
                        continue;
                    }
                    // far flank: one step past the partner
                    let far_x = partner_x + ax;
                    let far_y = partner_y + ay;
                    // near flank: one step behind the placed stone
                    let near_x = x - ax;
                    let near_y = y - ay;
                    if !in_bounds(far_x, far_y) || !in_bounds(near_x, near_y) {
                        continue;
                    }
                    if is_opponent(board[far_y as usize][far_x as usize])
                        && is_opponent(board[near_y as usize][near_x as usize])
                    {
                        return true;
                    }
                }
            }
            false
        };

        // ----------------------------------------------------------------
        // Rule 2 helper — free-three detection in one direction
        //
        // Scans every window of 4 cells along (dx, dy) that contains (x, y).
        // A window is a free-three when:
        //   - it contains exactly 3 current-player stones and 1 empty cell
        //     (no opponent stone anywhere in the window)
        //   - both cells immediately outside the window are in-bounds and empty
        //     (= the window can become a genuine open four in one move)
        //
        // Covers both contiguous (●●●_) and gapped (●_●●) shapes because
        // the single empty cell in the window can sit at any of the 4 positions.
        // No second stone placement is simulated — detection is direct on the
        // board state after the candidate stone has been placed.
        // ----------------------------------------------------------------
        let has_free_three_in_direction = |board: &Board,
                                            player: Player,
                                            x: isize,
                                            y: isize,
                                            dx: isize,
                                            dy: isize|
         -> bool {
            for offset in -3isize..=0 {
                let mut valid = true;
                let mut player_count = 0usize;
                let mut empty_count = 0usize;
                let mut contains_xy = false;

                for i in 0..4isize {
                    let cx = x + (offset + i) * dx;
                    let cy = y + (offset + i) * dy;
                    if !in_bounds(cx, cy) {
                        valid = false;
                        break;
                    }
                    if cx == x && cy == y {
                        contains_xy = true;
                    }
                    match board[cy as usize][cx as usize] {
                        Some(p) if p == player => player_count += 1,
                        None => empty_count += 1,
                        // opponent stone in the window → not a free-three window
                        _ => {
                            valid = false;
                            break;
                        }
                    }
                }

                if !valid || !contains_xy || player_count != 3 || empty_count != 1 {
                    continue;
                }

                // Window extremities: one step outside each end
                // Window spans x + offset*d  ..  x + (offset+3)*d
                // Left end  = x + (offset - 1) * d
                // Right end = x + (offset + 4) * d
                let left_x = x + (offset - 1) * dx;
                let left_y = y + (offset - 1) * dy;
                let right_x = x + (offset + 4) * dx;
                let right_y = y + (offset + 4) * dy;

                if in_bounds(left_x, left_y)
                    && in_bounds(right_x, right_y)
                    && board[left_y as usize][left_x as usize].is_none()
                    && board[right_y as usize][right_x as usize].is_none()
                {
                    return true;
                }
            }
            false
        };

        // Count how many distinct axis directions form a free-three at (x,y)
        let count_free_threes =
            |board: &Board, player: Player, x: isize, y: isize| -> usize {
                DIRECTIONS
                    .iter()
                    .filter(|&&(dx, dy)| {
                        has_free_three_in_direction(board, player, x, y, dx, dy)
                    })
                    .count()
            };

        // ----------------------------------------------------------------
        // Main loop — evaluate every candidate
        // ----------------------------------------------------------------
        for (cx, cy) in candidates {
            let x = cx as usize;
            let y = cy as usize;

            // Simulate placing the stone once; both rules share this board
            let mut board_after = _board.clone();
            board_after[y][x] = Some(*_current_player);

            // Rule 1: suicide — placed stone immediately capturable
            if is_suicide(&board_after, cx, cy) {
                forbidden.push((x, y));
                continue;
            }

            // Rule 2: double-three
            // Exception: if the same move also captures opponent stones it
            // is legal regardless of how many free-threes it introduces.
            let gm = GameMove { x, y, player_id: *_current_player };
            if Capture::find_captures(&board_after, &gm).is_none()
                && count_free_threes(&board_after, *_current_player, cx, cy) >= 2
            {
                forbidden.push((x, y));
            }
        }

        forbidden
    }
}