import React from 'react';

const statItems = [
  {
    id: 'rooms',
    label: 'Available rooms',
    description: 'Ready to explore',
    icon: 'video',
    theme: 'purple',
  },
  {
    id: 'meetings',
    label: 'Recent meetings',
    description: 'Your recent activity',
    icon: 'history',
    theme: 'green',
  },
  {
    id: 'workspace',
    label: 'Your workspace',
    description: 'Everything looks good',
    icon: 'sparkle',
    theme: 'yellow',
  },
];

function StatIcon({ name }) {
  const icons = {
    video: (
      <>
        <rect x="3" y="5" width="13" height="14" rx="2" />
        <path d="m16 10 5-3v10l-5-3" />
      </>
    ),

    history: (
      <>
        <path d="M3 12a9 9 0 1 0 2.64-6.36L3 8" />
        <path d="M3 3v5h5" />
        <path d="M12 7v5l3 2" />
      </>
    ),

    sparkle: (
      <>
        <path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-2-5.8L4 11l6-2.2L12 3Z" />
        <path d="m19 14 1 2.5 2 1-2 1L19 21l-1-2.5-2-1 2-1 1-2.5Z" />
      </>
    ),
  };

  return (
    <svg
      width="23"
      height="23"
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

const themes = {
  purple: {
    icon: 'bg-[#EFEDFF] text-[#6252FF]',
    decoration: 'bg-[#6252FF]/[0.045]',
    indicator: 'bg-[#6252FF]',
  },

  green: {
    icon: 'bg-[#E9F9F1] text-[#20B77A]',
    decoration: 'bg-[#20B77A]/[0.045]',
    indicator: 'bg-[#20B77A]',
  },

  yellow: {
    icon: 'bg-[#FFF7E5] text-[#E6A21B]',
    decoration: 'bg-[#E6A21B]/[0.045]',
    indicator: 'bg-[#E6A21B]',
  },
};

function StatCard({ item, value, index }) {
  const theme = themes[item.theme];

  return (
    <article
      className="
        group relative isolate
        flex min-h-[116px]
        items-center gap-4
        overflow-hidden
        rounded-[23px]
        border border-[#EBE8F7]
        bg-white
        px-5 py-5
        shadow-[0_5px_22px_rgba(40,35,90,0.025)]
        transition-all duration-500
        hover:-translate-y-1
        hover:border-[#DCD6FF]
        hover:shadow-[0_16px_35px_rgba(70,55,170,0.08)]
        sm:px-6
        motion-reduce:transform-none
      "
      style={{
        animationDelay: `${index * 100}ms`,
      }}
    >

      {/* BACKGROUND DECORATION */}

      <div className={`
        pointer-events-none absolute
        -right-10 -top-10
        h-32 w-32 rounded-full
        ${theme.decoration}
        transition-transform duration-700
        group-hover:scale-150
      `} />

      {/* ICON */}

      <div className={`
        relative z-10
        flex h-[58px] w-[58px]
        shrink-0 items-center justify-center
        rounded-[19px]
        transition-all duration-500
        group-hover:scale-110
        group-hover:rotate-[-5deg]
        ${theme.icon}
      `}>
        <StatIcon name={item.icon} />
      </div>

      {/* CONTENT */}

      <div className="
        relative z-10
        flex min-w-0 flex-1
        flex-col items-start
        justify-center gap-1
      ">

        <strong className="
          block text-[25px]
          font-black leading-tight
          tracking-[-1px]
          text-[#25263A]
          transition-colors duration-300
          group-hover:text-[#5949F7]
        ">
          {value}
        </strong>

        <span className="
          block text-[13px]
          font-semibold leading-5
          text-[#66677F]
        ">
          {item.label}
        </span>

        <span className="
          mt-0.5 block
          text-[10px]
          font-medium
          text-[#A0A0B2]
        ">
          {item.description}
        </span>

      </div>

      {/* STATUS INDICATOR */}

      <span className={`
        relative z-10
        mb-auto mt-1
        h-2 w-2 shrink-0
        rounded-full
        opacity-70
        ${theme.indicator}
      `} />

    </article>
  );
}

export default function DashboardStats({
  roomCount = 0,
  meetingCount = 0,
}) {
  const values = {
    rooms: roomCount,
    meetings: meetingCount,
    workspace: 'Ready',
  };

  return (
    <section
      className="
        grid w-full
        grid-cols-1 gap-4
        sm:grid-cols-2
        xl:grid-cols-3
      "
      aria-label="Workspace overview"
    >
      {statItems.map((item, index) => (
        <StatCard
          key={item.id}
          item={item}
          value={values[item.id]}
          index={index}
        />
      ))}
    </section>
  );
}