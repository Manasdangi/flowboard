import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/** tailwind-merge taught about our custom theme tokens (see tailwind.config.ts). */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['2xs'] }],
      shadow: [{ shadow: ['card', 'card-hover', 'drag', 'pop', 'drawer', 'focus'] }],
      rounded: [{ rounded: ['control', 'card', 'panel'] }],
    },
  },
});

/** Compose class names; later utilities win over earlier conflicting ones. */
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
