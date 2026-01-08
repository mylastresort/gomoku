use std::{collections::HashSet, io::Error};

use tracing::info;

use crate::{
    events::room::board::BoardCell,
    game::{
        capture::Capture,
        state::{
            GameMove, GameStatus, Player,
            types::{GameResult, GameState},
        },
        win::Win,
    },
};

impl Default for GameState {
    fn default() -> Self {
        GameState {
            board: vec![],
            history: vec![],
            status: GameStatus::Ongoing,
            captures: std::collections::HashMap::new(),
        }
    }
}

impl GameState {
    pub fn new(size: u16) -> Self {
        GameState {
            board: vec![vec![None; size as usize]; size as usize],
            history: vec![],
            status: GameStatus::Ongoing,
            captures: std::collections::HashMap::new(),
        }
    }

    pub fn set_status(&mut self, status: GameStatus) {
        self.status = status;
    }

    pub fn get_current_player(&self) -> Player {
        if let Some(last_move) = self.history.last() {
            last_move.game_move.player_id.opponent()
        } else {
            Player::Black // Black starts first
        }
    }

    pub fn apply_move(
        &mut self,
        x: usize,
        y: usize,
    ) -> Result<Option<GameResult>, Error> {
        // check if game state is ongoing
        info!("Checking if game is ongoing");
        if self.status == GameStatus::Finished {
            return Err(Error::new(
                std::io::ErrorKind::Other,
                "Cannot apply move: Game has already finished",
            ));
        }

        info!("Validating move at ({}, {})", x, y);

        // check if move is within bounds
        if (x) >= self.board.len() || (y) >= self.board.len() {
            return Err(Error::new(
                std::io::ErrorKind::InvalidInput,
                "Move is out of bounds",
            ));
        }

        info!("Checking if cell is already occupied");

        // check if the cell is already occupied
        if self.board[y][x].is_some() {
            return Err(Error::new(
                std::io::ErrorKind::InvalidInput,
                "Cell is already occupied",
            ));
        }

        info!("Determining current player");

        let cur = self.get_current_player();

        info!("Creating game move for player {:?}", cur);

        let game_move = GameMove {
            x,
            y,
            player_id: cur,
        };

        info!("Evaluating move");

        let res = self.eval_move(game_move);

        info!("Move evaluated successfully: {:?}", res);

        Ok(Some(res))
    }

    pub fn eval_move(&self, game_move: GameMove) -> GameResult {
        info!("Finding captures for the move");
        let cap = Capture::find_capture(&self.board, &game_move);

        info!("Checking for win condition");

        let res = GameResult {
            game_move,
            capture: cap.clone(),
            winner: Win::check_for_win(&game_move, &cap),
        };

        res
    }

    pub fn commit(&mut self, result: GameResult) -> Result<(), Error> {
        info!("Committing move to game state");
        // set the cell on the board
        self.board[result.game_move.y][result.game_move.x] =
            Some(result.game_move.player_id);

        info!("Updating captures");
        // check for captures and update captures map
        if let Some(capture) = &result.capture {
            info!("Recording capture for player {:?}", capture.player_id);
            let entry = self
                .captures
                .entry(capture.player_id.opponent())
                .or_insert_with(HashSet::new);
            info!("Adding capture at move index {}", self.history.len());
            entry.insert(self.history.len());
        }

        // check if there is a winner and finish the game
        info!("Checking for game completion");
        if result.winner.is_some() {
            self.status = GameStatus::Finished;
        }

        info!("Adding move to history");
        // add the result to history
        self.history.push(result);
        Ok(())
    }

    pub fn reset(&mut self, count: usize) -> Result<Vec<BoardCell>, Error> {
        let mut ret: Vec<BoardCell> = Vec::new();

        for _ in 0..count {
            // check if there are moves to undo
            if let Some(last_move) = self.history.pop() {
                let gs_index = self.history.len();
                self.board[last_move.game_move.y][last_move.game_move.x] = None;
                // loop through captures and restore them
                if let Some(capture) = last_move.capture {
                    for (x, y) in capture.seq {
                        self.board[y][x] = Some(capture.player_id);
                        ret.push(BoardCell {
                            x,
                            y,
                            player_id: Some(capture.player_id),
                        });
                    }
                    // remove captures from the captures map
                    if let Some(capture_set) =
                        self.captures.get_mut(&capture.player_id.opponent())
                    {
                        capture_set.remove(&gs_index);
                    }
                }
                ret.push(BoardCell {
                    x: last_move.game_move.x,
                    y: last_move.game_move.y,
                    player_id: None,
                });
            } else {
                return Err(Error::new(
                    std::io::ErrorKind::Other,
                    "No moves to undo",
                ));
            }
        }
        Ok(ret)
    }
}
