use std::io::Error;

use crate::game::{
    capture::{Capture, check_for_captures},
    state::{GameMove, GameStatus, get_current_player, types::GameState},
};

impl Default for GameState {
    fn default() -> Self {
        GameState {
            board: vec![],
            history: vec![],
            status: GameStatus::Ongoing,
        }
    }
}

impl GameState {
    pub fn new(size: u16) -> Self {
        GameState {
            board: vec![vec![None; size as usize]; size as usize],
            history: vec![],
            status: GameStatus::Ongoing,
        }
    }

    pub fn apply_move(
        &mut self,
        game_move: GameMove,
    ) -> Result<Option<Capture>, Error> {
        // check if game state is ongoing
        if self.status == GameStatus::Finished {
            return Err(Error::new(
                std::io::ErrorKind::Other,
                "Cannot apply move: Game has already finished",
            ));
        }

        // check if the player has already made a move
        if let Some(cur) = get_current_player(self) {
            if cur == game_move.player_id {
                return Err(Error::new(
                    std::io::ErrorKind::InvalidInput,
                    "It's not the player's turn",
                ));
            }
        }

        // check if move is within bounds
        if (game_move.x as usize) >= self.board.len()
            || (game_move.y as usize) >= self.board.len()
        {
            return Err(Error::new(
                std::io::ErrorKind::InvalidInput,
                "Move is out of bounds",
            ));
        }

        // check if the cell is already occupied
        if self.board[game_move.y as usize][game_move.x as usize].is_some() {
            return Err(Error::new(
                std::io::ErrorKind::InvalidInput,
                "Cell is already occupied",
            ));
        }

        // apply the move
        self.board[game_move.y as usize][game_move.x as usize] =
            Some(game_move);
        self.history.push(game_move);

        Ok(check_for_captures(self, &game_move))
    }

    pub fn undo_last_move(&mut self) -> Result<GameMove, Error> {
        // check if there are moves to undo
        if let Some(last_move) = self.history.pop() {
            self.board[last_move.y as usize][last_move.x as usize] = None;
            // return the undone move
            Ok(last_move)
        } else {
            Err(Error::new(std::io::ErrorKind::Other, "No moves to undo"))
        }
    }
}
