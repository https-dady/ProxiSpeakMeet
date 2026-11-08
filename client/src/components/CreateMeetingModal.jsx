import { useState } from 'react';
import config from '../config.js';

const API_BASE_URL = String(config.serverUrl).replace(/\/+$/, '');

const ROOM_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,47}$/;
const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

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

export default function CreateMeetingModal({
  onClose,
  onCreated,
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [allowedUsersInput, setAllowedUsersInput] = useState('');

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const parseAllowedUsers = () => {
    const values = allowedUsersInput
      .split(/[\s,;]+/)
      .map((value) => value.trim())
      .filter(Boolean);

    const uniqueValues = [...new Set(values)];

    if (uniqueValues.length > 100) {
      throw new Error('You can add a maximum of 100 users.');
    }

    const invalidIds = uniqueValues.filter(
      (id) => !OBJECT_ID_PATTERN.test(id),
    );

    if (invalidIds.length > 0) {
      throw new Error(
        'Enter valid 24-character MongoDB user IDs in the access list.',
      );
    }

    return uniqueValues;
  };

  const handleCreate = async (event) => {
    event.preventDefault();

    if (creating) return;

    const normalizedName = name.trim();
    const normalizedDescription = description.trim();

    if (!normalizedName) {
      setError('Please enter a meeting name.');
      return;
    }

    if (normalizedName.length > 100) {
      setError('Meeting name cannot exceed 100 characters.');
      return;
    }

    if (normalizedDescription.length > 500) {
      setError('Description cannot exceed 500 characters.');
      return;
    }

    let allowedUsers = [];

    try {
      if (visibility === 'private') {
        allowedUsers = parseAllowedUsers();
      }
    } catch (validationError) {
      setError(validationError.message);
      return;
    }

    setCreating(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/rooms`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: normalizedName,
          description: normalizedDescription,
          visibility,
          allowedUsers,
        }),
      });

      const payload = await readResponse(response);

      const createdRoomId =
        payload.roomId ?? payload.room?.roomId;

      if (
        typeof createdRoomId !== 'string' ||
        !ROOM_ID_PATTERN.test(createdRoomId)
      ) {
        throw new Error(
          'The server returned an invalid meeting ID.',
        );
      }

      onCreated({
        roomId: createdRoomId,
        room: payload.room ?? {
          roomId: createdRoomId,
          name: normalizedName,
          description: normalizedDescription,
          visibility,
          liveUsers: 0,
        },
      });
    } catch (requestError) {
      setError(
        requestError.message ||
          'Unable to create the meeting. Please try again.',
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !creating) {
          onClose();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-meeting-title"
        className="my-auto w-full max-w-xl rounded-2xl border border-[#303030] bg-[#1E1E1E] p-6 shadow-2xl sm:p-8"
      >
        <header className="mb-7 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold tracking-[0.22em] text-[#F3184C]">
              NEW WORKSPACE
            </p>

            <h2
              id="create-meeting-title"
              className="mt-2 text-2xl font-bold text-[#F6F6F6]"
            >
              Create a meeting
            </h2>

            <p className="mt-2 text-sm leading-6 text-[#B8B8B8]">
              Configure your virtual office and choose who can join.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={creating}
            aria-label="Close create meeting dialog"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#303030] text-lg text-[#B8B8B8] transition hover:border-[#F3184C] hover:text-[#F6F6F6] disabled:opacity-50"
          >
            ×
          </button>
        </header>

        <form onSubmit={handleCreate} className="space-y-6">
          <div>
            <label
              htmlFor="meeting-name"
              className="mb-2 block text-sm font-semibold text-[#F6F6F6]"
            >
              Meeting name
            </label>

            <input
              id="meeting-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Design Team Workspace"
              maxLength={100}
              required
              disabled={creating}
              autoFocus
              className="w-full rounded-xl border border-[#303030] bg-[#252525] px-4 py-3 text-sm text-[#F6F6F6] outline-none transition placeholder:text-[#777] focus:border-[#F3184C] focus:ring-2 focus:ring-[#F3184C]/20 disabled:opacity-50"
            />

            <p className="mt-1.5 text-right text-[11px] text-[#777]">
              {name.length}/100
            </p>
          </div>

          <div>
            <label
              htmlFor="meeting-description"
              className="mb-2 block text-sm font-semibold text-[#F6F6F6]"
            >
              Description
              <span className="ml-2 font-normal text-[#777]">
                Optional
              </span>
            </label>

            <textarea
              id="meeting-description"
              value={description}
              onChange={(event) =>
                setDescription(event.target.value)
              }
              placeholder="What is this meeting about?"
              rows={3}
              maxLength={500}
              disabled={creating}
              className="w-full resize-y rounded-xl border border-[#303030] bg-[#252525] px-4 py-3 text-sm text-[#F6F6F6] outline-none transition placeholder:text-[#777] focus:border-[#F3184C] focus:ring-2 focus:ring-[#F3184C]/20 disabled:opacity-50"
            />

            <p className="mt-1.5 text-right text-[11px] text-[#777]">
              {description.length}/500
            </p>
          </div>

          <fieldset>
            <legend className="mb-3 text-sm font-semibold text-[#F6F6F6]">
              Who can access this meeting?
            </legend>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setVisibility('public')}
                disabled={creating}
                aria-pressed={visibility === 'public'}
                className={`rounded-xl border p-4 text-left transition ${
                  visibility === 'public'
                    ? 'border-[#F3184C] bg-[#F3184C]/10'
                    : 'border-[#303030] bg-[#252525] hover:border-[#686868]'
                }`}
              >
                <span className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#F6F6F6]">
                    Public
                  </span>

                  <span
                    className={`h-3 w-3 rounded-full border ${
                      visibility === 'public'
                        ? 'border-[#F3184C] bg-[#F3184C]'
                        : 'border-[#777]'
                    }`}
                  />
                </span>

                <span className="mt-2 block text-xs leading-5 text-[#B8B8B8]">
                  Discoverable by authenticated users.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setVisibility('private')}
                disabled={creating}
                aria-pressed={visibility === 'private'}
                className={`rounded-xl border p-4 text-left transition ${
                  visibility === 'private'
                    ? 'border-[#F3184C] bg-[#F3184C]/10'
                    : 'border-[#303030] bg-[#252525] hover:border-[#686868]'
                }`}
              >
                <span className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#F6F6F6]">
                    Private
                  </span>

                  <span
                    className={`h-3 w-3 rounded-full border ${
                      visibility === 'private'
                        ? 'border-[#F3184C] bg-[#F3184C]'
                        : 'border-[#777]'
                    }`}
                  />
                </span>

                <span className="mt-2 block text-xs leading-5 text-[#B8B8B8]">
                  Only the owner and authorized accounts can join.
                </span>
              </button>
            </div>
          </fieldset>

          {visibility === 'private' && (
            <div>
              <label
                htmlFor="allowed-users"
                className="mb-2 block text-sm font-semibold text-[#F6F6F6]"
              >
                Authorized user IDs
                <span className="ml-2 font-normal text-[#777]">
                  Optional
                </span>
              </label>

              <textarea
                id="allowed-users"
                value={allowedUsersInput}
                onChange={(event) =>
                  setAllowedUsersInput(event.target.value)
                }
                placeholder="Paste MongoDB user IDs, separated by commas or new lines"
                rows={3}
                disabled={creating}
                className="w-full resize-y rounded-xl border border-[#303030] bg-[#252525] px-4 py-3 text-sm text-[#F6F6F6] outline-none transition placeholder:text-[#777] focus:border-[#F3184C] focus:ring-2 focus:ring-[#F3184C]/20 disabled:opacity-50"
              />

              <p className="mt-2 text-xs leading-5 text-[#8A8A8A]">
                Only valid account IDs are accepted. Leave empty to
                create a private meeting accessible only to you.
              </p>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm leading-6 text-red-300"
            >
              {error}
            </div>
          )}

          <footer className="flex flex-col-reverse gap-3 border-t border-[#303030] pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={creating}
              className="rounded-xl border border-[#303030] px-5 py-3 text-sm font-semibold text-[#B8B8B8] transition hover:bg-[#303030] hover:text-[#F6F6F6] disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={creating || !name.trim()}
              className="rounded-xl bg-[#F3184C] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#D91443] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating ? 'Creating meeting…' : 'Create meeting'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}