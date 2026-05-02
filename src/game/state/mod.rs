pub mod state;
pub mod turn;
pub mod types;

pub use types::{GameMove, GameStatus, Player};

use crate::game::state::types::GameState;

pub fn get_current_player(state: &GameState) -> Option<Player> {
    if let Some(last_move) = state.history.last() {
        Some(last_move.game_move.player_id.opponent())
    } else {
        Some(Player::Black)
    }
}
