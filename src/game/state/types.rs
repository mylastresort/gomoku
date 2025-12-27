use serde::{Deserialize, Serialize};

#[derive(Copy, Clone, PartialEq, Deserialize, Serialize)]
pub enum Player {
    White,
    Black,
}

// implement player to int conversion
impl Player {}

#[derive(Copy, Clone, Deserialize, Serialize)]
pub struct GameMove {
    pub x: u16,
    pub y: u16,
    pub player_id: Player,
}

#[derive(PartialEq)]
pub enum GameStatus {
    Ongoing,
    Finished,
}

pub struct GameState {
    pub board: Vec<Vec<Option<GameMove>>>, // 2D board representation
    pub history: Vec<GameMove>,            // History of moves
    pub status: GameStatus,
}

#[derive(Copy, Clone, PartialEq, Deserialize, Serialize, Debug)]
pub enum GameMode {
    PvP, // Player vs Player
    PvE, // Player vs Environment (AI)
    EvE, // Environment vs Environment (AI vs AI)
}
