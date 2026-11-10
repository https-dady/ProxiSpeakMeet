import { useEffect, useRef, useState } from 'react';
import config from '../config.js';

const API_BASE_URL = String(config.serverUrl).replace(/\/+$/, '');

const ROOM_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,47}$/;
const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

const AVATARS = ['circle', 'square', 'triangle', 'hex'];

const COLOR_SWATCHES = [
  '#4f8cff',
  '#ff6b6b',
  '#ffd166',
  '#5ad19a',
  '#c77dff',
  '#ff9f45',
];

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

function SectionHeading({ number, title, description }) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <span className="
        flex h-8 w-8 shrink-0 items-center justify-center
        rounded-xl bg-[#EFEDFF]
        text-[11px] font-black text-[#6252FF]
      ">
        {number}
      </span>

      <div>
        <h3 className="text-[14px] font-extrabold text-[#25263A]">
          {title}
        </h3>

        {description && (
          <p className="mt-1 text-[11px] leading-5 text-[#9292A7]">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="min-w-0">
      <label className="
        mb-2 block text-[11px] font-extrabold
        tracking-[0.2px] text-[#45445D]
      ">
        {label}
      </label>

      {children}

      {hint && (
        <p className="mt-1.5 text-[10px] leading-5 text-[#9292A7]">
          {hint}
        </p>
      )}
    </div>
  );
}

function AvatarShape({ shape }) {
  if (shape === 'circle') {
    return <span className="h-5 w-5 rounded-full bg-current" />;
  }

  if (shape === 'square') {
    return <span className="h-5 w-5 rounded-[4px] bg-current" />;
  }

  if (shape === 'triangle') {
    return (
      <span className="
        h-0 w-0
        border-x-[11px] border-x-transparent
        border-b-[20px] border-b-current
      " />
    );
  }

  return (
    <span className="h-5 w-5 rotate-45 rounded-[4px] bg-current" />
  );
}

const inputClass = `
  w-full rounded-xl
  border border-[#E9E6F3]
  bg-[#FCFBFF] px-4 py-3
  text-[12px] font-semibold
  text-[#303047]
  !outline-none !ring-0 !shadow-none
  transition-all duration-200
  placeholder:font-medium
  placeholder:text-[#B0AEC0]
  hover:border-[#D8D1FF]
  focus:!border-[#6252FF]
  focus:!outline-none
  focus:!ring-0
  focus:!shadow-[0_0_0_4px_rgba(98,82,255,0.10)]
  focus:bg-white
  disabled:cursor-not-allowed
  disabled:opacity-50
`;

export default function CreateMeetingModal({
  onClose,
  onCreated,
}) {
  const backdropRef = useRef(null);
  const dialogRef = useRef(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [allowedUsersInput, setAllowedUsersInput] = useState('');

  const [profileName, setProfileName] = useState(
    () => localStorage.getItem('proxispeak:name') ?? '',
  );

  const [color, setColor] = useState(
    () => localStorage.getItem('proxispeak:color') ?? '#4f8cff',
  );

  const [avatar, setAvatar] = useState(
    () => localStorage.getItem('proxispeak:avatar') ?? 'circle',
  );

  const [withMic, setWithMic] = useState(true);

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  // Smooth entrance animation without adding another CSS file.
  useEffect(() => {
    const backdrop = backdropRef.current;
    const dialog = dialogRef.current;

    if (!backdrop || !dialog) return;

    const backdropAnimation = backdrop.animate(
      [
        { opacity: 0 },
        { opacity: 1 },
      ],
      {
        duration: 240,
        easing: 'ease-out',
        fill: 'both',
      },
    );

    const dialogAnimation = dialog.animate(
      [
        {
          opacity: 0,
          transform: 'translateY(22px) scale(0.96)',
        },
        {
          opacity: 1,
          transform: 'translateY(0) scale(1)',
        },
      ],
      {
        duration: 420,
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
        fill: 'both',
      },
    );

    return () => {
      backdropAnimation.cancel();
      dialogAnimation.cancel();
    };
  }, []);

  // Escape key closes the modal.
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape' && !creating) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [creating, onClose]);

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
    const normalizedProfileName = profileName.trim();

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

    if (!normalizedProfileName) {
      setError('Please enter your name.');
      return;
    }

    if (normalizedProfileName.length > 24) {
      setError('Your name cannot exceed 24 characters.');
      return;
    }

    if (!AVATARS.includes(avatar)) {
      setError('Please select a valid avatar.');
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

      const profile = {
        name: normalizedProfileName,
        color,
        avatar,
        withMic,
      };

      localStorage.setItem('proxispeak:name', normalizedProfileName);
      localStorage.setItem('proxispeak:color', color);
      localStorage.setItem('proxispeak:avatar', avatar);

      onCreated({
        roomId: createdRoomId,
        room: payload.room ?? {
          roomId: createdRoomId,
          name: normalizedName,
          description: normalizedDescription,
          visibility,
          liveUsers: 0,
        },
        profile,
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
      ref={backdropRef}
      className="
        fixed inset-0 z-50
        flex items-center justify-center
        overflow-y-auto
        bg-[#171525]/45
        p-3 backdrop-blur-[8px]
        sm:p-6
      "
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !creating
        ) {
          onClose();
        }
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-meeting-title"
        className="
          my-auto flex w-full max-w-[650px]
          max-h-[calc(100vh-24px)]
          flex-col overflow-hidden
          rounded-[25px]
          border border-[#EBE8F7]
          bg-white
          shadow-[0_30px_100px_rgba(35,29,75,0.20)]
          will-change-transform
          sm:max-h-[calc(100vh-48px)]
        "
      >
        {/* HEADER */}

        <header className="
          relative flex shrink-0
          items-start justify-between
          gap-4 border-b border-[#F0EDF8]
          px-5 py-5 sm:px-7 sm:py-6
        ">
          <div>
            <span className="
              inline-flex items-center gap-2
              rounded-full bg-[#EFEDFF]
              px-3 py-1.5
              text-[9px] font-black
              tracking-[1.5px] text-[#6252FF]
            ">
              <span className="
                h-1.5 w-1.5 rounded-full
                bg-[#6252FF] animate-pulse
              " />
              NEW WORKSPACE
            </span>

            <h2
              id="create-meeting-title"
              className="
                mt-3 text-[22px]
                font-black tracking-[-0.8px]
                text-[#25263A] sm:text-[25px]
              "
            >
              Create a meeting
            </h2>

            <p className="
              mt-1.5 text-[11px]
              leading-5 text-[#9292A7]
            ">
              Set up your workspace and personalize your identity.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={creating}
            aria-label="Close dialog"
            className="
              flex h-9 w-9 shrink-0
              items-center justify-center
              rounded-xl bg-[#F7F6FB]
              text-[21px] font-medium
              text-[#85849A]
              transition-all duration-200
              hover:rotate-90
              hover:bg-[#EFEDFF]
              hover:text-[#6252FF]
              active:scale-90
              disabled:opacity-50
            "
          >
            ×
          </button>
        </header>

        {/* FORM */}

        <form
          onSubmit={handleCreate}
          className="
            min-h-0 flex-1
            space-y-7 overflow-y-auto
            [scrollbar-width:none]
            [&::-webkit-scrollbar]:hidden
            px-5 py-6 sm:px-7
          "
        >
          {/* SECTION 01 */}

          <section>
            <SectionHeading
              number="01"
              title="Meeting details"
              description="Give your virtual office an identity."
            />

            <div className="space-y-4">
              <Field label="Meeting name">
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Design Team Workspace"
                  maxLength={100}
                  required
                  disabled={creating}
                  className={inputClass}
                />

                <p className="
                  mt-1 text-right
                  text-[9px] text-[#A1A0B2]
                ">
                  {name.length}/100
                </p>
              </Field>

              <Field label="Description">
                <textarea
                  value={description}
                  onChange={(event) =>
                    setDescription(event.target.value)
                  }
                  placeholder="What is this meeting about?"
                  rows={3}
                  maxLength={500}
                  disabled={creating}
                  className={`${inputClass} resize-y`}
                />

                <p className="
                  mt-1 text-right
                  text-[9px] text-[#A1A0B2]
                ">
                  {description.length}/500
                </p>
              </Field>
            </div>
          </section>

          {/* SECTION 02 */}

          <section className="border-t border-[#F0EDF8] pt-6">
            <SectionHeading
              number="02"
              title="Access & privacy"
              description="Choose who can discover and enter your meeting."
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                {
                  value: 'public',
                  title: 'Public meeting',
                  description: 'Discoverable by authenticated users.',
                },
                {
                  value: 'private',
                  title: 'Private meeting',
                  description: 'Restricted to authorized accounts.',
                },
              ].map((option) => {
                const selected = visibility === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setVisibility(option.value)}
                    disabled={creating}
                    aria-pressed={selected}
                    className={`
                      rounded-[17px] border p-4
                      text-left transition-all duration-200
                      hover:-translate-y-0.5
                      ${
                        selected
                          ? 'border-[#BDB3FF] bg-[#F5F3FF] ring-2 ring-[#6252FF]/10'
                          : 'border-[#EBE8F7] bg-white hover:border-[#D8D1FF] hover:bg-[#FCFBFF]'
                      }
                    `}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="
                        text-[12px] font-extrabold
                        text-[#303047]
                      ">
                        {option.title}
                      </span>

                      <span className={`
                        flex h-[17px] w-[17px]
                        items-center justify-center
                        rounded-full border
                        ${
                          selected
                            ? 'border-[#6252FF] bg-[#6252FF]'
                            : 'border-[#D8D6E3]'
                        }
                      `}>
                        {selected && (
                          <span className="
                            h-1.5 w-1.5 rounded-full bg-white
                          " />
                        )}
                      </span>
                    </span>

                    <span className="
                      mt-2 block text-[10px]
                      leading-5 text-[#9292A7]
                    ">
                      {option.description}
                    </span>
                  </button>
                );
              })}
            </div>

            {visibility === 'private' && (
              <div className="mt-4">
                <Field
                  label="Authorized user IDs"
                  hint="Enter valid 24-character MongoDB user IDs separated by commas or new lines. Leave empty for owner-only access."
                >
                  <textarea
                    value={allowedUsersInput}
                    onChange={(event) =>
                      setAllowedUsersInput(event.target.value)
                    }
                    placeholder="Paste authorized user IDs..."
                    rows={3}
                    disabled={creating}
                    className={`${inputClass} resize-y`}
                  />
                </Field>
              </div>
            )}
          </section>

          {/* SECTION 03 */}

          <section className="border-t border-[#F0EDF8] pt-6">
            <SectionHeading
              number="03"
              title="Your office identity"
              description="Personalize how teammates see you inside the office."
            />

            <div className="space-y-5">
              <Field label="Your display name">
                <input
                  type="text"
                  value={profileName}
                  onChange={(event) =>
                    setProfileName(event.target.value)
                  }
                  placeholder="Enter your name"
                  maxLength={24}
                  autoComplete="name"
                  required
                  disabled={creating}
                  className={inputClass}
                />
              </Field>

              <Field label="Avatar colour">
                <div className="flex flex-wrap items-center gap-3">
                  {COLOR_SWATCHES.map((swatch) => (
                    <button
                      key={swatch}
                      type="button"
                      onClick={() => setColor(swatch)}
                      disabled={creating}
                      aria-label={`Select colour ${swatch}`}
                      aria-pressed={color === swatch}
                      className={`
                        flex h-9 w-9 items-center justify-center
                        rounded-full transition-all duration-200
                        hover:scale-110 active:scale-95
                        ${
                          color === swatch
                            ? 'ring-2 ring-[#6252FF] ring-offset-[3px] ring-offset-white'
                            : ''
                        }
                      `}
                      style={{ backgroundColor: swatch }}
                    />
                  ))}

                  <label
                    title="Custom colour"
                    className="
                      relative flex h-9 w-9
                      cursor-pointer items-center
                      justify-center overflow-hidden
                      rounded-xl border border-[#E9E6F3]
                      bg-[#F8F7FC]
                      text-[18px] text-[#6252FF]
                      transition-all
                      hover:rotate-90 hover:border-[#6252FF]
                    "
                  >
                    +
                    <input
                      type="color"
                      value={color}
                      onChange={(event) => setColor(event.target.value)}
                      disabled={creating}
                      aria-label="Custom avatar colour"
                      className="
                        absolute inset-0
                        h-full w-full cursor-pointer
                        opacity-0
                      "
                    />
                  </label>

                  <span className="
                    text-[10px] font-extrabold
                    tracking-[0.5px] text-[#85849A]
                  ">
                    {color.toUpperCase()}
                  </span>
                </div>
              </Field>

              <Field label="Avatar shape">
                <div className="flex flex-wrap items-center gap-3">
                  {AVATARS.map((shape) => {
                    const selected = avatar === shape;

                    return (
                      <button
                        key={shape}
                        type="button"
                        onClick={() => setAvatar(shape)}
                        disabled={creating}
                        aria-label={`Select ${shape} avatar`}
                        aria-pressed={selected}
                        className={`
                          flex h-[49px] w-[49px]
                          items-center justify-center
                          rounded-[14px] border
                          transition-all duration-200
                          hover:-translate-y-0.5
                          ${
                            selected
                              ? 'border-[#BDB3FF] bg-[#EFEDFF] text-[#6252FF] ring-2 ring-[#6252FF]/10'
                              : 'border-[#EBE8F7] bg-white text-[#A1A0B2] hover:border-[#D8D1FF] hover:text-[#6252FF]'
                          }
                        `}
                      >
                        <AvatarShape shape={shape} />
                      </button>
                    );
                  })}

                  <span className="
                    ml-1 text-[10px]
                    font-bold capitalize text-[#85849A]
                  ">
                    {avatar}
                  </span>
                </div>
              </Field>
            </div>
          </section>

          {/* SECTION 04 */}

          <section className="border-t border-[#F0EDF8] pt-6">
            <SectionHeading
              number="04"
              title="Audio preference"
              description="Choose how you want to enter your workspace."
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                {
                  value: true,
                  title: 'Join with microphone',
                  description: 'Enable your microphone for conversations.',
                },
                {
                  value: false,
                  title: 'Listen only',
                  description: 'Enter without enabling your microphone.',
                },
              ].map((option) => {
                const selected = withMic === option.value;

                return (
                  <button
                    key={option.title}
                    type="button"
                    onClick={() => setWithMic(option.value)}
                    disabled={creating}
                    aria-pressed={selected}
                    className={`
                      rounded-[16px] border p-4
                      text-left transition-all duration-200
                      hover:-translate-y-0.5
                      ${
                        selected
                          ? 'border-[#BDB3FF] bg-[#F5F3FF]'
                          : 'border-[#EBE8F7] bg-white hover:border-[#D8D1FF]'
                      }
                    `}
                  >
                    <span className="
                      block text-[11px]
                      font-extrabold text-[#303047]
                    ">
                      {option.title}
                    </span>

                    <span className="
                      mt-2 block text-[10px]
                      leading-5 text-[#9292A7]
                    ">
                      {option.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* ERROR */}

          {error && (
            <div
              role="alert"
              className="
                rounded-xl border border-[#DCD5FF]
                bg-[#F5F3FF] px-4 py-3
                text-[11px] font-semibold
                leading-5 text-[#5142DC]
                animate-[pulse_0.4s_ease-in-out_1]
              "
            >
              {error}
            </div>
          )}

          {/* FOOTER */}

          <footer className="
            flex flex-col-reverse gap-3
            border-t border-[#F0EDF8]
            pt-5 sm:flex-row sm:justify-end
          ">
            <button
              type="button"
              onClick={onClose}
              disabled={creating}
              className="
                min-h-[45px] rounded-xl
                border border-[#E9E6F3]
                bg-white px-6
                text-[11px] font-extrabold
                text-[#77768C]
                transition-all duration-200
                hover:border-[#D8D1FF]
                hover:bg-[#F8F7FC]
                hover:text-[#5142DC]
                active:scale-[0.98]
                disabled:opacity-50
              "
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={
                creating ||
                !name.trim() ||
                !profileName.trim()
              }
              className="
                group relative min-h-[45px]
                overflow-hidden rounded-xl
                bg-[#6252FF] px-7
                text-[11px] font-extrabold
                text-white
                shadow-[0_7px_18px_rgba(98,82,255,0.20)]
                transition-all duration-200
                hover:-translate-y-0.5
                hover:bg-[#5546F5]
                hover:shadow-[0_10px_22px_rgba(98,82,255,0.25)]
                active:translate-y-0
                disabled:cursor-not-allowed
                disabled:opacity-50
              "
            >
              <span className="
                absolute inset-0
                translate-x-[-120%]
                bg-gradient-to-r
                from-transparent via-white/15 to-transparent
                transition-transform duration-700
                group-hover:translate-x-[120%]
              " />

              <span className="relative">
                {creating
                  ? 'Creating workspace...'
                  : 'Create meeting'}
              </span>
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}