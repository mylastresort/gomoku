use std::collections::{HashMap, VecDeque};

use socketioxide::extract::SocketRef;
use uuid::Uuid;

use crate::{
    events::room::{game_started::GameStartedEvent, game_turn::GameTurnEvent},
    game::{session::GameSession, state::Player},
    shared::types::BoardSize,
};

#[derive(Clone, Debug)]
pub struct WaitingPlayer {
    pub socket: SocketRef,
    pub socket_id: String,
    pub board_size: BoardSize,
}

pub struct Match {
    pub room_id: String,
    pub board_size: BoardSize,
    pub session: GameSession,
    pub black_socket_id: String,
    pub white_socket_id: String,
}

impl Match {
    pub fn player_for_socket(&self, socket_id: &str) -> Option<Player> {
        if socket_id == self.black_socket_id {
            Some(Player::Black)
        } else if socket_id == self.white_socket_id {
            Some(Player::White)
        } else {
            None
        }
    }
}

#[derive(Default)]
pub struct Matchmaker {
    waiting: VecDeque<WaitingPlayer>,
    matches: HashMap<String, Match>,          // room_id -> match
    socket_to_room: HashMap<String, String>,  // socket_id -> room_id
}

#[derive(Clone, Debug)]
pub struct MatchFoundPayload {
    pub room: String,
    pub color: Player,
    pub board_size: BoardSize,
}

pub struct MatchCreated {
    pub room_id: String,
    pub black_socket: SocketRef,
    pub black: MatchFoundPayload,
    pub white: MatchFoundPayload,
}

impl Matchmaker {
    pub fn is_waiting(&self, socket_id: &str) -> bool {
        self.waiting.iter().any(|w| w.socket_id == socket_id)
    }

    pub fn is_in_match(&self, socket_id: &str) -> bool {
        self.socket_to_room.contains_key(socket_id)
    }

    pub fn enqueue_or_match(
        &mut self,
        s: &SocketRef,
        board_size: BoardSize,
    ) -> Option<MatchCreated> {
        let socket_id = s.id.to_string();

        if self.is_in_match(&socket_id) || self.is_waiting(&socket_id) {
            return None;
        }

        if let Some(other) = self.waiting.pop_front() {
            let room_id = Uuid::new_v4().to_string();

            // Choose board size: first waiting player's choice wins.
            let chosen_board_size = other.board_size;

            let mut session = GameSession::new(chosen_board_size);
            session.room.id = room_id.clone();

            // Join both sockets to the same socket.io room.
            s.join(room_id.clone());
            other.socket.join(room_id.clone());

            let m = Match {
                room_id: room_id.clone(),
                board_size: chosen_board_size,
                session,
                black_socket_id: other.socket_id.clone(),
                white_socket_id: socket_id.clone(),
            };

            self.socket_to_room
                .insert(other.socket_id.clone(), room_id.clone());
            self.socket_to_room.insert(socket_id.clone(), room_id.clone());
            self.matches.insert(room_id.clone(), m);

            let black = MatchFoundPayload {
                room: room_id.clone(),
                color: Player::Black,
                board_size: chosen_board_size,
            };
            let white = MatchFoundPayload {
                room: room_id,
                color: Player::White,
                board_size: chosen_board_size,
            };
            Some(MatchCreated {
                room_id: black.room.clone(),
                black_socket: other.socket,
                black,
                white,
            })
        } else {
            self.waiting.push_back(WaitingPlayer {
                socket: s.clone(),
                socket_id,
                board_size,
            });
            None
        }
    }

    pub fn get_match_mut_by_socket(
        &mut self,
        socket_id: &str,
    ) -> Option<&mut Match> {
        let room = self.socket_to_room.get(socket_id)?.clone();
        self.matches.get_mut(&room)
    }

    pub fn get_match_by_socket(&self, socket_id: &str) -> Option<&Match> {
        let room = self.socket_to_room.get(socket_id)?;
        self.matches.get(room)
    }

    pub async fn start_match_in_room(
        &mut self,
        s: &SocketRef,
        room_id: &str,
    ) {
        if let Some(m) = self.matches.get_mut(room_id) {
            // Announce game started to the room and send initial turn.
            m.session
                .room
                .notify_room::<GameStartedEvent>(s, None)
                .await;
            m.session
                .room
                .notify_room::<GameTurnEvent>(s, Some(m.session.state.turn.clone()))
                .await;
        }
    }

    pub fn cleanup_socket(&mut self, socket_id: &str) -> Option<String> {
        if let Some(room_id) = self.socket_to_room.remove(socket_id) {
            // If one player leaves, drop the whole match and remove the other mapping.
            if let Some(m) = self.matches.remove(&room_id) {
                let other = if m.black_socket_id == socket_id {
                    m.white_socket_id
                } else {
                    m.black_socket_id
                };
                self.socket_to_room.remove(&other);
            }
            return Some(room_id);
        }

        // Remove from waiting queue if present.
        if self.is_waiting(socket_id) {
            self.waiting.retain(|w| w.socket_id != socket_id);
        }

        None
    }
}

