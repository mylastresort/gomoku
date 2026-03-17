use serde::Deserialize;

use crate::shared::types::BoardSize;

#[derive(Clone, Deserialize, Debug)]
pub struct FindMatchPayload {
    pub board_size: BoardSize,
}

