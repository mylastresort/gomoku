use std::io::Error;

use socketioxide::extract::SocketRef;
use tracing::info;

use crate::{
    events::room::{
        board::BoardCellEvent, game_ended::GameEndedEvent,
        game_started::GameStartedEvent, win::GameWinEvent,
    },
    game::{
        room::Room,
        state::types::{GameMode, GameState, Player},
    },
    shared::types::BoardSize,
};

// game session struct to manage the state and room of a game
// each session corresponds to a single game instance
// and a single socketio room
pub struct GameSession {
    // Current state of the game session
    pub state: GameState,
    // Room associated with the game session
    pub room: Room,
    // Game mode (e.g., PvP, PvE, EvE)
    pub mode: GameMode,
}

impl Default for GameSession {
    fn default() -> Self {
        Self::new(10)
    }
}

impl GameSession {
    pub fn new(_board_size: BoardSize) -> Self {
        GameSession {
            state: GameState::new(_board_size),
            room: Room::default(),
            mode: GameMode::PvP, // Default mode
        }
    }

    // Helper: Print the current board state
    fn print_board(&self) {
        info!("Current board state:");
        info!("History length: {}", self.state.history.len());

        let size = self.state.board.len();

        // Print column headers
        let mut header = "   ".to_string();
        for col in 0..size {
            header.push_str(&format!("{:2} ", col));
        }
        info!("{}", header);

        // Print board rows
        for (row, board_row) in self.state.board.iter().enumerate() {
            let mut row_str = format!("{:2} ", row);
            for cell in board_row {
                let symbol = match cell {
                    None => " ",
                    Some(Player::Black) => "B",
                    Some(Player::White) => "W",
                };
                row_str.push_str(&format!(" {} ", symbol));
            }
            info!("{}", row_str);
        }
    }

    // Helper: Get the active room for the game session
    fn get_active_room(&self) -> Result<&Room, Error> {
        if self.room.has_room() {
            Ok(&self.room)
        } else {
            Err(Error::new(
                std::io::ErrorKind::NotFound,
                "No active room found",
            ))
        }
    }

    // Action: Start a new game session
    // creates a room once and notifies players that the game when started
    pub async fn start_game(
        &mut self,
        _s: &SocketRef,
        board_size: BoardSize,
        _mode: GameMode,
    ) {
        self.state = GameState::new(board_size);
        // Create a room and join players to push game events
        self.room.join_room(_s);
        // send notification to all players in the room that the game has started
        self.room.notify_room::<GameStartedEvent>(_s, None).await;
    }

    // Action: Process a player's move
    // notifies all players in saved room about the move
    pub async fn make_move(
        &mut self,
        _s: &SocketRef,
        x: usize,
        y: usize,
    ) -> Result<(), Error> {
        info!("Processing move at ({}, {})", x, y);
        // check if game session has an active room
        if let Err(err) = self.get_active_room() {
            return Err(err);
        }

        info!("Applying move to game state");

        // apply the move to the game state
        let game_result = match self.state.apply_move(x, y) {
            Ok(res) => res,
            Err(err) => return Err(err),
        };

        info!("Notifying players about the move");

        // check if there is a win
        if let Some(res) = game_result {
            info!("Move resulted in a game result: {:?}", res);
            if let Some(winner) = res.winner.clone() {
                info!("Player {:?} has won the game!", winner.player_id);
                // notify players about the win
                self.room
                    .notify_room::<GameWinEvent>(_s, Some(winner))
                    .await;
                // set game status to finished
                info!("Ending game session");
                self.end_game(_s).await;
            } else {
                // notify players about the move
                info!("Notifying players about the board cell update");
                self.room
                    .notify_room::<BoardCellEvent>(
                        _s,
                        Some(res.game_move.into()),
                    )
                    .await;
                // notify players about the captures
                if let Some(capture) = &res.capture {
                    info!(
                        "Player {:?} made a capture of {} pieces",
                        capture.player_id,
                        capture.seq.len()
                    );
                    // emit captures
                    capture.emit(_s, self).await;
                }
            }
            info!("Updating game state with the move");
            // commit the result
            self.state.commit(res)?;

            // Print the board after updating
            self.print_board();
        }

        Ok(())
    }

    // Action: End the current game session
    pub async fn end_game(&mut self, _s: &SocketRef) {
        // Logic to end the game
        self.room.notify_room::<GameEndedEvent>(_s, None).await;
        // Cleanup the room
        self.room.leave_room(_s);
    }

    // Action: Undo the last move in the game session
    pub async fn undo_last_move(
        &mut self,
        _s: &SocketRef,
    ) -> Result<(), Error> {
        // check if game session has an active room
        if let Err(err) = self.get_active_room() {
            return Err(err);
        }

        info!("Undoing last move");

        // revert the last move in the game state
        let undo_moves = match self.state.reset(1) {
            Ok(mv) => mv,
            Err(err) => return Err(err),
        };

        info!("Notifying players about board cells to clear");

        // Notify about the board cells that need to be cleared (set to None)
        for cell in undo_moves {
            info!(
                "Notifying to clear cell at ({}, {}, {:?})",
                cell.x, cell.y, cell.player_id
            );
            self.room
                .notify_room::<BoardCellEvent>(_s, Some(cell))
                .await;
        }

        // Print the board after undo
        self.print_board();

        Ok(())
    }
}
