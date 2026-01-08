use std::io::Error;

use socketioxide::extract::SocketRef;

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
    ) -> impl Future<Output = ()>;

    // Emit an error event back to the client
    fn on_event_error(_s: &SocketRef, _err: Error) {
        let msg =
            format!("Error processing event {}: {}", Self::EVENT_NAME, _err);
        tracing::error!("{}", msg);
        let _ = _s.emit(Self::EVENT_ERROR_NAME, msg.as_str());
    }
}

// Method to register the event handler with the socket
#[macro_export]
macro_rules! register_event {
    ($event_type:ty, $socket:expr, $game_session:expr) => {{
        use socketioxide::extract::{SocketRef, TryData};
        use std::sync::Arc;
        use tracing::info;

        info!(
            "Registering event handler for {}",
            <$event_type>::EVENT_NAME
        );

        let session_arc = Arc::clone($game_session);

        $socket.on(
            <$event_type>::EVENT_NAME,
            move |_s: SocketRef, TryData(data): TryData<$event_type>| {
                info!("Event {} received", <$event_type>::EVENT_NAME);
                let session = Arc::clone(&session_arc);
                async move {
                    let mut g = session.lock().await;
                    match data {
                        Ok(data) => {
                            <$event_type>::on_event_call(
                                &mut g,
                                &_s,
                                Some(data),
                            )
                            .await;
                        }
                        Err(err) => {
                            let io_err = std::io::Error::new(
                                std::io::ErrorKind::InvalidData,
                                err.to_string(),
                            );
                            <$event_type>::on_event_error(&_s, io_err);
                        }
                    }
                }
            },
        );
    }};
}
