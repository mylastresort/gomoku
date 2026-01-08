use std::io::Error;

use serde::{Deserialize, Serialize};
use socketioxide::extract::SocketRef;

use crate::{events::event::Event, game::session::GameSession};

#[derive(Clone, Deserialize, Serialize)]
pub struct UndoEvent {}

impl Event for UndoEvent {
    const EVENT_NAME: &'static str = "undo";

    fn parse_event(_p: Self) -> Result<Self, Error> {
        Ok(Self {})
    }

    async fn on_event_call(
        _game_session: &mut GameSession,
        _s: &SocketRef,
        _payload: Option<Self>,
    ) {
        if let Err(err) = _game_session.undo_last_move(_s).await {
            Self::on_event_error(_s, err);
        }
    }
}
