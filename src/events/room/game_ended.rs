use socketioxide::extract::SocketRef;

use crate::events::room::event::RoomEvent;

pub struct GameEndedEvent {}

impl RoomEvent for GameEndedEvent {
    const EVENT_NAME: &'static str = "game-ended";

    type Payload = ();

    async fn notify_room(
        room_name: String,
        _s: &SocketRef,
        _payload: Option<Self::Payload>,
    ) {
        let _ = _s
            .to(room_name)
            .emit(Self::EVENT_NAME, "The game has ended.");
    }
}
