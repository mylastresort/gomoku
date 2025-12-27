pub mod events;
pub mod game;
pub mod shared;

use crate::{
    events::{
        event::Event, game_start::GameStartEvent,
        player_leave::PlayerLeaveEvent, player_move::PlayerMoveEvent,
    },
    game::session::GameSession,
    shared::config::Config,
};

use axum::routing::get;
use clap::Parser;
use socketioxide::{SocketIo, extract::SocketRef};
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::info;
use tracing_subscriber::FmtSubscriber;

pub async fn handle_connection(s: SocketRef, config: Config) {
    info!("New client connected");

    // Create a new game session for the connected client
    let _game_session =
        Arc::new(Mutex::new(GameSession::new(config.board_size)));

    // Register event handlers
    GameStartEvent::register_event(&s, &_game_session);
    PlayerMoveEvent::register_event(&s, &_game_session);

    // Handle client disconnection
    let session = Arc::clone(&_game_session);
    s.on_disconnect(move |s: SocketRef| {
        let session = Arc::clone(&session);
        async move {
            let mut g = session.lock().await;
            PlayerLeaveEvent::on_event_call(&mut g, &s, None);
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

    let app = axum::Router::new()
        .route("/", get(async || "Hello, World!"))
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
