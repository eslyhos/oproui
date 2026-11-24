export const BACKGROUND_SESSION_TIMEOUT_MS = 10 * 60 * 1000;

export interface SessionExpiryMonitor {
  deactivate: () => void;
  activate: () => void;
}

export function createSessionExpiryMonitor(
  expire: () => void,
  now: () => number = Date.now,
): SessionExpiryMonitor {
  let inactiveSince: number | undefined;

  return {
    deactivate() {
      inactiveSince ??= now();
    },
    activate() {
      if (inactiveSince === undefined) return;

      const inactiveFor = now() - inactiveSince;
      inactiveSince = undefined;
      if (inactiveFor >= BACKGROUND_SESSION_TIMEOUT_MS) expire();
    },
  };
}