/**
 * Conditional className join for NativeWind.
 * ponytail: no conflict resolution (twMerge) — add `clsx` + `tailwind-merge`
 * if you start passing conflicting utilities like `p-2 p-4` conditionally.
 */
export function cn(...inputs: (string | false | null | undefined)[]): string {
  return inputs.filter(Boolean).join(' ');
}

/** 로컬 PK. 동기화가 id 기준 union이라 기기마다 겹치지 않아야 한다. */
export const newId = (): string =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
