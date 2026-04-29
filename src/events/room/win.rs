use serde_json::json;
use socketioxide::extract::SocketRef;
use tracing::info;

use crate::{events::room::event::RoomEvent, game::win::Win};

pub struct GameWinEvent {}

impl RoomEvent for GameWinEvent {
    const EVENT_NAME: &'static str = "game-win";

    type Payload = Win;

    async fn notify_room(
        room_name: String,
        _s: &SocketRef,
        _payload: Option<Self::Payload>,
    ) {
        info!("Notifying room {} of game win event", room_name);
        if let Some(payload) = _payload {
            info!(
                "Emitting game win event for player {:?} with seq {:?}",
                payload.player_id, payload.win_seq
            );
            let _ = _s
                .within(room_name)
                .emit(
                    Self::EVENT_NAME,
                    &json!({
                        "player_id": payload.player_id,
                        "seq": payload.win_seq,
                        "is_by_five": payload.is_by_five,
                    }),
                )
                .await;
        }
    }
}
