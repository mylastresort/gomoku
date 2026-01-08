use socketioxide::extract::SocketRef;
use uuid::Uuid;

use crate::events::room::event::RoomEvent;

#[derive(Default)]
pub struct Room {
    pub id: String,
}

impl Room {
    pub fn has_room(&self) -> bool {
        !self.id.is_empty()
    }

    // Function to create and start a game room
    pub fn join_room(&mut self, _s: &SocketRef) {
        // generate a unique room ID for the game session
        let room_id = Uuid::new_v4().to_string();
        _s.join(room_id.clone());

        self.id = room_id.to_string();
    }

    // Cleanup function to end a game room
    pub fn leave_room(&mut self, _s: &SocketRef) {
        let room_id = _s.id;
        _s.leave(room_id);

        self.clean();
    }

    fn clean(&mut self) {
        self.id.clear();
    }

    pub async fn notify_room<E: RoomEvent>(
        &self,
        _s: &SocketRef,
        _payload: Option<E::Payload>,
    ) {
        E::notify_room(self.id.clone(), _s, _payload).await;
    }
}
