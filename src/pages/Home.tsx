import { Link } from 'react-router-dom';

interface Option {
  title: string;
  href: string;
  available: boolean;
  badge?: string;
}

const GROUPS = [
  {
    label: 'With AI Assumptions Panel',
    options: [
      {
        title: 'AI Assumptions (Neutral)',
        href: '/ai-assumption-two-dimension',
        available: true,
      },
      // {
      //   title: 'AI Assumptions (Challenging)',
      //   href: '/ai-assumption-two-dimension-challenging',
      //   available: true,
      // },
      // {
      //   title: 'AI Assumptions (Sycophantic)',
      //   href: '/ai-assumption-two-dimension-sycophantic',
      //   available: true,
      // },
    ],
  },
  {
    label: 'Self-Report Only',
    options: [
      {
        title: 'No AI Assumption (Neutral)',
        href: '/no-assumption-neutral',
        available: true,
      },
      // {
      //   title: 'No AI Assumption (Challenging)',
      //   href: '/no-assumption-challenging',
      //   available: true,
      // },
      // {
      //   title: 'No AI Assumption (Sycophantic)',
      //   href: '/no-assumption-sycophantic',
      //   available: true,
      // },
    ],
  },
  {
    label: 'Legacy',
    options: [
      {
        title: 'AI Assumptions: Six Dimensions, 04/30/2026',
        href: '/ai-assumption-six-dimension',
        available: true,
      },
    ],
  },
]

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-8 py-12">
      <div className="flex flex-col w-full max-w-5xl gap-8">
        {GROUPS.map((group) => (
          <div key={group.label}>
            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest mb-3">{group.label}</p>
            <div className="flex flex-wrap gap-4">
              {group.options.map((opt, i) => (
                <OptionCard key={i} option={opt} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function OptionCard({ option }: { option: Option }) {
  const base = 'group flex flex-col w-48 border px-5 py-6 transition-all'

  if (!option.available) {
    return (
      <div className={`${base} border-zinc-100 bg-zinc-50 cursor-not-allowed opacity-50`}>
        <span className="text-xs font-medium text-zinc-400 leading-snug">{option.title}</span>
        {option.badge && (
          <span className="mt-2 self-start rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
            {option.badge}
          </span>
        )}
      </div>
    )
  }

  return (
    <Link
      to={option.href}
      className={`${base} border-zinc-200 bg-white hover:border-zinc-900 hover:shadow-sm`}
    >
      <span className="text-xs font-medium text-zinc-900 leading-snug">{option.title}</span>
    </Link>
  )
}
