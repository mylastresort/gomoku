use std::collections::{HashMap, HashSet};

use serde::{Deserialize, Serialize};

use crate::game::{capture::Capture, win::Win};

#[derive(Copy, Clone, PartialEq, Deserialize, Serialize, Eq, Hash, Debug)]
pub enum Player {
    White,
    Black,
}

// implement player to int conversion
impl Player {
    // implement Opponent function
    pub fn opponent(&self) -> Player {
        match self {
            Player::White => Player::Black,
            Player::Black => Player::White,
        }
    }
}

#[derive(Copy, Clone, Deserialize, Serialize, Debug)]
pub struct GameMove {
    pub x: usize,
    pub y: usize,
    pub player_id: Player,
}

#[derive(Clone, Debug)]
pub struct GameResult {
    pub game_move: GameMove,
    pub capture: Option<Capture>,
    pub win: Option<Win>,
}

#[derive(PartialEq, Debug)]
pub enum GameStatus {
    Ongoing,
    Finished,
}

#[derive(Clone, Deserialize, Serialize, Debug)]
pub struct GameTurn {
    pub current_player: Player,
    pub turn: usize,
    pub forbidden_sequences: Vec<(usize, usize)>,
}

pub struct GameState {
    pub board: Vec<Vec<Option<Player>>>, // 2D board representation
    pub history: Vec<GameResult>,        // History of game results
    pub status: GameStatus,
    pub captures: HashMap<Player, (usize, HashSet<usize>)>, // Captures per player
    pub turn: GameTurn,
}

#[derive(Copy, Clone, PartialEq, Deserialize, Serialize, Debug)]
pub enum GameMode {
    PvP, // Player vs Player
    PvE, // Player vs Environment (AI)
    EvE, // Environment vs Environment (AI vs AI)
}
