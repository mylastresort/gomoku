#[allow(dead_code)]
mod bridge;
pub mod events;
pub mod game;
pub mod shared;

use crate::{
    events::{
        event::Event, game_start::GameStartEvent,
        move_hint_request::MoveHintRequestEvent,
        player_leave::PlayerLeaveEvent, player_move::PlayerMoveEvent,
        undo::UndoEvent,
    },
    game::{
        session::GameSession,
        state::types::{GameMode, GameStatus},
    },
    shared::config::Config,
};

use axum::routing::get;
use clap::Parser;
use socketioxide::{
    SocketIo,
    extract::{SocketRef, TryData},
};
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::time::{Duration, sleep};
use tower_http::cors::{Any, CorsLayer};
use tracing::info;
use tracing_subscriber::FmtSubscriber;

pub async fn handle_connection(s: SocketRef, config: Config) {
    info!("New client connected");

    // Create a new game session for the connected client
    let _game_session =
        Arc::new(Mutex::new(GameSession::new(config.board_size)));

    // Register event handlers
    let session_arc = Arc::clone(&_game_session);
    s.on(
        GameStartEvent::EVENT_NAME,
        move |_s: SocketRef, TryData(data): TryData<GameStartEvent>| {
            let session = Arc::clone(&session_arc);
            async move {
                match data {
                    Ok(data) => {
                        {
                            let mut g = session.lock().await;
                            GameStartEvent::on_event_call(
                                &mut g,
                                &_s,
                                Some(data),
                            )
                            .await;
                        }

                        let should_spawn_eve = {
                            let mut g = session.lock().await;
                            g.begin_eve_loop()
                        };

                        if should_spawn_eve {
                            let eve_session = Arc::clone(&session);
                            let eve_socket = _s.clone();
                            tokio::spawn(async move {
                                loop {
                                    {
                                        let g = eve_session.lock().await;
                                        if !g.should_continue_eve() {
                                            break;
                                        }
                                    }

                                    // Keep one second between each AI move in EvE mode.
                                    sleep(Duration::from_secs(1)).await;

                                    let mut g = eve_session.lock().await;
                                    if !g.should_continue_eve() {
                                        break;
                                    }

                                    if let Err(err) =
                                        g.play_eve_move_once(&eve_socket).await
                                    {
                                        g.stop_eve_loop();
                                        let _ = eve_socket.emit(
                                            "event-error",
                                            &format!(
                                                "EvE auto-play failed: {err}"
                                            ),
                                        );
                                        break;
                                    }

                                    if g.mode != GameMode::EvE
                                        || g.state.status != GameStatus::Ongoing
                                    {
                                        g.stop_eve_loop();
                                        break;
                                    }
                                }
                            });
                        }
                    }
                    Err(err) => {
                        let io_err = std::io::Error::new(
                            std::io::ErrorKind::InvalidData,
                            err.to_string(),
                        );
                        GameStartEvent::on_event_error(&_s, io_err);
                    }
                }
            }
        },
    );
    register_event!(PlayerMoveEvent, &s, &_game_session);
    register_event!(MoveHintRequestEvent, &s, &_game_session);
    register_event!(UndoEvent, &s, &_game_session);

    // Handle client disconnection
    let session = Arc::clone(&_game_session);
    s.on_disconnect(move |s: SocketRef| {
        let session = Arc::clone(&session);
        async move {
            let mut g = session.lock().await;
            PlayerLeaveEvent::on_event_call(&mut g, &s, None).await;
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

    io.ns("/", |s| async move {
        handle_connection(s, config).await;
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
