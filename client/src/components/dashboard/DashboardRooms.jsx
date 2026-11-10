import React from 'react';

function RoomIcon({ name, size = 20 }) {
  const icons = {
    video: (
      <>
        <rect x="3" y="5" width="13" height="14" rx="2" />
        <path d="m16 10 5-3v10l-5-3" />
      </>
    ),

    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="10" cy="7" r="4" />
        <path d="M20 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),

    refresh: (
      <>
        <path d="M20 7v5h-5" />
        <path d="M4 17v-5h5" />
        <path d="M5.6 9a7 7 0 0 1 11.8-2L20 12" />
        <path d="M4 12l2.6 5a7 7 0 0 0 11.8-2" />
      </>
    ),

    arrow: (
      <>
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </>
    ),

    sparkle: (
      <>
        <path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-2-5.8L4 11l6-2.2L12 3Z" />
        <path d="m19 14 1 2.5 2 1-2 1L19 21l-1-2.5-2-1 2-1 1-2.5Z" />
      </>
    ),

    building: (
      <>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3" />
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
      strokeWidth="1.8"
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

function LoadingRooms() {
  return (
    <div
      className="
        grid grid-cols-1 gap-5
        md:grid-cols-2
        xl:grid-cols-3
      "
      role="status"
      aria-label="Loading available rooms"
    >
      {[1, 2, 3].map((item) => (
        <div
          key={item}
          className="
            min-h-[205px]
            overflow-hidden
            rounded-[23px]
            border border-[#EBE8F7]
            bg-white p-6
          "
        >
          <div className="flex items-center gap-4">
            <div className="
              h-[52px] w-[52px]
              animate-pulse rounded-[17px]
              bg-[#EFEDFF]
            " />

            <div className="flex-1 space-y-3">
              <div className="
                h-4 w-2/3
                animate-pulse rounded-full
                bg-[#EFEDFF]
              " />

              <div className="
                h-3 w-1/2
                animate-pulse rounded-full
                bg-[#F3F1FA]
              " />
            </div>
          </div>

          <div className="
            mt-8 h-px bg-[#F0EDF7]
          " />

          <div className="
            mt-6 flex items-center justify-between
          ">
            <div className="
              h-3 w-24
              animate-pulse rounded-full
              bg-[#EFEDFF]
            " />

            <div className="
              h-10 w-28
              animate-pulse rounded-[12px]
              bg-[#EFEDFF]
            " />
          </div>
        </div>
      ))}

      <span className="
        sr-only
      ">
        Finding available rooms...
      </span>
    </div>
  );
}

/* =========================================
   EMPTY STATE
========================================= */

function EmptyRooms({ onCreateMeeting }) {
  return (
    <div className="
      relative isolate
      flex min-h-[340px]
      flex-col items-center
      justify-center overflow-hidden
      rounded-[26px]
      border border-dashed
      border-[#DCD8F3]
      bg-white px-6 py-12
      text-center
    ">

      {/* BACKGROUND DECORATION */}

      <div className="
        pointer-events-none absolute
        -right-16 -top-20
        h-56 w-56 rounded-full
        bg-[#EFEDFF]/70
      " />

      <div className="
        pointer-events-none absolute
        -bottom-28 -left-20
        h-64 w-64 rounded-full
        bg-[#F4F0FF]
      " />

      {/* ICON */}

      <div className="
        relative mb-7
        flex h-[94px] w-[94px]
        items-center justify-center
      ">

        <div className="
          absolute inset-0 rounded-full
          border border-[#DDD7FF]
          motion-safe:animate-pulse
        " />

        <div className="
          absolute inset-3 rounded-full
          border border-[#E9E5FF]
        " />

        <div className="
          relative z-10
          flex h-[58px] w-[58px]
          items-center justify-center
          rounded-[20px]
          bg-[#EFEDFF]
          text-[#6252FF]
          shadow-[0_8px_25px_rgba(98,82,255,0.10)]
        ">
          <RoomIcon name="video" size={27} />
        </div>

      </div>

      {/* CONTENT */}

      <div className="relative z-10">

        <span className="
          text-[10px] font-extrabold
          tracking-[2px] text-[#6858FF]
        ">
          YOUR WORKSPACE
        </span>

        <h3 className="
          mt-3 text-[21px]
          font-extrabold
          tracking-[-0.6px]
          text-[#25263A]
        ">
          No rooms available yet
        </h3>

        <p className="
          mx-auto mt-3 max-w-[400px]
          text-[13px] leading-7
          text-[#9292A7]
        ">
          Your workspace is waiting. Create your
          first virtual office and invite people
          to connect.
        </p>

        {onCreateMeeting && (
          <button
            type="button"
            onClick={onCreateMeeting}
            className="
              mt-7 inline-flex
              min-h-[48px]
              items-center justify-center
              gap-3 rounded-[14px]
              appearance-none border-0
              bg-[#6252FF] px-6
              text-[12px] font-extrabold
              text-white shadow-none
              transition-all duration-300
              hover:-translate-y-1
              hover:bg-[#5040E9]
              hover:shadow-[0_10px_25px_rgba(98,82,255,0.2)]
              focus-visible:outline-none
              focus-visible:ring-2
              focus-visible:ring-[#6252FF]
              focus-visible:ring-offset-2
            "
          >
            <RoomIcon name="sparkle" size={17} />
            Create your first room
            <RoomIcon name="arrow" size={16} />
          </button>
        )}

      </div>

    </div>
  );
}

/* =========================================
   ROOM CARD
========================================= */

function RoomCard({ room, onSelect, disabled }) {
  const roomName = room.name || room.roomId;
  const liveUsers = Number(room.liveUsers) || 0;

  return (
    <article className="
      group relative isolate
      flex min-h-[215px]
      flex-col overflow-hidden
      rounded-[23px]
      border border-[#EBE8F7]
      bg-white p-5
      shadow-[0_5px_22px_rgba(40,35,90,0.025)]
      transition-all duration-500
      hover:-translate-y-1
      hover:border-[#D8D1FF]
      hover:shadow-[0_18px_40px_rgba(70,55,170,0.08)]
    ">

      {/* BACKGROUND DECORATION */}

      <div className="
        pointer-events-none absolute
        -right-14 -top-16
        h-40 w-40 rounded-full
        bg-[#6252FF]/[0.045]
        transition-transform duration-700
        group-hover:scale-125
      " />

      {/* ROOM INFORMATION */}

      <div className="
        relative z-10
        flex items-start gap-4
      ">

        <div className="
          relative flex h-[54px] w-[54px]
          shrink-0 items-center justify-center
          overflow-hidden rounded-[17px]
          bg-[#EFEDFF]
          text-[#6252FF]
          transition-all duration-300
          group-hover:scale-105
        ">
          <RoomIcon name="building" size={23} />
        </div>

        <div className="
          min-w-0 flex-1
        ">

          <h3
            title={roomName}
            className="
              truncate text-[15px]
              font-extrabold
              tracking-[-0.4px]
              text-[#25263A]
              transition-colors duration-300
              group-hover:text-[#6252FF]
            "
          >
            {roomName}
          </h3>

          <div className="
            mt-2 flex flex-col gap-1
          ">

            <span className="
              text-[9px] font-extrabold
              tracking-[1.5px]
              text-[#A1A0B2]
            ">
              MEETING ID
            </span>

            <span className="
              truncate text-[12px]
              font-semibold
              tracking-[0.2px]
              text-[#77778F]
            ">
              {room.roomId}
            </span>

          </div>

        </div>

      </div>

      {/* DIVIDER */}

      <div className="
        relative z-10
        my-5 h-px bg-[#F0EDF7]
      " />

      {/* FOOTER */}

      <div className="
        relative z-10
        mt-auto flex items-center
        justify-between gap-3
      ">

        {/* LIVE USERS */}

        <div className="
          flex min-w-0 items-center gap-2
        ">

          <span className="
            relative flex h-2.5 w-2.5
            shrink-0 items-center justify-center
          ">
            <span className="
              absolute inset-0
              rounded-full bg-[#20B77A]/30
              motion-safe:animate-ping
            " />

            <span className="
              relative h-2 w-2
              rounded-full bg-[#20B77A]
            " />
          </span>

          <span className="
            whitespace-nowrap
            text-[11px] font-bold
            text-[#343449]
          ">
            {liveUsers}
          </span>

          <span className="
            truncate text-[10px]
            font-medium text-[#9292A7]
          ">
            {liveUsers === 1
              ? 'person online'
              : 'people online'}
          </span>

        </div>

        {/* JOIN BUTTON */}

        <button
          type="button"
          onClick={() => onSelect(room.roomId)}
          disabled={disabled || !onSelect}
          className="
            appearance-none border-0
            outline-none shadow-none
            flex min-h-[40px]
            shrink-0 items-center
            justify-center gap-2
            rounded-[12px]
            bg-[#EFEDFF] px-4
            text-[11px] font-extrabold
            text-[#6252FF]
            transition-all duration-300
            hover:-translate-y-0.5
            hover:bg-[#6252FF]
            hover:text-white
            active:translate-y-0
            disabled:cursor-not-allowed
            disabled:opacity-50
            focus-visible:ring-2
            focus-visible:ring-[#6252FF]
            focus-visible:ring-offset-2
          "
        >
          Join room
          <RoomIcon name="arrow" size={15} />
        </button>

      </div>

    </article>
  );
}

/* =========================================
   MAIN ROOMS COMPONENT
========================================= */

export default function DashboardRooms({
  rooms = [],
  loading = false,
  joiningRoom = false,
  onRefresh,
  onSelectRoom,
  onCreateMeeting,
}) {
  const validRooms = Array.isArray(rooms) ? rooms : [];

  return (
    <section className="
      w-full space-y-6
    ">

      {/* SECTION HEADER */}

      <div className="
        flex flex-wrap
        items-end justify-between
        gap-4
      ">

        <div>

          <div className="
            mb-3 flex items-center gap-2
            text-[10px] font-extrabold
            tracking-[1.8px]
            text-[#6252FF]
          ">
            <span className="
              h-2 w-2 rounded-full
              bg-[#6252FF]
              shadow-[0_0_0_4px_rgba(98,82,255,0.10)]
            " />

            DISCOVER YOUR SPACE
          </div>

          <h2 className="
            text-[24px]
            font-black
            tracking-[-0.9px]
            text-[#25263A]
          ">
            Available rooms
          </h2>

          <p className="
            mt-2 text-[13px]
            leading-6 text-[#9292A7]
          ">
            Find a workspace and join the conversation.
          </p>

        </div>

        {/* HEADER ACTIONS */}

        <div className="
          flex items-center gap-3
        ">

          <span className="
            rounded-full
            bg-[#EFEDFF]
            px-3.5 py-2
            text-[10px] font-extrabold
            tracking-[1px]
            text-[#6252FF]
          ">
            {validRooms.length}
            {' '}
            {validRooms.length === 1 ? 'ROOM' : 'ROOMS'}
          </span>

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading || !onRefresh}
            aria-label="Refresh available rooms"
            title="Refresh rooms"
            className="
              appearance-none border-0
              flex h-[39px] w-[39px]
              items-center justify-center
              rounded-[12px]
              bg-white
              text-[#77778F]
              shadow-[0_3px_12px_rgba(40,35,90,0.04)]
              ring-1 ring-inset ring-[#EBE8F7]
              transition-all duration-300
              hover:bg-[#EFEDFF]
              hover:text-[#6252FF]
              disabled:cursor-not-allowed
              disabled:opacity-40
              focus-visible:outline-none
              focus-visible:ring-2
              focus-visible:ring-[#6252FF]
            "
          >
            <span className={`
              ${loading ? 'motion-safe:animate-spin' : ''}
            `}>
              <RoomIcon name="refresh" size={17} />
            </span>
          </button>

        </div>

      </div>

      {/* DYNAMIC CONTENT */}

      {loading ? (
        <LoadingRooms />
      ) : validRooms.length === 0 ? (
        <EmptyRooms
          onCreateMeeting={onCreateMeeting}
        />
      ) : (
        <div className="
          grid grid-cols-1 gap-5
          md:grid-cols-2
          xl:grid-cols-3
        ">
          {validRooms.map((room) => (
            <RoomCard
              key={room.roomId}
              room={room}
              onSelect={onSelectRoom}
              disabled={joiningRoom}
            />
          ))}
        </div>
      )}

    </section>
  );
}