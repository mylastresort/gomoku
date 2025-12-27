use socketioxide::extract::SocketRef;

use crate::{
    events::room::board::{BoardCell, BoardCellEvent},
    game::{
        session::GameSession,
        state::{GameMove, types::GameState},
    },
};

pub struct Capture {
    pub seq: Vec<(u16, u16)>,
}

impl Capture {
    pub fn new() -> Self {
        Capture { seq: Vec::new() }
    }

    pub fn emit(&self, _s: &SocketRef, _game_session: &GameSession) {
        for (x, y) in &self.seq {
            _game_session.room.notify_room::<BoardCellEvent>(
                _s,
                Some(BoardCell {
                    x: *x,
                    y: *y,
                    player_id: None,
                }),
            );
        }
    }
}

pub fn check_for_captures(
    _state: &mut GameState,
    _game_move: &GameMove,
) -> Option<Capture> {
    todo!("Implement capture checking logic");
    None
}
