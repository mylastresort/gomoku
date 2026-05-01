use std::io::Error;

use serde::{Deserialize, Serialize};
use socketioxide::extract::SocketRef;

use crate::{events::event::Event, game::session::GameSession};

#[derive(Clone, Deserialize, Serialize)]
pub struct MoveHintRequestEvent {}

impl Event for MoveHintRequestEvent {
    const EVENT_NAME: &'static str = "move-hint-request";

    fn parse_event(_payload: Self) -> Result<Self, Error> {
        Ok(_payload)
    }

    async fn on_event_call(
        _game_session: &mut GameSession,
        _s: &SocketRef,
        _payload: Option<Self>,
    ) {
        if let Err(err) = _game_session.request_move_hint(_s).await {
            Self::on_event_error(_s, err);
        }
    }
}
