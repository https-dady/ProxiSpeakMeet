import React from 'react';

const actions = [
  {
    id: 'create',
    number: '01',
    title: 'Create a meeting',
    description:
      'Start your own virtual office. Set up a space and invite people to collaborate.',
    buttonLabel: 'Create new meeting',
    icon: 'video',
    accent: 'purple',
  },
  {
    id: 'join',
    number: '02',
    title: 'Join a meeting',
    description:
      'Already have a meeting ID? Enter the room and connect with your team.',
    buttonLabel: 'Join existing meeting',
    icon: 'users',
    accent: 'lavender',
  },
];

function ActionIcon({ name, size = 23 }) {
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

    arrow: (
      <>
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </>
    ),

    plus: <path d="M12 5v14M5 12h14" />,
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

const themes = {
  purple: {
    icon: 'bg-[#EFEDFF] text-[#6252FF]',
    number: 'text-[#6252FF]/20',
    decoration: 'bg-[#6252FF]/[0.045]',
    button:
      'bg-[#6252FF] text-white hover:bg-[#5040E9] shadow-[0_8px_20px_rgba(98,82,255,0.18)]',
    border: 'hover:border-[#D7D0FF]',
  },

  lavender: {
    icon: 'bg-[#F0ECFF] text-[#8065E9]',
    number: 'text-[#8065E9]/20',
    decoration: 'bg-[#8065E9]/[0.045]',
    button:
      'bg-[#F0EDFF] text-[#6651D9] hover:bg-[#E6E0FF]',
    border: 'hover:border-[#DAD1FF]',
  },
};

function ActionCard({ action, onClick, disabled }) {
  const theme = themes[action.accent];

  return (
    <article
      className={`
        group relative isolate
        flex min-h-[260px]
        flex-col overflow-hidden
        rounded-[24px]
        border border-[#EBE8F7]
        bg-white p-6
        shadow-[0_5px_22px_rgba(40,35,90,0.025)]
        transition-all duration-500
        hover:-translate-y-1
        hover:shadow-[0_18px_40px_rgba(70,55,170,0.09)]
        sm:p-7
        ${theme.border}
        motion-reduce:transform-none
      `}
    >

      {/* DECORATIVE BACKGROUND */}

      <div className={`
        pointer-events-none absolute
        -right-16 -top-16
        h-48 w-48 rounded-full
        ${theme.decoration}
        transition-transform duration-700
        group-hover:scale-125
      `} />

      <div className="
        pointer-events-none absolute
        -bottom-20 right-12
        h-36 w-36 rounded-full
        border border-[#EFEDFF]
        opacity-70
        transition-transform duration-700
        group-hover:translate-x-3
      " />

      {/* CARD HEADER */}

      <div className="
        relative z-10
        flex items-start justify-between
      ">

        <div className={`
          flex h-[58px] w-[58px]
          items-center justify-center
          rounded-[19px]
          transition-all duration-500
          group-hover:scale-110
          group-hover:rotate-[-5deg]
          ${theme.icon}
        `}>
          <ActionIcon name={action.icon} size={26} />
        </div>

        <span className={`
          text-[34px]
          font-black
          tracking-[-2px]
          transition-all duration-500
          group-hover:translate-x-[-3px]
          ${theme.number}
        `}>
          {action.number}
        </span>

      </div>

      {/* CARD CONTENT */}

      <div className="
        relative z-10 mt-7
        flex-1
      ">

        <h2 className="
          text-[20px]
          font-extrabold
          tracking-[-0.7px]
          text-[#25263A]
          transition-colors duration-300
          group-hover:text-[#5949F7]
        ">
          {action.title}
        </h2>

        <p className="
          mt-2 max-w-[380px]
          text-[13px]
          leading-[1.8]
          text-[#89899F]
        ">
          {action.description}
        </p>

      </div>

      {/* ACTION BUTTON */}

      <div className="
        relative z-10 mt-6
      ">

        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          className={`
            appearance-none
            border-0
            outline-none
            shadow-none
            font-inherit
            flex min-h-[49px]
            w-full items-center
            justify-between gap-3
            rounded-[14px]
            px-4 py-3
            text-[12px]
            font-extrabold
            transition-all duration-300
            hover:-translate-y-0.5
            active:translate-y-0
            disabled:cursor-not-allowed
            disabled:opacity-50
            focus-visible:ring-2
            focus-visible:ring-[#6858FF]
            focus-visible:ring-offset-2
            ${theme.button}
          `}
        >

          <span className="
            flex items-center gap-2.5
          ">
            {action.id === 'create' && (
              <ActionIcon name="plus" size={18} />
            )}

            {action.buttonLabel}
          </span>

          <span className="
            flex h-8 w-8
            items-center justify-center
            rounded-[10px]
            bg-white/15
            transition-transform duration-300
            group-hover:translate-x-1
          ">
            <ActionIcon name="arrow" size={17} />
          </span>

        </button>

      </div>

    </article>
  );
}

export default function DashboardActions({
  onCreateMeeting,
  onJoinMeeting,
  disabled = false,
}) {
  const handlers = {
    create: onCreateMeeting,
    join: onJoinMeeting,
  };

  return (
    <section
      className="
        grid w-full
        grid-cols-1 gap-5
        lg:grid-cols-2
      "
      aria-label="Meeting actions"
    >
      {actions.map((action) => (
        <ActionCard
          key={action.id}
          action={action}
          onClick={handlers[action.id]}
          disabled={disabled}
        />
      ))}
    </section>
  );
}