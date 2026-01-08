use socketioxide::extract::SocketRef;

use crate::{
    events::room::board::{BoardCell, BoardCellEvent},
    game::{
        session::GameSession,
        state::{GameMove, Player},
    },
    shared::types::Board,
};

#[derive(Clone, Debug)]
pub struct Capture {
    pub seq: Vec<(usize, usize)>,
    // player who was captured
    pub player_id: Player,
}

impl Capture {
    pub fn new(player_id: Player) -> Self {
        Capture {
            seq: Vec::new(),
            player_id,
        }
    }

    pub async fn emit(&self, _s: &SocketRef, _game_session: &GameSession) {
        for (x, y) in &self.seq {
            _game_session
                .room
                .notify_room::<BoardCellEvent>(
                    _s,
                    Some(BoardCell {
                        x: *x,
                        y: *y,
                        player_id: None,
                    }),
                )
                .await;
        }
    }

    pub fn find_capture(_board: &Board, _game_move: &GameMove) -> Option<Self> {
        // check of captures
        None
    }
}
