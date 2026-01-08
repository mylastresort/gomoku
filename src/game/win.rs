use crate::game::{
    capture::Capture,
    state::{GameMove, Player},
};

#[derive(Clone, Debug)]
pub struct Win {
    pub player_id: Player,
    pub seq: Vec<(u16, u16)>,
}

pub trait GameWin {}

impl Win {
    pub fn check_for_win(
        _game_move: &GameMove,
        _capture: &Option<Capture>,
    ) -> Option<Win> {
        None
    }
}
