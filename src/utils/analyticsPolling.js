/**
 * Sequential auto-refresh controller for Admin Analytics.
 * Schedules the next poll only after the active request settles so slow
 * responses exceeding intervalMs still apply cleanly while stale responses
 * from superseded filters/tokens are ignored.
 */
export function startAnalyticsPolling({
  fetchAnalytics,
  onSuccess,
  onError,
  onStatusChange,
  seqRef,
  intervalMs = 10000,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout
}) {
  let cancelled = false;
  let timerId = null;
  let inFlight = false;

  const emitStatus = (status, error = null) => {
    if (!cancelled && typeof onStatusChange === 'function') {
      onStatusChange({ status, error });
    }
  };

  const scheduleNext = () => {
    if (cancelled || timerId !== null) return;
    timerId = setTimeoutFn(() => {
      timerId = null;
      if (!cancelled) {
        void runFetch();
      }
    }, intervalMs);
  };

  const runFetch = async () => {
    if (cancelled || inFlight) return;
    inFlight = true;
    const reqSeq = ++seqRef.current;
    emitStatus('loading', null);
    try {
      const data = await fetchAnalytics();
      if (!cancelled && data && reqSeq === seqRef.current) {
        onSuccess(data);
        emitStatus('idle', null);
      }
    } catch (err) {
      if (!cancelled && reqSeq === seqRef.current) {
        emitStatus('error', err?.message || 'Failed to sync analytics');
      }
      if (!cancelled && onError) {
        onError(err);
      }
    } finally {
      inFlight = false;
      scheduleNext();
    }
  };

  void runFetch();

  return () => {
    cancelled = true;
    if (timerId !== null) {
      clearTimeoutFn(timerId);
      timerId = null;
    }
  };
}
