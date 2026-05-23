use serde_json::json;
use socketioxide::extract::SocketRef;
use tracing::info;

use crate::{
    events::room::event::RoomEvent,
    game::state::{Player, types::GameTurn},
};

pub struct GameTurnPayload {
    pub turn: GameTurn,
    pub black_captures: usize,
    pub white_captures: usize,
}

pub struct GameTurnEvent {}

impl RoomEvent for GameTurnEvent {
    const EVENT_NAME: &'static str = "game-turn";

    type Payload = GameTurnPayload;

    async fn notify_room(
        room_name: String,
        _s: &SocketRef,
        _payload: Option<Self::Payload>,
    ) {
        info!("Notifying room {} of game turn event", room_name);
        if let Some(payload) = _payload {
            info!(
                "Emitting game turn event for player {:?} with {} forbidden sequences (captures B={} W={})",
                payload.turn.current_player,
                payload.turn.forbidden_sequences.len(),
                payload.black_captures,
                payload.white_captures,
            );
            let _ = _s
                .within(room_name)
                .emit(
                    Self::EVENT_NAME,
                    &json!({
                        "currentPlayer": payload.turn.current_player,
                        "turn": payload.turn.turn,
                        "forbiddenSequences": payload.turn.forbidden_sequences,
                        "captures": {
                            "Black": payload.black_captures,
                            "White": payload.white_captures,
                        },
                    }),
                )
                .await;
        }
    }
}

impl GameTurnPayload {
    pub fn from_state(state: &crate::game::state::types::GameState) -> Self {
        let black_captures = state
            .captures
            .get(&Player::Black)
            .map(|(c, _)| *c)
            .unwrap_or(0);
        let white_captures = state
            .captures
            .get(&Player::White)
            .map(|(c, _)| *c)
            .unwrap_or(0);
        Self {
            turn: state.turn.clone(),
            black_captures,
            white_captures,
        }
    }
}
