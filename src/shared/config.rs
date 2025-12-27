use clap::Parser;

use crate::shared::types::BoardSize;

#[derive(Parser, Debug, Clone)]
#[command(name = "gomoku-server")]
#[command(about = "A Gomoku game server", long_about = None)]
pub struct Config {
    // Port to run the server on
    #[arg(short, long, default_value_t = 8000)]
    pub port: u16,

    // Board size
    #[arg(short, long, default_value_t = 19)]
    pub board_size: BoardSize,
}
