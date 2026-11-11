import { useCallback, useEffect, useState } from 'react';

import config from '../config.js';

const API_BASE_URL = String(config.serverUrl).replace(/\/+$/, '');
const ROOM_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,47}$/;

function getAuthHeaders() {
  const token = localStorage.getItem('token');

  return {
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function readResponse(response) {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      payload.error ||
        payload.message ||
        `Request failed with status ${response.status}.`,
    );
  }

  return payload;
}

export default function RoomManager({
  username,
  onJoinRoom,
  onLogout,
}) {
  const [roomId, setRoomId] = useState('');
  const [rooms, setRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [joiningRoom, setJoiningRoom] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const busy = creatingRoom || joiningRoom;

  const loadRooms = useCallback(async (signal) => {
    setLoadingRooms(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/rooms`, {
        method: 'GET',
        headers: getAuthHeaders(),
        signal,
      });

      const payload = await readResponse(response);

      if (!Array.isArray(payload.rooms)) {
        throw new Error(
          'The server returned an invalid room catalogue.',
        );
      }

      const availableRooms = payload.rooms.filter(
        (room) =>
          room &&
          typeof room.roomId === 'string' &&
          ROOM_ID_PATTERN.test(room.roomId),
      );

      if (!signal?.aborted) {
        setRooms(availableRooms);
      }
    } catch (err) {
      if (err.name === 'AbortError' || signal?.aborted) {
        return;
      }

      setError(
        err.message ||
          'Unable to load rooms. Check your server connection.',
      );
    } finally {
      if (!signal?.aborted) {
        setLoadingRooms(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    void loadRooms(controller.signal);

    return () => controller.abort();
  }, [loadRooms]);

  const createNewRoom = async () => {
    if (busy) return;

    setCreatingRoom(true);
    setError('');
    setNotice('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/rooms`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      const payload = await readResponse(response);
      const createdRoomId = payload.roomId ?? payload.room?.roomId;

      if (
        typeof createdRoomId !== 'string' ||
        !ROOM_ID_PATTERN.test(createdRoomId)
      ) {
        throw new Error(
          'The server did not return a valid room ID.',
        );
      }

      setRooms((previousRooms) => {
        if (
          previousRooms.some(
            (room) => room.roomId === createdRoomId,
          )
        ) {
          return previousRooms;
        }

        return [
          ...previousRooms,
          payload.room ?? {
            roomId: createdRoomId,
            name: createdRoomId,
            liveUsers: 0,
          },
        ].sort((a, b) => a.roomId.localeCompare(b.roomId));
      });

      setNotice(`Room ${createdRoomId} created successfully.`);

      onJoinRoom(createdRoomId);
    } catch (err) {
      setError(
        err.message ||
          'Failed to create a room. Check your connection and try again.',
      );
    } finally {
      setCreatingRoom(false);
    }
  };

  const joinExistingRoom = async (event) => {
    event.preventDefault();

    if (busy) return;

    const normalizedRoomId = roomId.trim().toLowerCase();

    if (!ROOM_ID_PATTERN.test(normalizedRoomId)) {
      setError(
        'Enter a valid room ID using letters, numbers, hyphens or underscores.',
      );
      return;
    }

    if (loadingRooms) {
      setError('Wait for the room catalogue to finish loading.');
      return;
    }

    const selectedRoom = rooms.find(
      (room) => room.roomId === normalizedRoomId,
    );

    if (!selectedRoom) {
      setError(
        'This room is not in the available room list. Refresh the list and check the room ID.',
      );
      return;
    }

    setJoiningRoom(true);
    setError('');
    setNotice('');

    try {
      // Verify that the selected room can be retrieved from the backend.
      const response = await fetch(
        `${API_BASE_URL}/api/rooms/${encodeURIComponent(normalizedRoomId)}`,
        {
          method: 'GET',
          headers: getAuthHeaders(),
        },
      );

      await readResponse(response);

      onJoinRoom(normalizedRoomId);
    } catch (err) {
      setError(
        err.message ||
          'Unable to join this room. Refresh the room list and try again.',
      );
    } finally {
      setJoiningRoom(false);
    }
  };

  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#0f172a',
        color: '#f8fafc',
        fontFamily: 'system-ui, sans-serif',
        padding: '20px',
        boxSizing: 'border-box',
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: '640px',
          backgroundColor: '#1e293b',
          borderRadius: '12px',
          padding: '30px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.35)',
          border: '1px solid #334155',
          boxSizing: 'border-box',
        }}
      >
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '16px',
            flexWrap: 'wrap',
            marginBottom: '30px',
            borderBottom: '1px solid #334155',
            paddingBottom: '20px',
          }}
        >
          <div>
            <h1
              style={{
                color: '#f8fafc',
                fontSize: '24px',
                margin: 0,
              }}
            >
              Welcome, {username}
            </h1>

            <p
              style={{
                color: '#94a3b8',
                margin: '8px 0 0',
                fontSize: '14px',
              }}
            >
              Where would you like to go today?
            </p>
          </div>

          <button
            type="button"
            onClick={onLogout}
            disabled={busy}
            style={{
              backgroundColor: '#ef4444',
              color: '#fff',
              border: 'none',
              padding: '9px 16px',
              borderRadius: '6px',
              cursor: busy ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              opacity: busy ? 0.6 : 1,
            }}
          >
            Logout
          </button>
        </header>

        {error && (
          <div
            role="alert"
            style={{
              backgroundColor: 'rgba(239,68,68,0.1)',
              border: '1px solid #ef4444',
              color: '#fecaca',
              padding: '12px 14px',
              borderRadius: '7px',
              marginBottom: '18px',
              lineHeight: 1.5,
              overflowWrap: 'anywhere',
            }}
          >
            {error}
          </div>
        )}

        {notice && (
          <div
            role="status"
            style={{
              backgroundColor: 'rgba(16,185,129,0.1)',
              border: '1px solid #10b981',
              color: '#a7f3d0',
              padding: '12px 14px',
              borderRadius: '7px',
              marginBottom: '18px',
            }}
          >
            {notice}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
          }}
        >
          <section
            style={{
              backgroundColor: '#0f172a',
              padding: '24px',
              borderRadius: '8px',
              border: '1px solid #334155',
              textAlign: 'center',
            }}
          >
            <h2 style={{ marginTop: 0, fontSize: '20px' }}>
              Start a New Meeting
            </h2>

            <p
              style={{
                color: '#94a3b8',
                fontSize: '14px',
                lineHeight: 1.6,
                marginBottom: '20px',
              }}
            >
              Create a unique virtual room and invite your team
              using its room ID.
            </p>

            <button
              type="button"
              onClick={createNewRoom}
              disabled={busy}
              style={{
                backgroundColor: '#10b981',
                color: '#fff',
                border: 'none',
                padding: '13px 20px',
                borderRadius: '6px',
                fontSize: '15px',
                fontWeight: 700,
                cursor: busy ? 'not-allowed' : 'pointer',
                width: '100%',
                opacity: busy ? 0.65 : 1,
              }}
            >
              {creatingRoom
                ? 'Creating room…'
                : '+ Create Unique Room'}
            </button>
          </section>

          <div
            aria-hidden="true"
            style={{
              textAlign: 'center',
              color: '#64748b',
              fontWeight: 700,
              letterSpacing: '2px',
            }}
          >
            OR
          </div>

          <section
            style={{
              backgroundColor: '#0f172a',
              padding: '24px',
              borderRadius: '8px',
              border: '1px solid #334155',
            }}
          >
            <h2
              style={{
                marginTop: 0,
                fontSize: '20px',
                textAlign: 'center',
              }}
            >
              Join Existing Room
            </h2>

            <p
              style={{
                color: '#94a3b8',
                fontSize: '14px',
                lineHeight: 1.6,
                marginBottom: '20px',
                textAlign: 'center',
              }}
            >
              Enter the room ID shared by your host.
            </p>

            <form
              onSubmit={joinExistingRoom}
              style={{
                display: 'flex',
                gap: '10px',
                flexWrap: 'wrap',
              }}
            >
              <input
                type="text"
                placeholder="Enter Room ID…"
                value={roomId}
                onChange={(event) => {
                  setRoomId(event.target.value);
                  setError('');
                  setNotice('');
                }}
                autoComplete="off"
                spellCheck={false}
                aria-label="Room ID"
                required
                maxLength={48}
                style={{
                  flex: '1 1 220px',
                  minWidth: 0,
                  padding: '12px 15px',
                  borderRadius: '6px',
                  border: '1px solid #334155',
                  backgroundColor: '#1e293b',
                  color: '#fff',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />

              <button
                type="submit"
                disabled={busy || loadingRooms}
                style={{
                  backgroundColor: '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '6px',
                  fontWeight: 700,
                  cursor:
                    busy || loadingRooms
                      ? 'not-allowed'
                      : 'pointer',
                  opacity: busy || loadingRooms ? 0.6 : 1,
                }}
              >
                {joiningRoom ? 'Joining…' : 'Join'}
              </button>
            </form>
          </section>

          <section
            style={{
              backgroundColor: '#0f172a',
              padding: '20px',
              borderRadius: '8px',
              border: '1px solid #334155',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap',
                marginBottom: '14px',
              }}
            >
              <h2 style={{ margin: 0, fontSize: '18px' }}>
                Available Rooms
              </h2>

              <button
                type="button"
                onClick={() => void loadRooms()}
                disabled={loadingRooms || busy}
                style={{
                  backgroundColor: 'transparent',
                  color: '#93c5fd',
                  border: '1px solid #475569',
                  padding: '7px 12px',
                  borderRadius: '6px',
                  cursor:
                    loadingRooms || busy
                      ? 'not-allowed'
                      : 'pointer',
                }}
              >
                {loadingRooms ? 'Loading…' : 'Refresh'}
              </button>
            </div>

            {loadingRooms ? (
              <p role="status" style={{ color: '#94a3b8' }}>
                Loading rooms from the server…
              </p>
            ) : rooms.length === 0 ? (
              <p style={{ color: '#94a3b8', lineHeight: 1.6 }}>
                No rooms are currently listed. Create a new room
                or refresh the list.
              </p>
            ) : (
              <ul
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                {rooms.map((room) => (
                  <li
                    key={room.roomId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      flexWrap: 'wrap',
                      padding: '12px',
                      border: '1px solid #334155',
                      borderRadius: '7px',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <strong
                        style={{
                          display: 'block',
                          overflowWrap: 'anywhere',
                        }}
                      >
                        {room.name || room.roomId}
                      </strong>

                      <span
                        style={{
                          color: '#94a3b8',
                          fontSize: '12px',
                          overflowWrap: 'anywhere',
                        }}
                      >
                        ID: {room.roomId}
                      </span>

                      <span
                        style={{
                          display: 'block',
                          color: '#94a3b8',
                          fontSize: '12px',
                          marginTop: '4px',
                        }}
                      >
                        {room.liveUsers ?? 0} online
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setRoomId(room.roomId);
                        setError('');
                        setNotice('');
                      }}
                      style={{
                        backgroundColor: '#334155',
                        color: '#f8fafc',
                        border: '1px solid #475569',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        cursor: busy ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Use ID
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <p
              style={{
                color: '#64748b',
                fontSize: '12px',
                lineHeight: 1.5,
                marginBottom: 0,
                marginTop: '14px',
              }}
            >
              Room availability is based on the server catalogue.
              Refresh to retrieve the latest list.
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}