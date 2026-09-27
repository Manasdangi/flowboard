import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * tailwind-merge taught about our custom theme tokens (see tailwind.config.ts).
 * Without this it wouldn't know `shadow-card` and `shadow-drag` conflict, and would keep both.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['2xs'] }],
      shadow: [{ shadow: ['card', 'card-hover', 'drag', 'pop', 'drawer', 'focus'] }],
      rounded: [{ rounded: ['control', 'card', 'panel'] }],
    },
  },
});

/**
 * Compose class names; later utilities win over earlier conflicting ones.
 * Falsy values are dropped, so conditions can go inline:
 *   cn('px-2', done && 'line-through', 'px-4') → 'line-through px-4' (when done is true)
 */
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
