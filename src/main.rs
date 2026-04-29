#[allow(dead_code)]
mod bridge;
pub mod events;
pub mod game;
pub mod shared;

use crate::{
    events::{
        event::Event, game_start::GameStartEvent,
        player_leave::PlayerLeaveEvent, player_move::PlayerMoveEvent,
        undo::UndoEvent,
    },
    game::session::GameSession,
    shared::config::Config,
};

use axum::routing::get;
use clap::Parser;
use socketioxide::{SocketIo, extract::SocketRef};
use std::sync::Arc;
use tokio::sync::Mutex;
use tower_http::cors::{Any, CorsLayer};
use tracing::info;
use tracing_subscriber::FmtSubscriber;

pub async fn handle_connection(s: SocketRef, config: Config) {
    info!("New client connected");

    // Create a new game session for the connected client
    let _game_session =
        Arc::new(Mutex::new(GameSession::new(config.board_size)));

    // Register event handlers
    register_event!(GameStartEvent, &s, &_game_session);
    register_event!(PlayerMoveEvent, &s, &_game_session);
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
