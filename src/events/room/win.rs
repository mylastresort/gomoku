use serde_json::json;
use socketioxide::extract::SocketRef;

use crate::{events::room::event::RoomEvent, game::state::Player};

pub struct Win {
    pub player_id: Player,
    pub seq: Vec<(u16, u16)>,
}

pub struct GameWinEvent {}

impl RoomEvent for GameWinEvent {
    const EVENT_NAME: &'static str = "game-win";

    type Payload = Win;

    fn notify_room(
        room_name: String,
        _s: &SocketRef,
        _payload: Option<Self::Payload>,
    ) {
        if let Some(payload) = _payload {
            let _ = _s.to(room_name).emit(
                Self::EVENT_NAME,
                &json!({
                    "player_id": payload.player_id,
                    "seq": payload.seq,
                }),
            );
        }
    }
}
