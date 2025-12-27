use std::io::Error;

use serde::{Deserialize, Serialize};
use socketioxide::extract::SocketRef;

use crate::{events::event::Event, game::session::GameSession};

#[derive(Clone, Deserialize, Serialize)]
pub struct PlayerLeaveEvent {}

impl Event for PlayerLeaveEvent {
    const EVENT_NAME: &'static str = "player-leave";

    fn parse_event(_p: Self) -> Result<Self, Error> {
        Ok(Self {})
    }

    fn on_event_call(
        _game_session: &mut GameSession,
        _s: &SocketRef,
        _payload: Option<Self>,
    ) {
        _game_session.end_game(_s);
    }
}
