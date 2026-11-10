import React from 'react';

/* =========================================
   DATE & DURATION HELPERS
========================================= */

function formatMeetingDate(dateValue) {
  if (!dateValue) return 'Date unavailable';

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return 'Date unavailable';
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function formatDuration(durationSeconds) {
  const seconds = Number(durationSeconds);

  if (!Number.isFinite(seconds) || seconds <= 0) {
    return 'Duration unavailable';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes} min`;

  return `${seconds} sec`;
}

/* =========================================
   MEETING STATUS
========================================= */

function getMeetingStatus(status) {
  const normalized = String(status || '').toLowerCase();

  if (['active', 'ongoing'].includes(normalized)) {
    return {
      label: 'In progress',
      className: 'bg-emerald-50 text-emerald-700',
    };
  }

  if (['completed', 'ended'].includes(normalized)) {
    return {
      label: 'Completed',
      className: 'bg-[#EFEDFF] text-[#6252FF]',
    };
  }

  if (['cancelled', 'canceled'].includes(normalized)) {
    return {
      label: 'Cancelled',
      className: 'bg-rose-50 text-rose-600',
    };
  }

  return {
    label: status || 'Meeting',
    className: 'bg-gray-100 text-gray-600',
  };
}

/* =========================================
   ICONS
========================================= */

function Icon({ name, size = 19 }) {
  const icons = {
    history: (
      <>
        <path d="M3 12a9 9 0 1 0 2.64-6.36L3 8" />
        <path d="M3 3v5h5M12 7v5l3.5 2" />
      </>
    ),

    calendar: (
      <>
        <rect x="3.5" y="5" width="17" height="16" rx="3" />
        <path d="M7.5 3v4M16.5 3v4M3.5 10h17" />
      </>
    ),

    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3.2 2" />
      </>
    ),

    refresh: (
      <>
        <path d="M20 7v5h-5M4 17v-5h5" />
        <path d="M5.5 9a7 7 0 0 1 11.8-2L20 12M4 12l2.7 5a7 7 0 0 0 11.8-2" />
      </>
    ),

    arrow: (
      <>
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </>
    ),

    video: (
      <>
        <rect x="3" y="5" width="13" height="14" rx="2" />
        <path d="m16 10 5-3v10l-5-3" />
      </>
    ),
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {icons[name]}
    </svg>
  );
}

/* =========================================
   LOADING SKELETON
========================================= */

function HistoryLoading() {
  return (
    <div
      className="space-y-4"
      role="status"
      aria-label="Loading meeting history"
    >
      {[1, 2, 3].map((item) => (
        <div
          key={item}
          className="
            flex items-center gap-4
            rounded-[22px]
            border border-[#EBE8F7]
            bg-white p-5
          "
        >
          <div className="
            h-14 w-14 shrink-0
            animate-pulse rounded-[17px]
            bg-[#EFEDFF]
          " />

          <div className="flex-1 space-y-3">
            <div className="
              h-4 w-1/3 animate-pulse
              rounded-full bg-[#EFEDFF]
            " />

            <div className="
              h-3 w-2/3 animate-pulse
              rounded-full bg-[#F3F1FA]
            " />
          </div>

          <div className="
            hidden h-10 w-24
            animate-pulse rounded-xl
            bg-[#EFEDFF] sm:block
          " />
        </div>
      ))}

      <span className="sr-only">
        Loading meeting records...
      </span>
    </div>
  );
}

/* =========================================
   EMPTY STATE
========================================= */

function EmptyHistory({ onRefresh }) {
  return (
    <div className="
      relative flex min-h-[350px]
      flex-col items-center
      justify-center overflow-hidden
      rounded-[26px]
      border border-dashed border-[#DDD9F2]
      bg-white px-6 py-12
      text-center
    ">
      <div className="
        pointer-events-none absolute
        -right-16 -top-20
        h-56 w-56 rounded-full
        bg-[#EFEDFF]/70
      " />

      <div className="
        pointer-events-none absolute
        -bottom-24 -left-16
        h-56 w-56 rounded-full
        bg-[#F5F2FF]
      " />

      <div className="
        relative z-10
        flex h-[88px] w-[88px]
        items-center justify-center
        rounded-full border border-[#E4DFFF]
        bg-[#F8F6FF]
      ">
        <div className="
          flex h-[58px] w-[58px]
          items-center justify-center
          rounded-[19px]
          bg-[#EFEDFF]
          text-[#6252FF]
        ">
          <Icon name="history" size={28} />
        </div>
      </div>

      <div className="relative z-10 mt-6">
        <span className="
          text-[10px] font-extrabold
          tracking-[2px] text-[#6252FF]
        ">
          YOUR ACTIVITY
        </span>

        <h3 className="
          mt-3 text-[22px]
          font-extrabold tracking-[-0.7px]
          text-[#25263A]
        ">
          No meetings yet
        </h3>

        <p className="
          mx-auto mt-3 max-w-[400px]
          text-[13px] leading-7
          text-[#9292A7]
        ">
          Your previous meetings will appear here
          once you start using ProxiSpeakMeet.
        </p>

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="
              appearance-none border-0
              mt-6 inline-flex min-h-[45px]
              items-center justify-center gap-2
              rounded-[13px]
              bg-[#EFEDFF] px-5
              text-[12px] font-bold
              text-[#6252FF]
              transition-all duration-300
              hover:bg-[#E4DFFF]
              hover:-translate-y-0.5
              focus-visible:outline-none
              focus-visible:ring-2
              focus-visible:ring-[#6252FF]
            "
          >
            <Icon name="refresh" size={16} />
            Refresh history
          </button>
        )}
      </div>
    </div>
  );
}

/* =========================================
   MEETING HISTORY CARD
========================================= */

function MeetingHistoryCard({
  meeting,
  onRejoin,
  joiningMeeting,
}) {
  const roomId = meeting?.roomId;
  const roomName = meeting?.roomName || 'Untitled meeting';

  const status = getMeetingStatus(meeting?.status);

  const startedAt = meeting?.startedAt;

  const duration = formatDuration(
    meeting?.durationSeconds,
  );

  const isRejoining =
    Boolean(roomId) && joiningMeeting === roomId;

  const canRejoin =
    Boolean(roomId) &&
    Boolean(onRejoin) &&
    !joiningMeeting;

  return (
    <article className="
      group relative flex
      flex-wrap items-center
      justify-between gap-5
      overflow-hidden
      rounded-[22px]
      border border-[#EBE8F7]
      bg-white p-5
      shadow-[0_4px_20px_rgba(40,35,90,0.025)]
      transition-all duration-300
      hover:-translate-y-0.5
      hover:border-[#DCD5FF]
      hover:shadow-[0_14px_35px_rgba(70,55,170,0.07)]
      sm:p-6
    ">
      <div className="
        pointer-events-none absolute
        -right-12 -top-16
        h-36 w-36 rounded-full
        bg-[#6252FF]/[0.035]
        transition-transform duration-500
        group-hover:scale-125
      " />

      <div className="
        relative z-10
        flex min-w-0 flex-1
        items-start gap-4
      ">
        <div className="
          flex h-[54px] w-[54px]
          shrink-0 items-center justify-center
          rounded-[17px]
          bg-[#EFEDFF]
          text-[#6252FF]
          transition-transform duration-300
          group-hover:scale-105
        ">
          <Icon name="video" size={23} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="
            flex flex-wrap
            items-center gap-2.5
          ">
            <h3 className="
              max-w-full truncate
              text-[15px] font-extrabold
              tracking-[-0.4px]
              text-[#25263A]
            ">
              {roomName}
            </h3>

            <span className={`
              inline-flex shrink-0
              items-center gap-1.5
              rounded-full px-3 py-1
              text-[10px] font-bold
              ${status.className}
            `}>
              <span className="
                h-1.5 w-1.5
                rounded-full bg-current
              " />
              {status.label}
            </span>
          </div>

          <div className="
            mt-3 flex flex-wrap
            items-center gap-x-4 gap-y-2
          ">
            <span className="
              inline-flex items-center gap-1.5
              text-[11px] font-medium
              text-[#85869D]
            ">
              <Icon name="calendar" size={14} />
              {formatMeetingDate(startedAt)}
            </span>

            <span className="
              inline-flex items-center gap-1.5
              text-[11px] font-medium
              text-[#85869D]
            ">
              <Icon name="clock" size={14} />
              {duration}
            </span>
          </div>

          <div className="
            mt-3 inline-flex max-w-full
            items-center gap-2
            rounded-lg bg-[#F8F7FC]
            px-2.5 py-1.5
          ">
            <span className="
              text-[9px] font-extrabold
              tracking-[1px] text-[#A1A0B2]
            ">
              ID
            </span>

            <span className="
              max-w-[180px] truncate
              text-[10px] font-semibold
              tracking-[0.3px] text-[#77778F]
            ">
              {roomId || 'ID unavailable'}
            </span>
          </div>
        </div>
      </div>

      <div className="
        relative z-10 w-full
        sm:w-auto
      ">
        <button
          type="button"
          onClick={() => onRejoin(roomId, meeting)}
          disabled={!canRejoin}
          aria-label={`Rejoin ${roomName}`}
          className="
            appearance-none border-0
            flex min-h-[44px]
            w-full sm:w-auto
            items-center justify-center
            gap-2 rounded-[13px]
            bg-[#EFEDFF] px-5
            text-[11px] font-extrabold
            text-[#6252FF]
            transition-all duration-300
            hover:-translate-y-0.5
            hover:bg-[#6252FF]
            hover:text-white
            active:translate-y-0
            disabled:cursor-not-allowed
            disabled:opacity-50
            focus-visible:outline-none
            focus-visible:ring-2
            focus-visible:ring-[#6252FF]
            focus-visible:ring-offset-2
          "
        >
          {isRejoining ? (
            <>
              <span className="
                h-4 w-4 animate-spin
                rounded-full border-2
                border-current border-t-transparent
              " />
              Joining...
            </>
          ) : (
            <>
              Rejoin meeting
              <Icon name="arrow" size={15} />
            </>
          )}
        </button>
      </div>
    </article>
  );
}

/* =========================================
   MAIN COMPONENT
========================================= */

export default function DashboardHistory({
  meetings = [],
  loading = false,
  error = '',
  joiningMeeting = null,
  onRefresh,
  onRejoin,
}) {
  const safeMeetings = Array.isArray(meetings)
    ? meetings
    : [];

  return (
    <section className="w-full space-y-7">
      {/* HEADER */}

      <div className="
        flex flex-wrap
        items-end justify-between
        gap-5
      ">
        <div>
          <div className="
            mb-3 flex items-center gap-2
            text-[10px] font-extrabold
            tracking-[1.8px] text-[#6252FF]
          ">
            <span className="
              h-2 w-2 rounded-full
              bg-[#6252FF]
              shadow-[0_0_0_4px_rgba(98,82,255,0.10)]
            " />
            YOUR ACTIVITY
          </div>

          <h2 className="
            text-[26px] font-black
            tracking-[-1px] text-[#25263A]
          ">
            Meeting history
          </h2>

          <p className="
            mt-2 max-w-[550px]
            text-[13px] leading-6
            text-[#9292A7]
          ">
            Keep track of your previous conversations
            and reconnect whenever you need.
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading || !onRefresh}
          className="
            appearance-none border-0
            flex min-h-[43px]
            items-center justify-center
            gap-2.5 rounded-[13px]
            bg-white px-4
            text-[11px] font-extrabold
            text-[#6252FF]
            ring-1 ring-inset ring-[#EBE8F7]
            transition-all duration-300
            hover:-translate-y-0.5
            hover:bg-[#F6F4FF]
            disabled:cursor-not-allowed
            disabled:opacity-50
            focus-visible:outline-none
            focus-visible:ring-2
            focus-visible:ring-[#6252FF]
          "
        >
          <span className={`
            ${loading ? 'animate-spin' : ''}
          `}>
            <Icon name="refresh" size={16} />
          </span>

          {loading ? 'Refreshing...' : 'Refresh history'}
        </button>
      </div>

      {/* ERROR */}

      {error && (
        <div
          role="alert"
          className="
            flex flex-wrap
            items-center justify-between
            gap-3 rounded-[15px]
            border border-rose-100
            bg-rose-50 px-5 py-4
            text-[12px] font-medium
            text-rose-700
          "
        >
          <span>{error}</span>

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="
                appearance-none border-0
                bg-transparent p-1
                font-extrabold text-rose-700
                underline underline-offset-4
                hover:text-rose-900
              "
            >
              Try again
            </button>
          )}
        </div>
      )}

      {/* CONTENT */}

      {loading && safeMeetings.length === 0 ? (
        <HistoryLoading />
      ) : safeMeetings.length === 0 ? (
        <EmptyHistory onRefresh={onRefresh} />
      ) : (
        <div className="space-y-4">
          {safeMeetings.map((meeting, index) => (
            <MeetingHistoryCard
              key={
                meeting?._id ||
                meeting?.sessionId ||
                meeting?.roomId ||
                `meeting-${index}`
              }
              meeting={meeting}
              onRejoin={onRejoin}
              joiningMeeting={joiningMeeting}
            />
          ))}
        </div>
      )}
    </section>
  );
}