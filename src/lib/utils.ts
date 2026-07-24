/**
 * Conditional className join for NativeWind.
 * ponytail: no conflict resolution (twMerge) — add `clsx` + `tailwind-merge`
 * if you start passing conflicting utilities like `p-2 p-4` conditionally.
 */
export function cn(...inputs: (string | false | null | undefined)[]): string {
  return inputs.filter(Boolean).join(' ');
}
