use std::io::Error;

use serde::{Deserialize, Serialize};
use socketioxide::extract::SocketRef;
use tracing::info;

use crate::{
    events::event::Event,
    game::{session::GameSession, state::types::GameMode},
    shared::types::BoardSize,
};

#[derive(Clone, Deserialize, Serialize, Debug)]
pub struct GameStartEvent {
    board_size: BoardSize,
    mode: GameMode,
}

impl Event for GameStartEvent {
    const EVENT_NAME: &'static str = "game-start";

    fn parse_event(_payload: Self) -> Result<Self, Error> {
        // check payload validity if needed
        Ok(_payload)
    }

    fn on_event_call(
        _game_session: &mut GameSession,
        _s: &SocketRef,
        _payload: Option<Self>,
    ) {
        info!("Handling event {}", Self::EVENT_NAME);
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

        info!(
            "Starting game with board size: {:?}, mode: {:?}",
            event.board_size, event.mode
        );

        _game_session.start_game(_s, event.board_size, event.mode);
    }
}
