import { describe, expect, it, vi } from 'vitest';
import { BACKGROUND_SESSION_TIMEOUT_MS, createSessionExpiryMonitor } from './session-expiry';

describe('session expiry monitor', () => {
  it('keeps the session when the app returns before ten minutes', () => {
    let now = 1_000;
    const expire = vi.fn();
    const monitor = createSessionExpiryMonitor(expire, () => now);

    monitor.deactivate();
    now += BACKGROUND_SESSION_TIMEOUT_MS - 1;
    monitor.activate();

    expect(expire).not.toHaveBeenCalled();
  });

  it('expires the session at exactly ten minutes', () => {
    let now = 1_000;
    const expire = vi.fn();
    const monitor = createSessionExpiryMonitor(expire, () => now);

    monitor.deactivate();
    now += BACKGROUND_SESSION_TIMEOUT_MS;
    monitor.activate();

    expect(expire).toHaveBeenCalledOnce();
  });

  it('expires the session after more than ten minutes', () => {
    let now = 1_000;
    const expire = vi.fn();
    const monitor = createSessionExpiryMonitor(expire, () => now);

    monitor.deactivate();
    now += BACKGROUND_SESSION_TIMEOUT_MS + 1;
    monitor.activate();

    expect(expire).toHaveBeenCalledOnce();
  });

  it('keeps the earliest timestamp across duplicate deactivation events', () => {
    let now = 1_000;
    const expire = vi.fn();
    const monitor = createSessionExpiryMonitor(expire, () => now);

    monitor.deactivate();
    now += BACKGROUND_SESSION_TIMEOUT_MS - 1;
    monitor.deactivate();
    now += 1;
    monitor.activate();

    expect(expire).toHaveBeenCalledOnce();
  });

  it('does not accumulate separate background periods', () => {
    let now = 1_000;
    const expire = vi.fn();
    const monitor = createSessionExpiryMonitor(expire, () => now);

    monitor.deactivate();
    now += BACKGROUND_SESSION_TIMEOUT_MS - 1;
    monitor.activate();
    monitor.deactivate();
    now += BACKGROUND_SESSION_TIMEOUT_MS - 1;
    monitor.activate();

    expect(expire).not.toHaveBeenCalled();
  });

  it('ignores activation without a preceding deactivation', () => {
    const expire = vi.fn();
    const monitor = createSessionExpiryMonitor(expire);

    monitor.activate();

    expect(expire).not.toHaveBeenCalled();
  });
});