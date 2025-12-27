use std::io::Error;

use socketioxide::extract::{SocketRef, TryData};
use tracing::info;

use crate::game::session::GameSession;

use serde::Deserialize;

pub trait Event: for<'de> Deserialize<'de> + Send + Sync + 'static {
    // The name of the event to listen for
    const EVENT_NAME: &'static str;

    // The name of the event to emit on error
    const EVENT_ERROR_NAME: &'static str = "event-error";

    // Method to extract the message payload from the socket
    fn parse_event(_payload: Self) -> Result<Self, Error>
    where
        Self: Sized;

    // Method to handle the event when called
    fn on_event_call(
        _game_session: &mut GameSession,
        _s: &SocketRef,
        _payload: Option<Self>,
    );

    // Emit an error event back to the client
    fn on_event_error(_s: &SocketRef, _err: Error) {
        let msg =
            format!("Error processing event {}: {}", Self::EVENT_NAME, _err);
        tracing::error!("{}", msg);
        let _ = _s.emit(Self::EVENT_ERROR_NAME, msg.as_str());
    }

    // Method to register the event handler with the socket
    fn register_event(
        socket: &SocketRef,
        game_session: &std::sync::Arc<tokio::sync::Mutex<GameSession>>,
    ) {
        info!("Registering event handler for {}", Self::EVENT_NAME);
        let session = std::sync::Arc::clone(game_session);
        socket.on(
            Self::EVENT_NAME,
            move |_s: SocketRef, TryData(data): TryData<Self>| {
                info!("Event {} received", Self::EVENT_NAME);
                let session = std::sync::Arc::clone(&session);
                async move {
                    let mut g = session.lock().await;
                    match data {
                        Ok(data) => {
                            Self::on_event_call(&mut g, &_s, Some(data));
                        }
                        Err(err) => {
                            let io_err = Error::new(
                                std::io::ErrorKind::InvalidData,
                                err.to_string(),
                            );
                            Self::on_event_error(&_s, io_err);
                        }
                    }
                }
            },
        );
    }
}
