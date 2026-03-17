pub mod events;
pub mod game;
pub mod shared;

use crate::{
    events::{
        event::Event,
        find_match::FindMatchPayload, player_move::PlayerMoveEvent,
        undo::UndoEvent,
    },
    game::matchmaker::Matchmaker,
    shared::config::Config,
};

use axum::routing::get;
use clap::Parser;
use socketioxide::{SocketIo, extract::{SocketRef, TryData}};
use std::sync::Arc;
use tokio::sync::Mutex;
use tower_http::cors::{Any, CorsLayer};
use tracing::info;
use tracing_subscriber::FmtSubscriber;

pub async fn handle_connection(
    s: SocketRef,
    config: Config,
    matchmaker: Arc<Mutex<Matchmaker>>,
) {
    info!("New client connected");

    // find-match: queue or pair into a shared room/session
    {
        let mm = Arc::clone(&matchmaker);
        s.on(
            "find-match",
            move |s: SocketRef, TryData(data): TryData<FindMatchPayload>| {
                let mm = Arc::clone(&mm);
                async move {
                    let payload = match data {
                        Ok(d) => d,
                        Err(err) => {
                            let io_err = std::io::Error::new(
                                std::io::ErrorKind::InvalidData,
                                err.to_string(),
                            );
                            let msg = io_err.to_string();
                            let _ = s.emit("event-error", &msg);
                            return;
                        }
                    };

                    let mut g = mm.lock().await;
                    if let Some(created) =
                        g.enqueue_or_match(&s, payload.board_size)
                    {
                        let black_payload = serde_json::json!({
                            "room": created.black.room,
                            "color": "Black",
                            "board_size": created.black.board_size,
                        });
                        let _ = created
                            .black_socket
                            .emit("match-found", &black_payload);

                        let white_payload = serde_json::json!({
                            "room": created.white.room,
                            "color": "White",
                            "board_size": created.white.board_size,
                        });
                        let _ = s.emit("match-found", &white_payload);

                        g.start_match_in_room(&s, &created.room_id).await;
                    }
                }
            },
        );
    }

    // player-move/undo/player-leave: routed via matchmaker when in online match.
    {
        let mm = Arc::clone(&matchmaker);
        s.on(
            PlayerMoveEvent::EVENT_NAME,
            move |s: SocketRef, TryData(data): TryData<PlayerMoveEvent>| {
                let mm = Arc::clone(&mm);
                async move {
                    let payload = match data {
                        Ok(d) => d,
                        Err(err) => {
                            let io_err = std::io::Error::new(
                                std::io::ErrorKind::InvalidData,
                                err.to_string(),
                            );
                            PlayerMoveEvent::on_event_error(&s, io_err);
                            return;
                        }
                    };

                    let socket_id = s.id.to_string();
                    let mut g = mm.lock().await;
                    if let Some(m) = g.get_match_mut_by_socket(&socket_id) {
                        let assigned = match m.player_for_socket(&socket_id) {
                            Some(p) => p,
                            None => {
                                PlayerMoveEvent::on_event_error(
                                    &s,
                                    std::io::Error::new(
                                        std::io::ErrorKind::PermissionDenied,
                                        "Not a player in this match",
                                    ),
                                );
                                return;
                            }
                        };

                        let expected = m.session.state.get_current_player();
                        if assigned != expected {
                            PlayerMoveEvent::on_event_error(
                                &s,
                                std::io::Error::new(
                                    std::io::ErrorKind::PermissionDenied,
                                    format!(
                                        "Not your turn (you are {:?}, expected {:?})",
                                        assigned, expected
                                    ),
                                ),
                            );
                            return;
                        }

                        if let Err(err) =
                            m.session.make_move(&s, payload.x, payload.y).await
                        {
                            PlayerMoveEvent::on_event_error(&s, err);
                        }
                    } else {
                        PlayerMoveEvent::on_event_error(
                            &s,
                            std::io::Error::new(
                                std::io::ErrorKind::NotFound,
                                "Not in an active match",
                            ),
                        );
                    }
                }
            },
        );
    }

    {
        let mm = Arc::clone(&matchmaker);
        s.on(
            UndoEvent::EVENT_NAME,
            move |s: SocketRef, TryData(data): TryData<UndoEvent>| {
                let mm = Arc::clone(&mm);
                async move {
                    let payload = match data {
                        Ok(d) => d,
                        Err(err) => {
                            let io_err = std::io::Error::new(
                                std::io::ErrorKind::InvalidData,
                                err.to_string(),
                            );
                            UndoEvent::on_event_error(&s, io_err);
                            return;
                        }
                    };

                    let socket_id = s.id.to_string();
                    let mut g = mm.lock().await;
                    if let Some(m) = g.get_match_mut_by_socket(&socket_id) {
                        if let Err(err) = m.session.undo_last_move(&s).await {
                            UndoEvent::on_event_error(&s, err);
                        }
                    } else {
                        // Not in match: ignore.
                        let _ = payload;
                    }
                }
            },
        );
    }

    // Handle client disconnection
    let mm = Arc::clone(&matchmaker);
    s.on_disconnect(move |s: SocketRef| {
        let mm = Arc::clone(&mm);
        async move {
            let socket_id = s.id.to_string();
            let mut g = mm.lock().await;
            if let Some(room_id) = g.cleanup_socket(&socket_id) {
                let payload = serde_json::json!({});
                let _ = s
                    .within(room_id)
                    .emit("player-leave", &payload)
                    .await;
            }
        }
    });
}

pub async fn new_server(config: Config) {
    let (layer, io) = SocketIo::new_layer();
    let listener =
        tokio::net::TcpListener::bind(format!("0.0.0.0:{}", config.port))
            .await
            .unwrap();

    let port = config.port;

    let matchmaker = Arc::new(Mutex::new(Matchmaker::default()));
    let config_for_ns = config.clone();
    let matchmaker_for_ns = Arc::clone(&matchmaker);

    io.ns("/", move |s| {
        let config = config_for_ns.clone();
        let matchmaker = Arc::clone(&matchmaker_for_ns);
        async move {
            handle_connection(s, config, matchmaker).await;
        }
    });

    // Add CORS support for the client
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = axum::Router::new()
        .route("/", get(async || "Hello, World!"))
        .layer(cors)
        .layer(layer);

    info!("Server listening on http://0.0.0.0:{}", port);
    axum::serve(listener, app).await.unwrap()
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing::subscriber::set_global_default(
        FmtSubscriber::builder()
            .with_max_level(tracing::Level::DEBUG)
            .finish(),
    )
    .expect("setting default subscriber failed");

    let config = Config::parse();
    new_server(config).await;

    Ok(())
}
