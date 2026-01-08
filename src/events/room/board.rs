use socketioxide::extract::SocketRef;
use tracing::info;

use crate::{
    events::room::event::RoomEvent,
    game::state::{GameMove, Player},
};

use serde_json::json;

pub struct BoardCell {
    pub x: usize,
    pub y: usize,
    pub player_id: Option<Player>,
}

impl Into<BoardCell> for GameMove {
    fn into(self) -> BoardCell {
        BoardCell {
            x: self.x as usize,
            y: self.y as usize,
            player_id: Some(self.player_id),
        }
    }
}

pub struct BoardCellEvent {}

impl RoomEvent for BoardCellEvent {
    const EVENT_NAME: &'static str = "board-cell";

    type Payload = BoardCell;

    async fn notify_room(
        room_name: String,
        _s: &SocketRef,
        _payload: Option<Self::Payload>,
    ) {
        info!("Notifying room {} of board cell event", room_name);
        if let Some(payload) = _payload {
            info!(
                "Emitting board cell event at ({}, {}) for player {:?}",
                payload.x, payload.y, payload.player_id
            );
            let _ = _s
                .within(room_name)
                .emit(
                    Self::EVENT_NAME,
                    &json!({
                        "x": payload.x,
                        "y": payload.y,
                        "player_id": payload.player_id,
                    }),
                )
                .await;
        }
    }
}
