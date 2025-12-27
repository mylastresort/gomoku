use std::io::Error;

use serde::{Deserialize, Serialize};
use socketioxide::extract::SocketRef;

use crate::{
    events::event::Event,
    game::{session::GameSession, state::GameMove},
};

#[derive(Clone, Deserialize, Serialize)]
pub struct PlayerMoveEvent {
    pub _move: GameMove,
}

impl Event for PlayerMoveEvent {
    const EVENT_NAME: &'static str = "player-move";

    fn parse_event(_payload: Self) -> Result<Self, Error> {
        Ok(_payload)
    }

    fn on_event_call(
        _game_session: &mut GameSession,
        _s: &SocketRef,
        _payload: Option<Self>,
    ) {
        let event = match _payload {
            Some(payload) => match Self::parse_event(payload) {
                Ok(ev) => ev,
                Err(err) => {
                    Self::on_event_error(_s, err);
                    return;
                }
            },
            None => {
                Self::on_event_error(
                    _s,
                    Error::new(
                        std::io::ErrorKind::InvalidData,
                        "No payload provided",
                    ),
                );
                return;
            }
        };

        if let Err(err) = _game_session.make_move(_s, event._move) {
            Self::on_event_error(_s, err);
        }
    }
}
