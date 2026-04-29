use crate::{
    game::state::{Player, types::GameTurn},
    shared::types::Board,
};

impl GameTurn {
    pub fn update(&mut self, current_player: &Player, _board: &Board) {
        self.turn += 1;
        self.current_player = *current_player;
        self.forbidden_sequences =
            Self::get_forbidden_moves(_board, &self.current_player);
    }

    pub fn get_forbidden_moves(
        _board: &Board,
        _current_player: &Player,
    ) -> Vec<(usize, usize)> {
        let mut vec = Vec::new();

        return vec;
    }
}
