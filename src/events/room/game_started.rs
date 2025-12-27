use serde_json::json;
use socketioxide::extract::SocketRef;

use crate::events::room::event::RoomEvent;

pub struct GameStartedEvent {}

impl RoomEvent for GameStartedEvent {
    const EVENT_NAME: &'static str = "game-started";

    type Payload = ();

    fn notify_room(
        room_name: String,
        _s: &SocketRef,
        _payload: Option<Self::Payload>,
    ) {
        let _ = _s.to(room_name.clone()).emit(
            Self::EVENT_NAME,
            &json!({
                "room": room_name,
            }),
        );
    }
}
