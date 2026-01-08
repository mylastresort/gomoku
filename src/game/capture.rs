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
        // loop through all directions (the recent move is at the origin)
        for x in -1..=1 {
            for y in -1..=1 {
                // skip the origin
                if x == 0 && y == 0 {
                    continue;
                }

                let mut capture = Capture::new(_game_move.player_id.opponent());
                let mut path = Vec::new();

                for i in 1..4 {
                    let nx = _game_move.x as isize + i * x;
                    let ny = _game_move.y as isize + i * y;
                    if nx < 0
                        || ny < 0
                        || nx >= _board.len() as isize
                        || ny >= _board.len() as isize
                    {
                        break;
                    }
                    let cell = &_board[ny as usize][nx as usize];
                    if i == 1 || i == 2 {
                        if cell.is_some()
                            && cell.unwrap() == _game_move.player_id.opponent()
                        {
                            path.push((nx as usize, ny as usize));
                        } else {
                            break;
                        }
                    } else if i == 3 {
                        if cell.is_some()
                            && cell.unwrap() == _game_move.player_id
                        {
                            capture.seq = path;
                            return Some(capture);
                        }
                    }
                }
            }
        }
        None
    }
}
