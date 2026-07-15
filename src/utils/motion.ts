/**
 * Apple-style motion tokens — critically damped springs (bounce: 0).
 * Emil frequency gate + Jakub materialize polish.
 */

export const springSnappy = {
  type: 'spring',
  visualDuration: 0.12,
  bounce: 0,
} as const;

export const springSoft = {
  type: 'spring',
  visualDuration: 0.16,
  bounce: 0,
} as const;

export const springGentle = {
  type: 'spring',
  visualDuration: 0.2,
  bounce: 0,
} as const;

/** Pointer-down press feedback — Apple ~0.97, no overshoot */
export const pressScale = {
  whileTap: { scale: 0.97 },
  transition: springSnappy,
} as const;

/** View / panel enter: opacity + translateY + blur materialize */
export const viewEnter = {
  initial: { opacity: 0, y: 8, filter: 'blur(4px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -6, filter: 'blur(2px)' },
  transition: springSoft,
} as const;

/** Tab switch — snappier; mode=wait doubles perceived time */
export const tabEnter = {
  initial: { opacity: 0, y: 4, filter: 'blur(2px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -3, filter: 'blur(1px)' },
  transition: { type: 'spring', visualDuration: 0.1, bounce: 0 },
} as const;

/** Overlay / sheet enter — slightly more travel, subtler exit */
export const overlayEnter = {
  initial: { opacity: 0, y: 12, filter: 'blur(4px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, y: 8, filter: 'blur(2px)' },
  transition: springGentle,
} as const;

/** Centered dialog — scale from near-identity, never from 0 */
export const dialogEnter = {
  initial: { opacity: 0, y: 8, scale: 0.985, filter: 'blur(4px)' },
  animate: { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' },
  exit: { opacity: 0, y: 6, scale: 0.992, filter: 'blur(2px)' },
  transition: springSoft,
} as const;

export const fadeEnter = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: springSnappy,
} as const;

/** Stagger children on first paint — keep delay short */
export const staggerContainer = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.025,
      delayChildren: 0.01,
    },
  },
} as const;

export const staggerItem = {
  initial: { opacity: 0, y: 6, filter: 'blur(3px)' },
  animate: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: springSoft,
  },
} as const;
