import React from 'react';

function HeroIcon({ name, size = 20 }) {
  const icons = {
    plus: <path d="M12 5v14M5 12h14" />,

    arrow: (
      <>
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
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

function ProximityVisual() {
  const people = [
    { label: 'T', position: 'top' },
    { label: 'A', position: 'right' },
    { label: 'M', position: 'bottom' },
    { label: 'S', position: 'left' },
  ];

  const positions = {
    top: 'left-1/2 top-0 -translate-x-1/2',
    right: 'right-0 top-1/2 -translate-y-1/2',
    bottom: 'bottom-0 left-1/2 -translate-x-1/2',
    left: 'left-0 top-1/2 -translate-y-1/2',
  };

  return (
    <div className="
      relative flex aspect-square w-full max-w-[390px]
      items-center justify-center
    ">

      {/* OUTER ORBITS */}

      <div className="
        absolute inset-[3%] rounded-full
        border border-white/20
        motion-safe:animate-[spin_35s_linear_infinite]
      " />

      <div className="
        absolute inset-[16%] rounded-full
        border border-white/25
        motion-safe:animate-[spin_28s_linear_infinite_reverse]
      " />

      <div className="
        absolute inset-[29%] rounded-full
        border border-white/30
      " />

      {/* ORBIT PULSE */}

      <div className="
        absolute inset-[29%] rounded-full
        border border-white/25
        motion-safe:animate-ping
        motion-safe:[animation-duration:4s]
      " />

      {/* CONNECTION LINES */}

      <div className="
        absolute left-1/2 top-[12%]
        h-[76%] w-px
        -translate-x-1/2
        bg-gradient-to-b
        from-transparent via-white/35 to-transparent
      " />

      <div className="
        absolute left-[12%] top-1/2
        h-px w-[76%]
        -translate-y-1/2
        bg-gradient-to-r
        from-transparent via-white/35 to-transparent
      " />

      {/* DIAGONAL CONNECTIONS */}

      <div className="
        absolute left-[26%] top-[26%]
        h-[48%] w-px rotate-45
        bg-white/15
      " />

      <div className="
        absolute right-[26%] top-[26%]
        h-[48%] w-px -rotate-45
        bg-white/15
      " />

      {/* CENTER */}

      <div className="
        relative z-10 flex h-[112px] w-[112px]
        items-center justify-center
        rounded-[32px]
        border border-white/25
        bg-white/15
        text-white
        shadow-[0_15px_60px_rgba(40,25,150,0.2)]
        backdrop-blur-xl
        transition-transform duration-500
        hover:scale-110
      ">
        <div className="
          absolute inset-3 rounded-[25px]
          border border-white/15
        " />

        <HeroIcon name="users" size={43} />
      </div>

      {/* PEOPLE */}

      {people.map((person, index) => (
        <div
          key={person.position}
          className={`
            absolute z-20
            ${positions[person.position]}
            flex h-[48px] w-[48px]
            items-center justify-center
            rounded-[15px]
            border border-white/70
            bg-white text-[15px]
            font-extrabold text-[#5949F7]
            shadow-[0_8px_25px_rgba(38,25,130,0.16)]
            transition-all duration-500
            hover:scale-125 hover:-translate-y-1
            motion-safe:animate-[float_4s_ease-in-out_infinite]
          `}
          style={{
            animationDelay: `${index * 0.45}s`,
          }}
        >
          {person.label}
        </div>
      ))}

      {/* FLOATING PARTICLES */}

      <span className="
        absolute left-[18%] top-[20%]
        h-2 w-2 rounded-full
        bg-[#C8F7E8]
        shadow-[0_0_15px_rgba(200,247,232,0.9)]
        motion-safe:animate-pulse
      " />

      <span className="
        absolute bottom-[18%] right-[19%]
        h-2.5 w-2.5 rounded-full
        bg-white/80
        motion-safe:animate-pulse
      " />

      <span className="
        absolute right-[15%] top-[25%]
        h-1.5 w-1.5 rounded-full
        bg-[#E5DF98]
        motion-safe:animate-pulse
      " />

    </div>
  );
}

export default function DashboardHero({
  username,
  onCreateMeeting,
  onJoinMeeting,
  disabled = false,
}) {
  const displayName = username || 'there';

  return (
    <section className="w-full">

      {/* WELCOME HEADING */}

      <div className="mb-8 sm:mb-9">

        <div className="
          mb-4 flex items-center gap-2
          text-[11px] font-extrabold
          tracking-[2px] text-[#6454FF]
        ">
          <span className="
            h-2 w-2 rounded-full
            bg-[#6555FF]
            shadow-[0_0_0_5px_rgba(101,85,255,0.10)]
          " />

          YOUR WORKSPACE
        </div>

        <h1 className="
          text-[clamp(28px,3.2vw,43px)]
          font-black leading-[1.15]
          tracking-[-1.8px]
          text-[#222337]
        ">
          Welcome back,{' '}
          <span className="
            break-words text-[#6454FF]
          ">
            {displayName}
          </span>
        </h1>

        <p className="
          mt-3 max-w-[650px]
          text-[14px] leading-7
          text-[#88899F]
          sm:text-[16px]
        ">
          Your space for meaningful conversations
          and collaboration.
        </p>

      </div>

      {/* HERO BANNER */}

      <div className="
        group relative isolate
        min-h-[390px] w-full
        overflow-hidden
        rounded-[28px]
        bg-gradient-to-br
        from-[#5341F5]
        via-[#6958F6]
        to-[#8879FA]
        shadow-[0_25px_65px_rgba(91,75,230,0.18)]
        transition-shadow duration-500
        hover:shadow-[0_30px_80px_rgba(91,75,230,0.24)]
        sm:min-h-[420px]
        xl:min-h-[455px]
      ">

        {/* BACKGROUND DECORATIONS */}

        <div className="
          pointer-events-none absolute
          -right-24 -top-40
          h-[360px] w-[360px]
          rounded-full
          border border-white/10
          bg-white/[0.06]
          transition-transform duration-1000
          group-hover:scale-110
        " />

        <div className="
          pointer-events-none absolute
          -bottom-56 right-[20%]
          h-[390px] w-[390px]
          rounded-full
          border border-white/10
          bg-white/[0.045]
        " />

        <div className="
          pointer-events-none absolute
          bottom-[-100px] left-[38%]
          h-[260px] w-[260px]
          rounded-full
          bg-[#B8A9FF]/10
          blur-[2px]
        " />

        <div className="
          pointer-events-none absolute
          inset-0 opacity-[0.12]
          [background-image:radial-gradient(rgba(255,255,255,0.7)_0.7px,transparent_0.7px)]
          [background-size:22px_22px]
        " />

        {/* MAIN CONTENT */}

        <div className="
          relative z-10 grid h-full
          min-h-[390px]
          grid-cols-1 items-center
          px-7 py-10
          sm:px-10 sm:py-12
          lg:min-h-[420px]
          lg:grid-cols-[1.3fr_0.7fr]
          lg:px-12
          xl:min-h-[455px]
          xl:px-14
        ">

          {/* LEFT */}

          <div className="max-w-[660px]">

            {/* BADGE */}

            <div className="
              mb-8 inline-flex items-center
              gap-2.5 rounded-full
              border border-white/25
              bg-white/10
              px-4 py-2.5
              text-[10px] font-extrabold
              tracking-[1.6px] text-white
              shadow-sm backdrop-blur-md
            ">
              <span className="
                h-2 w-2 rounded-full
                bg-[#9CF5D2]
                shadow-[0_0_12px_rgba(156,245,210,0.9)]
                motion-safe:animate-pulse
              " />

              PROXISPEAK MEET
            </div>

            {/* HEADING */}

            <h2 className="
              max-w-[640px]
              text-[clamp(31px,3.5vw,49px)]
              font-black leading-[1.13]
              tracking-[-1.9px]
              text-white
            ">
              Your virtual office.
              <br className="hidden sm:block" />
              Your people. Your space.
            </h2>

            {/* DESCRIPTION */}

            <p className="
              mt-6 max-w-[580px]
              text-[14px] leading-[1.9]
              text-white/80
              sm:text-[16px]
            ">
              Create a meeting or join an existing
              workspace and connect with people
              through proximity-powered audio.
            </p>

            {/* ACTION BUTTONS */}

            <div className="
              mt-8 flex flex-wrap
              items-center gap-3
            ">

              <button
                type="button"
                onClick={onCreateMeeting}
                disabled={disabled}
                className="
                  appearance-none border-0
                  flex min-h-[56px]
                  items-center justify-center
                  gap-3 rounded-[16px]
                  bg-white px-6
                  text-[13px] font-extrabold
                  text-[#5949F7]
                  shadow-[0_8px_25px_rgba(35,25,120,0.12)]
                  transition-all duration-300
                  hover:-translate-y-1
                  hover:bg-[#F5F2FF]
                  hover:shadow-[0_15px_30px_rgba(35,25,120,0.2)]
                  active:translate-y-0
                  disabled:cursor-not-allowed
                  disabled:opacity-50
                  focus-visible:outline-none
                  focus-visible:ring-2
                  focus-visible:ring-white
                  focus-visible:ring-offset-2
                  focus-visible:ring-offset-[#6454FF]
                "
              >
                <HeroIcon name="plus" size={21} />
                Create meeting
              </button>

              <button
                type="button"
                onClick={onJoinMeeting}
                disabled={disabled}
                className="
                  appearance-none border-0
                  flex min-h-[56px]
                  items-center justify-center
                  gap-3 rounded-[16px]
                  bg-white/10 px-6
                  text-[13px] font-extrabold
                  text-white
                  ring-1 ring-inset ring-white/35
                  backdrop-blur-sm
                  transition-all duration-300
                  hover:-translate-y-1
                  hover:bg-white/20
                  hover:ring-white/60
                  active:translate-y-0
                  disabled:cursor-not-allowed
                  disabled:opacity-50
                  focus-visible:outline-none
                  focus-visible:ring-2
                  focus-visible:ring-white
                  focus-visible:ring-offset-2
                  focus-visible:ring-offset-[#6454FF]
                "
              >
                Join a meeting
                <HeroIcon name="arrow" size={18} />
              </button>

            </div>

          </div>

          {/* RIGHT VISUAL */}

          <div className="
            relative hidden
            items-center justify-center
            lg:flex
          ">
            <ProximityVisual />
          </div>

        </div>

        {/* BOTTOM BRAND MESSAGE */}

        <div className="
          pointer-events-none absolute
          bottom-7 right-10
          hidden items-center gap-2
          text-[9px] font-extrabold
          tracking-[2px] text-white/55
          xl:flex
        ">
          <span className="
            h-1.5 w-1.5 rounded-full
            bg-[#9CF5D2]
          " />

          CONNECT. COLLABORATE. BELONG.
        </div>

      </div>

    </section>
  );
}