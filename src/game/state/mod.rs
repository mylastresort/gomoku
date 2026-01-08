pub mod state;
pub mod types;

pub use types::{GameMove, GameStatus, Player};

use crate::game::state::types::GameState;

pub fn get_current_player(state: &GameState) -> Option<Player> {
    // get the last move from history
    if let Some(last_move) = state.history.last() {
        // determine the next player
        match last_move.game_move.player_id {
            Player::White => Some(Player::White),
            Player::Black => Some(Player::Black),
        }
    } else {
        None
    }
}
