use socketioxide::extract::SocketRef;

use crate::{events::room::event::RoomEvent, game::state::Player};

use serde_json::json;

pub struct BoardCell {
    pub x: u16,
    pub y: u16,
    pub player_id: Option<Player>,
}

pub struct BoardCellEvent {}

impl RoomEvent for BoardCellEvent {
    const EVENT_NAME: &'static str = "board-cell";

    type Payload = BoardCell;

    fn notify_room(
        room_name: String,
        _s: &SocketRef,
        _payload: Option<Self::Payload>,
    ) {
        if let Some(payload) = _payload {
            let _ = _s.to(room_name).emit(
                Self::EVENT_NAME,
                &json!({
                    "x": payload.x,
                    "y": payload.y,
                    "player_id": payload.player_id,
                }),
            );
        }
    }
}
