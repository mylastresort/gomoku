use std::io::Error;

use socketioxide::extract::SocketRef;

use crate::{
    events::room::{
        board::{BoardCell, BoardCellEvent},
        game_ended::GameEndedEvent,
        game_started::GameStartedEvent,
    },
    game::{
        room::Room,
        state::{
            GameMove,
            types::{GameMode, GameState},
        },
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
    pub fn start_game(
        &mut self,
        _s: &SocketRef,
        board_size: BoardSize,
        _mode: GameMode,
    ) {
        self.state = GameState::new(board_size);
        // Create a room and join players to push game events
        self.room.join_room(_s);
        // send notification to all players in the room that the game has started
        self.room.notify_room::<GameStartedEvent>(_s, None);
    }

    // Action: Process a player's move
    // notifies all players in saved room about the move
    pub fn make_move(
        &mut self,
        _s: &SocketRef,
        _move: GameMove,
    ) -> Result<(), Error> {
        // check if game session has an active room
        if let Err(err) = self.get_active_room() {
            return Err(err);
        }

        // apply the move to the game state and save optional captures
        let captures = match self.state.apply_move(_move) {
            Ok(captures) => {
                // Notify players about the move
                self.room.notify_room::<BoardCellEvent>(
                    _s,
                    Some(BoardCell {
                        x: _move.x,
                        y: _move.y,
                        player_id: Some(_move.player_id),
                    }),
                );
                captures
            }
            Err(err) => return Err(err),
        };

        // Notify players about captures if any
        if let Some(cap) = captures {
            cap.emit(_s, self);
        }

        if self.mode == GameMode::PvE {
            todo!("Implement AI move logic here");
        }

        Ok(())
    }

    // Action: End the current game session
    pub fn end_game(&mut self, _s: &SocketRef) {
        // Logic to end the game
        self.room.notify_room::<GameEndedEvent>(_s, None);
        // Cleanup the room
        self.room.leave_room(_s);
    }

    // Action: Undo the last move in the game session
    pub fn undo_last_move(&mut self, _s: &SocketRef) -> Result<(), Error> {
        // check if game session has an active room
        if let Err(err) = self.get_active_room() {
            return Err(err);
        }

        // revert the last move in the game state
        let undo_move = match self.state.undo_last_move() {
            Ok(mv) => mv,
            Err(err) => return Err(err),
        };

        // Notify players about the undo action
        self.room.notify_room::<BoardCellEvent>(
            _s,
            Some(BoardCell {
                x: undo_move.x,
                y: undo_move.y,
                player_id: None,
            }),
        );

        Ok(())
    }
}
