use std::io::Error;

use serde_json::json;
use socketioxide::extract::SocketRef;
use tracing::info;

use crate::{
    bridge::{PythonBridgeConfig, invoke_python_ai_from_game_state},
    events::room::{
        board::BoardCellEvent, game_ended::GameEndedEvent,
        game_started::GameStartedEvent, game_turn::GameTurnEvent,
        win::GameWinEvent,
    },
    game::{
        room::Room,
        state::types::{GameMode, GameState, GameStatus, Player},
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
    // Whether the background EvE loop is currently running.
    pub eve_loop_running: bool,
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
            eve_loop_running: false,
        }
    }

    // Helper: Print the current board state
    fn print_board(&self) {
        info!("Current board state:");
        info!("History length: {}", self.state.history.len());

        // Print captures history
        info!("Captures history:");

        for (player, (count, indices)) in &self.state.captures {
            info!(
                "Player {:?} has {} captures at moves: {:?}",
                player, count, indices
            );
        }

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

    async fn apply_and_emit_move(
        &mut self,
        _s: &SocketRef,
        x: usize,
        y: usize,
        notify_next_turn: bool,
    ) -> Result<bool, Error> {
        info!("Applying move to game state");
        let game_result = self.state.apply_move(x, y)?;

        let Some(res) = game_result else {
            return Ok(self.state.status == GameStatus::Ongoing);
        };

        info!("Notifying players about the board cell update");
        self.room
            .notify_room::<BoardCellEvent>(_s, Some(res.game_move.into()))
            .await;

        info!("Move resulted in a game result: {:?}", res);
        if let Some(capture) = &res.capture {
            info!(
                "Player {:?} made a capture of {} pieces",
                capture.player_id,
                capture.seq.len()
            );
            capture.emit(_s, self).await;
        }

        let winner = res.winner();
        if let Some(winner) = winner {
            info!("Player {:?} has won the game!", winner.player_id);
            self.room
                .notify_room::<GameWinEvent>(_s, Some(winner))
                .await;
        }

        info!("Updating game state with the move");
        self.state.commit(res)?;
        self.print_board();

        if self.state.status == GameStatus::Finished {
            info!("Ending game session");
            self.end_game(_s).await;
            return Ok(false);
        }

        if notify_next_turn {
            info!(
                "Notifying about next turn for player {:?}",
                self.state.get_current_player()
            );
            self.room
                .notify_room::<GameTurnEvent>(_s, Some(self.state.turn.clone()))
                .await;
        }

        Ok(true)
    }

    async fn play_ai_move(
        &mut self,
        _s: &SocketRef,
        ai_player: Player,
    ) -> Result<(), Error> {
        if self.state.status != GameStatus::Ongoing {
            return Ok(());
        }

        if self.state.get_current_player() != ai_player {
            return Ok(());
        }

        info!("Requesting Python AI move");
        let ai_move = invoke_python_ai_from_game_state(
            &PythonBridgeConfig::default(),
            &self.state,
            ai_player,
        )
        .map_err(|err| {
            Error::new(
                std::io::ErrorKind::Other,
                format!("Python AI failed: {err}"),
            )
        })?;

        let Some((x, y)) = ai_move else {
            return Err(Error::new(
                std::io::ErrorKind::Other,
                "Python AI did not return a move",
            ));
        };

        info!("Python AI selected move at ({}, {})", x, y);
        self.apply_and_emit_move(_s, x, y, true).await?;
        Ok(())
    }

    pub fn begin_eve_loop(&mut self) -> bool {
        if self.mode != GameMode::EvE
            || self.state.status != GameStatus::Ongoing
            || !self.room.has_room()
            || self.eve_loop_running
        {
            return false;
        }

        self.eve_loop_running = true;
        true
    }

    pub fn should_continue_eve(&self) -> bool {
        self.eve_loop_running
            && self.mode == GameMode::EvE
            && self.state.status == GameStatus::Ongoing
            && self.room.has_room()
    }

    pub fn stop_eve_loop(&mut self) {
        self.eve_loop_running = false;
    }

    pub async fn play_eve_move_once(
        &mut self,
        _s: &SocketRef,
    ) -> Result<(), Error> {
        if !self.should_continue_eve() {
            return Ok(());
        }

        let current_player = self.state.get_current_player();
        self.play_ai_move(_s, current_player).await
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
        self.mode = _mode;
        self.eve_loop_running = false;
        // Create a room and join players to push game events
        self.room.join_room(_s);
        // send notification to all players in the room that the game has started
        self.room.notify_room::<GameStartedEvent>(_s, None).await;
        // notify about the first turn
        self.room
            .notify_room::<GameTurnEvent>(_s, Some(self.state.turn.clone()))
            .await;
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

        if self.mode == GameMode::PvE
            && self.state.get_current_player() != Player::Black
        {
            return Err(Error::new(
                std::io::ErrorKind::Other,
                "Waiting for the AI move",
            ));
        }

        if self.mode == GameMode::EvE {
            return Err(Error::new(
                std::io::ErrorKind::Other,
                "Cannot make manual moves in EvE mode",
            ));
        }

        if self.mode == GameMode::PvE {
            if self.apply_and_emit_move(_s, x, y, false).await? {
                self.play_ai_move(_s, Player::White).await?;
            }
            return Ok(());
        }

        self.apply_and_emit_move(_s, x, y, true).await?;

        Ok(())
    }

    // Action: End the current game session
    pub async fn end_game(&mut self, _s: &SocketRef) {
        // Logic to end the game
        self.stop_eve_loop();
        self.state.status = GameStatus::Finished;
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

    pub async fn request_move_hint(
        &mut self,
        _s: &SocketRef,
    ) -> Result<(), Error> {
        // check if game session has an active room
        if let Err(err) = self.get_active_room() {
            return Err(err);
        }

        if self.state.status != GameStatus::Ongoing {
            return Err(Error::new(
                std::io::ErrorKind::Other,
                "Cannot request hint: game is not ongoing",
            ));
        }

        let current_player = self.state.get_current_player();
        info!(
            "Requesting Python AI hint for current player {:?}",
            current_player
        );

        let ai_move = invoke_python_ai_from_game_state(
            &PythonBridgeConfig::default(),
            &self.state,
            current_player,
        )
        .map_err(|err| {
            Error::new(
                std::io::ErrorKind::Other,
                format!("Python AI hint failed: {err}"),
            )
        })?;

        let Some((x, y)) = ai_move else {
            return Err(Error::new(
                std::io::ErrorKind::Other,
                "Python AI did not return a hint",
            ));
        };

        info!("Emitting move hint at ({}, {})", x, y);
        let _ = _s.emit(
            "move-hint",
            &json!({
                "x": x,
                "y": y,
                "player_id": current_player,
            }),
        );

        Ok(())
    }
}
