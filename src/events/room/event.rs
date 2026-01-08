use socketioxide::extract::SocketRef;

pub trait RoomEvent {
    // The name of the event to push to
    const EVENT_NAME: &'static str;

    // The name of the event to emit on error
    const EVENT_ERROR_NAME: &'static str = "room-event-error";

    type Payload;

    // The name of the room
    fn notify_room(
        room_name: String,
        s: &SocketRef,
        payload: Option<Self::Payload>,
    ) -> impl Future<Output = ()>;
}
