import { useCallback, useEffect, useRef, useState } from 'react';
import { useProxi } from '../state/ProxiContext.jsx';

const ROOM_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,47}$/;

export default function OfficeEntry({
  profile,
  children,
}) {
  const { state, join } = useProxi();

  const attemptRef = useRef(false);

  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  const enterOffice = useCallback(async () => {
    if (joining || state.selfId) return;

    const roomId = new URLSearchParams(
      window.location.search,
    ).get('room');

    const normalizedRoomId = String(roomId ?? '')
      .trim()
      .toLowerCase();

    if (!ROOM_ID_PATTERN.test(normalizedRoomId)) {
      setError('Invalid meeting ID. Please return to the dashboard.');
      return;
    }

    const name = String(profile?.name ?? '').trim();

    if (!name) {
      setError('Your display name is missing. Please return to the dashboard.');
      return;
    }

    setJoining(true);
    setError('');

    try {
      await join({
        roomId: normalizedRoomId,
        name,
        color: profile.color,
        avatar: profile.avatar,
        withMic: profile.withMic !== false,
      });
    } catch (err) {
      setError(
        err.message || 'Unable to enter the virtual office.',
      );
    } finally {
      setJoining(false);
    }
  }, [joining, state.selfId, profile, join]);

  useEffect(() => {
    if (!profile || state.selfId || attemptRef.current) {
      return;
    }

    attemptRef.current = true;
    void enterOffice();
  }, [profile, state.selfId, enterOffice]);

  if (!profile) {
    return children;
  }

  if (state.selfId) {
    return children;
  }

  return (
    <main className="
      grid min-h-screen place-items-center
      bg-[#1E1E1E] px-5 py-10
      font-sans text-[#F6F6F6]
    ">
      <section className="
        w-full max-w-md
        rounded-[24px]
        border border-[#454545]
        bg-[#303030]
        p-7
        shadow-[0_24px_70px_rgba(0,0,0,0.25)]
      ">
        <div className="
          mx-auto flex h-14 w-14
          items-center justify-center
          rounded-2xl bg-[#6252FF]
          text-xl font-black text-white
          shadow-[0_8px_25px_rgba(98,82,255,0.3)]
        ">
          P
        </div>

        <div className="mt-6 text-center">
          <span className="
            text-[10px] font-black
            tracking-[2px] text-[#AFA6FF]
          ">
            VIRTUAL OFFICE
          </span>

          <h1 className="mt-2 text-xl font-extrabold">
            {joining ? 'Entering your office' : 'Unable to join'}
          </h1>

          <p className="
            mt-3 text-sm leading-6
            text-[#BDBDBD]
          ">
            {joining
              ? `Preparing your workspace, ${profile.name}...`
              : error}
          </p>
        </div>

        {joining && (
          <div className="
            mt-7 h-1.5 overflow-hidden
            rounded-full bg-[#454545]
          ">
            <div className="
              h-full w-2/3 rounded-full
              bg-[#6252FF]
              animate-pulse
            " />
          </div>
        )}

        {!joining && error && (
          <div className="mt-7 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => {
                attemptRef.current = false;
                void enterOffice();
              }}
              className="
                rounded-xl bg-[#6252FF]
                px-5 py-3
                text-sm font-bold text-white
                transition hover:bg-[#5546F5]
                active:scale-[0.98]
              "
            >
              Try again
            </button>

            <p className="
              text-center text-[11px]
              leading-5 text-[#AFAFC0]
            ">
              Your meeting profile has been preserved.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}