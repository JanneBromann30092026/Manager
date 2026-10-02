import { useId } from 'react';
import { motion, type Variants } from 'motion/react';
import { cn } from '@/components/ui';

export type MarkState = 'idle' | 'working' | 'success' | 'error';

const lineVariants: Variants = {
  idle: { pathLength: 1, opacity: 1, transition: { duration: 0.3 } },
  // The rising line draws itself again and again while the key is derived.
  working: {
    pathLength: [0.05, 1],
    transition: { duration: 1.2, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' },
  },
  success: { pathLength: 1, opacity: 1, transition: { duration: 0.5, ease: 'easeOut' } },
  error: { pathLength: [1, 0.6, 1], transition: { duration: 0.45, ease: 'easeInOut' } },
};

const arrowVariants: Variants = {
  idle: { x: 0, y: 0, scale: 1 },
  working: { x: 0, y: 0, scale: 1 },
  // Key moment: the arrow shoots up and settles.
  success: {
    x: [0, 14, 0],
    y: [0, -14, 0],
    scale: [1, 1.12, 1],
    transition: { duration: 0.7, ease: 'easeOut' },
  },
  error: { x: [0, -8, 6, -4, 0], transition: { duration: 0.45 } },
};

const glowVariants: Variants = {
  idle: { opacity: 0.35, scale: 0.9 },
  working: {
    opacity: [0.35, 0.6, 0.35],
    scale: 1,
    transition: { duration: 1.8, repeat: Infinity },
  },
  success: { opacity: [0.9, 0.55], scale: [0.9, 1.25], transition: { duration: 0.9 } },
  error: { opacity: 0.35, scale: 0.9 },
};

/**
 * The app icon as a living mark: the rising line draws itself while the password is
 * checked and the arrow shoots up when the app unlocks (key moment with a soft glow).
 */
export function AppMark({ state, size = 112 }: { state: MarkState; size?: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return (
    <div className="relative" style={{ width: size, height: size }} data-state={state}>
      <motion.div
        aria-hidden
        className="lock-glow pointer-events-none absolute -inset-1/2 rounded-full"
        variants={glowVariants}
        initial="idle"
        animate={state}
      />
      <svg
        viewBox="0 0 512 512"
        width={size}
        height={size}
        aria-hidden
        className={cn('relative drop-shadow-[0_18px_40px_var(--shadow-color)]')}
      >
        <defs>
          <linearGradient id={`${uid}-bg`} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#061633" />
            <stop offset="0.55" stopColor="#0B5FA5" />
            <stop offset="1" stopColor="#4CC3FF" />
          </linearGradient>
          <radialGradient id={`${uid}-glow`} cx="72%" cy="28%" r="60%">
            <stop offset="0" stopColor="#BDEBFF" stopOpacity="0.35" />
            <stop offset="1" stopColor="#BDEBFF" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="512" height="512" rx="112" fill={`url(#${uid}-bg)`} />
        <rect width="512" height="512" rx="112" fill={`url(#${uid}-glow)`} />
        <g stroke="#9FE0FF" strokeOpacity="0.45" strokeWidth="8" strokeLinecap="round">
          <path d="M70 120 L150 120" />
          <path d="M70 146 L118 146" />
        </g>
        <path
          d="M168 150 Q168 126 190 138 L370 240 Q390 252 370 264 L190 372 Q168 384 168 360 Z"
          fill="#FFFFFF"
        />
        <motion.path
          d="M196 318 L246 272 L280 298 L392 182"
          fill="none"
          stroke="#0B5FA5"
          strokeWidth="22"
          strokeLinecap="round"
          strokeLinejoin="round"
          variants={lineVariants}
          initial="idle"
          animate={state}
        />
        <motion.path
          d="M340 172 L404 170 L402 234"
          fill="none"
          stroke="#0B5FA5"
          strokeWidth="22"
          strokeLinecap="round"
          strokeLinejoin="round"
          variants={arrowVariants}
          initial="idle"
          animate={state}
        />
      </svg>
    </div>
  );
}
