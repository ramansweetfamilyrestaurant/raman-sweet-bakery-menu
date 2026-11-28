import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Clock, 
  Maximize2, 
  Minimize2, 
  Flame, 
  Bell, 
  BellRing,
  AlertTriangle, 
  Lock, 
  KeyRound, 
  CheckCircle, 
  Delete, 
  LogOut,
  RotateCcw,
  Layers,
  CheckSquare,
  Square,
  Wifi,
  WifiOff,
  RefreshCw,
  ExternalLink,
  Store,
  Volume2,
  VolumeX,
  UtensilsCrossed,
  CheckCircle2
} from 'lucide-react';
import {
  playKitchenSiren,
  playKdsChime,
  unlockNotificationSound,
  isNotificationSoundReady,
  subscribeAudioState
} from '../../../utils/soundManager';
import { resolveBusinessOrderNumber, resolveTakeawayToken } from '../../../utils/orderNumberHelper';
import { filterActiveKitchenOrders } from '../../../utils/kdsQueueFilter';
import {
  resolveKdsSlug,
  parseRecallErrorResponse,
  calculateConnectionStatus,
  getKdsSoundPreference,
  setKdsSoundPreference,
  shouldShowKdsSoundPrompt
} from '../../../utils/kdsHelpers';
import { getBusinessTerminology } from '../../../utils/businessTaxonomy';

export default function StandaloneKdsPage({ slug = '' }) {
  const [polledOrders, setPolledOrders] = useState([]);
  const [optimisticRecalledOrders, setOptimisticRecalledOrders] = useState([]);
  const [completingOrderIds, setCompletingOrderIds] = useState([]);
  const pendingCompletingSnapshotsRef = useRef(new Map());
  const orders = useMemo(() => {
    let baseList = polledOrders;
    if (completingOrderIds.length > 0 && pendingCompletingSnapshotsRef.current.size > 0) {
      const polledIds = new Set(polledOrders.map(o => String(o.id)));
      const pendingSnapshots = [];
      for (const cid of completingOrderIds) {
        const ck = String(cid);
        if (!polledIds.has(ck)) {
          const entry = pendingCompletingSnapshotsRef.current.get(ck);
          if (entry && entry.order) {
            pendingSnapshots.push(entry.order);
          }
        }
      }
      if (pendingSnapshots.length > 0) {
        baseList = filterActiveKitchenOrders([...polledOrders, ...pendingSnapshots]);
      }
    }
    if (optimisticRecalledOrders.length === 0) return baseList;
    const baseIds = new Set(baseList.map(o => String(o.id)));
    const extraRecalled = optimisticRecalledOrders.filter(o => o && !baseIds.has(String(o.id)));
    return extraRecalled.length > 0
      ? filterActiveKitchenOrders([...extraRecalled, ...baseList])
      : baseList;
  }, [polledOrders, optimisticRecalledOrders, completingOrderIds]);
  const [restaurantName, setRestaurantName] = useState('Kitchen Display System');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [kdsDisabled, setKdsDisabled] = useState(false);
  const [needsPinUnlock, setNeedsPinUnlock] = useState(false);
  const [pinUnconfigured, setPinUnconfigured] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinSubmitting, setPinSubmitting] = useState(false);
  const [resolvedSlug, setResolvedSlug] = useState(() => {
    return resolveKdsSlug({
      slug,
      pathname: typeof window !== 'undefined' ? window.location.pathname : '',
      search: typeof window !== 'undefined' ? window.location.search : ''
    });
  });
  const [soundPreference, setSoundPreference] = useState(() => {
    const initialSlug = resolveKdsSlug({
      slug,
      pathname: typeof window !== 'undefined' ? window.location.pathname : '',
      search: typeof window !== 'undefined' ? window.location.search : ''
    });
    return initialSlug ? getKdsSoundPreference(initialSlug) : '';
  });
  const [isAudioReady, setIsAudioReady] = useState(() => {
    return typeof isNotificationSoundReady === 'function' ? isNotificationSoundReady() : false;
  });
  const [audioUnlocked, setAudioUnlocked] = useState(() => {
    return typeof isNotificationSoundReady === 'function' ? isNotificationSoundReady() : false;
  });
  const [restaurantMeta, setRestaurantMeta] = useState(null);
  const terminology = getBusinessTerminology(restaurantMeta || {});
  const [checkedItemsMap, setCheckedItemsMap] = useState({});
  const [showPrepSummary, setShowPrepSummary] = useState(true);
  const [recentlyCompleted, setRecentlyCompleted] = useState([]);
  const [showCompletedDrawer, setShowCompletedDrawer] = useState(false);

  // P3 States: Shared-device safety, recall UX & connection status
  const [needsTenantPrompt, setNeedsTenantPrompt] = useState(false);
  const [tenantSlugInput, setTenantSlugInput] = useState('');
  const [recallingOrderIds, setRecallingOrderIds] = useState([]);
  const [recallNotice, setRecallNotice] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('online'); // 'online' | 'reconnecting' | 'offline'
  const [lastSyncTime, setLastSyncTime] = useState(null);

  // Lifecycle & concurrency refs
  const isMountedRef = useRef(true);
  const isPollingInProgressRef = useRef(false);
  const pollingAbortControllerRef = useRef(null);
  const fetchOrdersRef = useRef(null);
  const actionGenRef = useRef(0);
  const pollGenRef = useRef(0);
  const currentPollSlugRef = useRef('');
  const consecutiveFailuresRef = useRef(0);
  const sirenIntervalRef = useRef(null);
  const sirenTimeoutRef = useRef(null);
  const knownOrderIdsRef = useRef(null);
  const optimisticRecallsRef = useRef(new Map());
  const unconfirmedCompletionsRef = useRef(new Map());
  const orderActionSeqRef = useRef(new Map());
  const kdsMutationSeqRef = useRef(0);
  const orderLastMutationRef = useRef(new Map());
  const pendingForceRefreshRef = useRef(false);
  const pinAttemptGenRef = useRef(0);
  const pinTimeoutRef = useRef(null);

  /**
   * Resolve current slug strictly from URL path or explicit ?slug= query param.
   * STRICTLY ignores localStorage.touchqr_admin_slug and touchqr_last_slug to prevent
   * shared kitchen tablet leakage.
   */
  const resolveCurrentSlug = () => {
    return resolveKdsSlug({
      slug,
      pathname: typeof window !== 'undefined' ? window.location.pathname : '',
      search: typeof window !== 'undefined' ? window.location.search : ''
    });
  };

  const getStoredKdsToken = (targetSlug) => {
    if (!targetSlug || typeof localStorage === 'undefined') return '';
    return localStorage.getItem(`touchqr_kds_token_${targetSlug}`) || '';
  };

  const setStoredKdsToken = (targetSlug, token) => {
    if (!targetSlug || typeof localStorage === 'undefined') return;
    localStorage.setItem(`touchqr_kds_token_${targetSlug}`, token);
  };

  const clearStoredKdsToken = (targetSlug) => {
    if (!targetSlug || typeof localStorage === 'undefined') return;
    localStorage.removeItem(`touchqr_kds_token_${targetSlug}`);
  };

  // Clock updater & component unmount lifecycle tracking
  useEffect(() => {
    isMountedRef.current = true;
    const timer = setInterval(() => {
      if (isMountedRef.current) {
        setCurrentTime(new Date());
      }
    }, 1000);

    return () => {
      isMountedRef.current = false;
      clearInterval(timer);
      stopSiren();
      if (pollingAbortControllerRef.current) {
        try { pollingAbortControllerRef.current.abort(); } catch (e) {}
      }
    };
  }, []);

  // Browser online/offline event listeners as supplemental signals
  useEffect(() => {
    const handleOnline = () => {
      if (isMountedRef.current && typeof fetchOrdersRef.current === 'function') {
        fetchOrdersRef.current();
      }
    };
    const handleOffline = () => {
      if (isMountedRef.current) {
        setConnectionStatus('offline');
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auto-dismiss recall notice banner after 6 seconds
  useEffect(() => {
    if (!recallNotice) return;
    const timer = setTimeout(() => {
      if (isMountedRef.current) {
        setRecallNotice(null);
      }
    }, 6000);
    return () => clearTimeout(timer);
  }, [recallNotice]);

  // Synchronize resolved tenant slug from prop, URL pathname, query, and history navigation
  useEffect(() => {
    const updateResolvedSlug = () => {
      const next = resolveKdsSlug({
        slug,
        pathname: typeof window !== 'undefined' ? window.location.pathname : '',
        search: typeof window !== 'undefined' ? window.location.search : ''
      });
      setResolvedSlug(next);
    };

    updateResolvedSlug();

    window.addEventListener('popstate', updateResolvedSlug);
    return () => {
      window.removeEventListener('popstate', updateResolvedSlug);
    };
  }, [slug]);

  // Sync sound preference when resolved tenant slug changes or resolves
  useEffect(() => {
    if (resolvedSlug) {
      const pref = getKdsSoundPreference(resolvedSlug);
      setSoundPreference(pref);
      if (pref === 'enabled') {
        const ready = typeof isNotificationSoundReady === 'function' && isNotificationSoundReady();
        setAudioUnlocked(ready);
      } else if (pref === 'muted') {
        setAudioUnlocked(false);
      } else {
        setAudioUnlocked(false);
      }
    } else {
      setSoundPreference('');
      setAudioUnlocked(false);
    }
  }, [resolvedSlug]);

  // Subscribe to AudioContext readiness and listen for user gestures to unlock audio
  useEffect(() => {
    const unsubscribe = subscribeAudioState((ready) => {
      if (isMountedRef.current) {
        setIsAudioReady(ready);
        setAudioUnlocked(ready);
      }
    });

    // Attempt silent unlock (works if user has engaged with domain or autoplay permitted)
    unlockNotificationSound().then((success) => {
      if (success && isMountedRef.current) {
        setIsAudioReady(true);
        setAudioUnlocked(true);
      }
    }).catch(() => {});

    // Passive gesture listener: silently resumes AudioContext on user interaction with KDS
    const handleGestureUnlock = () => {
      unlockNotificationSound().then((success) => {
        if (success && isMountedRef.current) {
          setIsAudioReady(true);
          setAudioUnlocked(true);
          const currentSlug = resolveCurrentSlug();
          if (currentSlug && !getKdsSoundPreference(currentSlug)) {
            setKdsSoundPreference(currentSlug, 'enabled');
            setSoundPreference('enabled');
          }
        }
      }).catch(() => {});
    };

    const gestureEvents = ['click', 'touchstart', 'pointerdown', 'keydown'];
    gestureEvents.forEach(evt => window.addEventListener(evt, handleGestureUnlock, { passive: true }));

    return () => {
      unsubscribe();
      gestureEvents.forEach(evt => window.removeEventListener(evt, handleGestureUnlock));
    };
  }, []);

  const stopSiren = () => {
    if (sirenIntervalRef.current) {
      clearInterval(sirenIntervalRef.current);
      sirenIntervalRef.current = null;
    }
    if (sirenTimeoutRef.current) {
      clearTimeout(sirenTimeoutRef.current);
      sirenTimeoutRef.current = null;
    }
  };

  const playSiren = () => {
    try {
      playKitchenSiren();
    } catch (e) {
      console.warn('Standalone KDS Siren error:', e);
    }
  };

  const playSirenFor8Seconds = () => {
    try {
      const currentSlug = resolveCurrentSlug();
      const pref = currentSlug ? getKdsSoundPreference(currentSlug) : soundPreference;
      if (pref === 'muted') {
        return;
      }

      // Clear any existing active timer before starting replacement sequence
      stopSiren();
      if (!isMountedRef.current) return;

      playSiren();
      const startTime = Date.now();
      sirenIntervalRef.current = setInterval(() => {
        if (!isMountedRef.current || Date.now() - startTime >= 8000) {
          stopSiren();
        } else {
          playSiren();
        }
      }, 2600);

      sirenTimeoutRef.current = setTimeout(() => {
        stopSiren();
      }, 8200);
    } catch (e) {
      console.warn('8-second Siren error:', e);
    }
  };

  const unlockAudio = () => {
    const currentSlug = resolveCurrentSlug();
    if (currentSlug) {
      setKdsSoundPreference(currentSlug, 'enabled');
      setSoundPreference('enabled');
    }

    unlockNotificationSound().then((success) => {
      if (success && isMountedRef.current) {
        setIsAudioReady(true);
        setAudioUnlocked(true);
        try { playKdsChime(); } catch (e) {}
      } else if (isMountedRef.current) {
        setIsAudioReady(false);
        setAudioUnlocked(false);
      }
    }).catch((err) => {
      // Audio unlock failure must NOT reset saved sound preference or crash app
      console.warn('KDS audio unlock failed:', err);
      if (isMountedRef.current) {
        setIsAudioReady(false);
        setAudioUnlocked(false);
      }
    });
  };

  const handleToggleSound = () => {
    const currentSlug = resolveCurrentSlug();
    if (soundPreference === 'muted') {
      if (currentSlug) {
        setKdsSoundPreference(currentSlug, 'enabled');
        setSoundPreference('enabled');
      }
      unlockNotificationSound().then((success) => {
        if (success && isMountedRef.current) {
          setIsAudioReady(true);
          setAudioUnlocked(true);
          try { playKdsChime(); } catch (e) {}
        } else if (isMountedRef.current) {
          setIsAudioReady(false);
          setAudioUnlocked(false);
        }
      }).catch((err) => {
        console.warn('KDS sound toggle audio unlock failed:', err);
        if (isMountedRef.current) {
          setIsAudioReady(false);
          setAudioUnlocked(false);
        }
      });
    } else if (!isAudioReady && soundPreference === 'enabled') {
      unlockNotificationSound().then((success) => {
        if (success && isMountedRef.current) {
          setIsAudioReady(true);
          setAudioUnlocked(true);
          try { playKdsChime(); } catch (e) {}
        } else if (isMountedRef.current) {
          setIsAudioReady(false);
          setAudioUnlocked(false);
        }
      }).catch((err) => {
        console.warn('KDS retry audio unlock failed:', err);
        if (isMountedRef.current) {
          setIsAudioReady(false);
          setAudioUnlocked(false);
        }
      });
    } else {
      if (currentSlug) {
        setKdsSoundPreference(currentSlug, 'muted');
        setSoundPreference('muted');
      }
      setAudioUnlocked(false);
      stopSiren();
    }
  };

  /**
   * Fetch kitchen orders with in-flight request guard and AbortController.
   * Prevents overlapping polls, invalidates stale tenant responses, and catches AbortError safely.
   */
  const fetchOrders = async ({ force = false } = {}) => {
    const targetSlug = resolveCurrentSlug();
    currentPollSlugRef.current = targetSlug;

    // Shared device safety: If slug is missing, display prompt and dispatch ZERO API calls
    if (!targetSlug) {
      setNeedsTenantPrompt(true);
      setLoading(false);
      return;
    }

    setNeedsTenantPrompt(false);

    // In-flight guard: coalesce forced refreshes rather than aborting an active GET
    if (isPollingInProgressRef.current) {
      if (force) {
        pendingForceRefreshRef.current = true;
      }
      return;
    }

    const token = getStoredKdsToken(targetSlug);
    if (!token) {
      setNeedsPinUnlock(true);
      setLoading(false);
      return;
    }

    isPollingInProgressRef.current = true;

    const abortController = new AbortController();
    pollingAbortControllerRef.current = abortController;
    const sessionGen = actionGenRef.current;
    const pollGen = pollGenRef.current;
    const pollStartMutationSeq = kdsMutationSeqRef.current;
    const isStalePoll = () => (
      !isMountedRef.current ||
      currentPollSlugRef.current !== targetSlug ||
      sessionGen !== actionGenRef.current ||
      pollGen !== pollGenRef.current
    );

    const pollTimeoutMs = 10000;
    let pollTimedOut = false;
    const pollTimeoutId = setTimeout(() => {
      pollTimedOut = true;
      if (pollingAbortControllerRef.current === abortController) {
        pollingAbortControllerRef.current = null;
        isPollingInProgressRef.current = false;
      }
      try { abortController.abort(); } catch (e) {}
    }, pollTimeoutMs);

    try {
      const unconfirmedSnapshot = new Map();
      for (const [cid, entry] of unconfirmedCompletionsRef.current.entries()) {
        if (entry) unconfirmedSnapshot.set(cid, entry);
      }
      const recallSnapshot = new Map();
      for (const [rid, entry] of optimisticRecallsRef.current.entries()) {
        if (entry && entry.outcome === 'unknown') recallSnapshot.set(rid, entry);
      }
      const reconcileIdList = [
        ...Array.from(unconfirmedSnapshot.keys()).map(String),
        ...Array.from(recallSnapshot.keys()).map(String)
      ];
      const uniqueReconcileIds = Array.from(new Set(reconcileIdList));
      const pollUrl = uniqueReconcileIds.length > 0
        ? `/api/kitchen/orders?slug=${encodeURIComponent(targetSlug)}&reconcile_ids=${encodeURIComponent(uniqueReconcileIds.join(','))}`
        : `/api/kitchen/orders?slug=${encodeURIComponent(targetSlug)}`;
      const res = await fetch(pollUrl, {
        signal: abortController.signal,
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      // Ignore response if unmounted, locked/unlocked, or tenant changed while request was in flight
      if (isStalePoll()) {
        return;
      }

      if (res.status === 401 || res.status === 403) {
        const errData = await res.json().catch(() => ({}));
        if (isStalePoll()) return;
        if (errData.error === 'KDS_DISABLED') {
          setKdsDisabled(true);
          setLoading(false);
          return;
        }
        if (errData.error === 'KDS_NOT_CONFIGURED') {
          setPinUnconfigured(true);
          setLoading(false);
          return;
        }
        invalidateKdsSession(targetSlug, { pinErrorMsg: errData.message || '' });
        setLoading(false);
        return;
      }

      if (res.status === 404) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      if (!res.ok) {
        throw new Error(`HTTP_${res.status}`);
      }

      const data = await res.json();
      if (isStalePoll()) {
        return;
      }

      if (data.success) {
        // Authoritative API response received -> mark online
        consecutiveFailuresRef.current = 0;
        setConnectionStatus('online');
        setLastSyncTime(new Date());

        setNeedsPinUnlock(false);
        setPinUnconfigured(false);
        if (data.restaurant?.name) {
          setRestaurantName(data.restaurant.name);
        }
        const activeOrders = filterActiveKitchenOrders(data.orders);
        const currentIds = new Set(activeOrders.map(o => String(o.id)));

        if (knownOrderIdsRef.current !== null) {
          let hasNewOrder = false;
          for (const id of currentIds) {
            if (!knownOrderIdsRef.current.has(id)) {
              hasNewOrder = true;
              break;
            }
          }
          if (hasNewOrder) {
            playSirenFor8Seconds();
          }
        }
        knownOrderIdsRef.current = currentIds;

        // Keep polledOrders strictly equal to server poll, protecting orders committed locally after pollStartMutationSeq
        let protectedOrders = activeOrders;
        if (orderLastMutationRef.current.size > 0 && kdsMutationSeqRef.current > pollStartMutationSeq) {
          pendingForceRefreshRef.current = true;
          const activeById = new Map(activeOrders.map(o => [String(o.id), o]));
          for (const [mutId, mutInfo] of orderLastMutationRef.current.entries()) {
            if (!mutInfo || mutInfo.gen !== actionGenRef.current) continue;
            if (mutInfo.seq > pollStartMutationSeq) {
              if (mutInfo.type === 'ready_committed') {
                activeById.delete(mutId);
              } else if (mutInfo.type === 'recall_committed' && mutInfo.order && !activeById.has(mutId)) {
                activeById.set(mutId, mutInfo.order);
              }
            }
          }
          protectedOrders = filterActiveKitchenOrders(Array.from(activeById.values()));
        }
        setPolledOrders(protectedOrders);

        // Reconcile unknown-outcome completions using request-start snapshot; preserve newer entries untouched for deferred refresh
        const serverReconcileMap = data.reconcile_statuses && typeof data.reconcile_statuses === 'object'
          ? data.reconcile_statuses
          : null;
        if (unconfirmedSnapshot.size > 0) {
          const reconciledHistoryAdditions = [];
          for (const [cid, snapEntry] of unconfirmedSnapshot.entries()) {
            const liveEntry = unconfirmedCompletionsRef.current.get(cid);
            if (!liveEntry || liveEntry.gen !== snapEntry.gen || liveEntry.actionSeq !== snapEntry.actionSeq) {
              if (liveEntry) pendingForceRefreshRef.current = true;
              continue;
            }
            if (liveEntry.gen !== actionGenRef.current) {
              unconfirmedCompletionsRef.current.delete(cid);
              continue;
            }
            const cKey = String(cid);
            const stInfo = serverReconcileMap ? serverReconcileMap[cKey] : null;
            const isConfirmedCancelled = Boolean(stInfo && (stInfo.status === 'cancelled' || stInfo.status === 'rejected'));
            const isConfirmedServerReady = Boolean(stInfo && Number(stInfo.kitchen_prepared) === 1 && !isConfirmedCancelled);

            if (isConfirmedCancelled) {
              unconfirmedCompletionsRef.current.delete(cid);
            } else if (isConfirmedServerReady || (!currentIds.has(cKey) && !serverReconcileMap)) {
              unconfirmedCompletionsRef.current.delete(cid);
              if (liveEntry.order && liveEntry.order.status !== 'cancelled' && liveEntry.order.status !== 'rejected') {
                reconciledHistoryAdditions.push({ ...liveEntry.order, completedAt: new Date() });
              }
            } else if (!currentIds.has(cKey) && stInfo && Number(stInfo.kitchen_prepared) === 0) {
              // Omitted from active queue while server still reports kitchen_prepared=0 (e.g. closed/settled elsewhere) -> stop tracking without adding Ready history
              unconfirmedCompletionsRef.current.delete(cid);
            } else {
              // Still active in queue: keep tracking across the 15s grace window via spaced 3s polling instead of dropping after rapid GETs
              const ageMs = Date.now() - (liveEntry.timedOutAt || Date.now());
              if (ageMs >= 15000) {
                unconfirmedCompletionsRef.current.delete(cid);
              }
            }
          }
          if (reconciledHistoryAdditions.length > 0) {
            setRecentlyCompleted(prev => {
              const addIds = new Set(reconciledHistoryAdditions.map(o => String(o.id)));
              return [...reconciledHistoryAdditions, ...prev.filter(o => !addIds.has(String(o.id)))].slice(0, 10);
            });
          }
        }

        // Reconcile unknown-outcome recalls using request-start snapshot; preserve newer entries untouched for deferred refresh
        if (recallSnapshot.size > 0) {
          const toRestoreCompleted = [];
          for (const [rid, snapEntry] of recallSnapshot.entries()) {
            const liveEntry = optimisticRecallsRef.current.get(rid);
            if (!liveEntry || liveEntry.gen !== snapEntry.gen || liveEntry.actionSeq !== snapEntry.actionSeq || liveEntry.outcome !== 'unknown') {
              if (liveEntry) pendingForceRefreshRef.current = true;
              continue;
            }
            if (liveEntry.gen !== actionGenRef.current) {
              optimisticRecallsRef.current.delete(rid);
              continue;
            }
            const rKey = String(rid);
            const stInfo = serverReconcileMap ? serverReconcileMap[rKey] : null;
            if (currentIds.has(rKey)) {
              optimisticRecallsRef.current.delete(rid);
            } else if (stInfo && (stInfo.status === 'cancelled' || stInfo.status === 'rejected')) {
              optimisticRecallsRef.current.delete(rid);
            } else if (stInfo && stInfo.kitchen_prepared !== undefined && stInfo.kitchen_prepared !== null && Number(stInfo.kitchen_prepared) === 0) {
              // Server explicitly reports kitchen_prepared=0 even when absent from active orders: recall succeeded / order is not prepared
              optimisticRecallsRef.current.delete(rid);
            } else {
              const ageMs = Date.now() - (liveEntry.timedOutAt || Date.now());
              if (stInfo && Number(stInfo.kitchen_prepared) === 1 && ageMs < 15000) {
                // Late recall commit may still land within 15s grace period; keep entry across spaced 3s polls
              } else {
                optimisticRecallsRef.current.delete(rid);
                if (liveEntry.order) {
                  toRestoreCompleted.push(liveEntry.order);
                }
              }
            }
          }
          if (toRestoreCompleted.length > 0) {
            setRecentlyCompleted(prev => {
              const next = [...prev];
              for (const ord of toRestoreCompleted) {
                if (!next.some(o => o.id === ord.id)) {
                  next.unshift(ord);
                }
              }
              return next.slice(0, 10);
            });
          }
        }
      }
    } catch (err) {
      if ((err.name === 'AbortError' && !pollTimedOut) || isStalePoll()) {
        // Controlled abort or invalidated session generation; do not mutate UI or error count
        return;
      }
      consecutiveFailuresRef.current += 1;
      const nextStatus = calculateConnectionStatus({
        consecutiveFailures: consecutiveFailuresRef.current,
        isBrowserOnline: typeof navigator !== 'undefined' ? navigator.onLine : true
      });
      setConnectionStatus(nextStatus);
      console.warn('Failed to poll kitchen orders:', err.message || err);
    } finally {
      clearTimeout(pollTimeoutId);
      if (pollingAbortControllerRef.current === abortController) {
        pollingAbortControllerRef.current = null;
        isPollingInProgressRef.current = false;
      }
      if (!isStalePoll()) {
        setLoading(false);
        if (pendingForceRefreshRef.current && !isPollingInProgressRef.current) {
          pendingForceRefreshRef.current = false;
          void fetchOrders();
        }
      }
    }
  };
  fetchOrdersRef.current = fetchOrders;

  // Polling interval with cleanup on unmount or slug change
  useEffect(() => {
    actionGenRef.current += 1;
    pollGenRef.current += 1;
    pinAttemptGenRef.current += 1;
    if (pinTimeoutRef.current) {
      clearTimeout(pinTimeoutRef.current);
      pinTimeoutRef.current = null;
    }
    const targetSlug = resolveCurrentSlug();
    currentPollSlugRef.current = targetSlug;
    knownOrderIdsRef.current = null;
    consecutiveFailuresRef.current = 0;

    // Reset tenant-scoped UI state when switching slug on shared devices
    optimisticRecallsRef.current.clear();
    unconfirmedCompletionsRef.current.clear();
    pendingCompletingSnapshotsRef.current.clear();
    orderActionSeqRef.current.clear();
    orderLastMutationRef.current.clear();
    pendingForceRefreshRef.current = false;
    setPolledOrders([]);
    setOptimisticRecalledOrders([]);
    setRecentlyCompleted([]);
    setShowCompletedDrawer(false);
    setRecallNotice(null);
    setCheckedItemsMap({});
    setCompletingOrderIds([]);
    setRecallingOrderIds([]);
    setPinError('');
    setPinSubmitting(false);
    setNotFound(false);
    setKdsDisabled(false);
    setPinUnconfigured(false);

    fetchOrders();
    const interval = setInterval(() => {
      if (typeof fetchOrdersRef.current === 'function') {
        fetchOrdersRef.current();
      }
    }, 3000);

    return () => {
      clearInterval(interval);
      pinAttemptGenRef.current += 1;
      if (pinTimeoutRef.current) {
        clearTimeout(pinTimeoutRef.current);
        pinTimeoutRef.current = null;
      }
      if (pollingAbortControllerRef.current) {
        try { pollingAbortControllerRef.current.abort(); } catch (e) {}
      }
      isPollingInProgressRef.current = false;
    };
  }, [resolvedSlug]);

  // Load restaurant metadata
  useEffect(() => {
    if (resolvedSlug) {
      fetch(`/api/info?slug=${encodeURIComponent(resolvedSlug)}`)
        .then(r => r.json())
        .then(d => {
          if (isMountedRef.current && d && d.name) {
            setRestaurantName(d.name);
            setRestaurantMeta(d);
          }
        })
        .catch(() => {});
    }
  }, [resolvedSlug]);

  const invalidateKdsSession = (slugToClear, { pinErrorMsg = null } = {}) => {
    actionGenRef.current += 1;
    pollGenRef.current += 1;
    pinAttemptGenRef.current += 1;
    if (pinTimeoutRef.current) {
      clearTimeout(pinTimeoutRef.current);
      pinTimeoutRef.current = null;
    }
    if (pollingAbortControllerRef.current) {
      try { pollingAbortControllerRef.current.abort(); } catch (e) {}
      pollingAbortControllerRef.current = null;
    }
    isPollingInProgressRef.current = false;
    optimisticRecallsRef.current.clear();
    unconfirmedCompletionsRef.current.clear();
    pendingCompletingSnapshotsRef.current.clear();
    orderActionSeqRef.current.clear();
    orderLastMutationRef.current.clear();
    pendingForceRefreshRef.current = false;
    clearStoredKdsToken(slugToClear);
    stopSiren();
    setNeedsPinUnlock(true);
    setPinSubmitting(false);
    if (pinErrorMsg !== null) {
      setPinError(pinErrorMsg);
    }
    setPolledOrders([]);
    setOptimisticRecalledOrders([]);
    setRecentlyCompleted([]);
    setShowCompletedDrawer(false);
    setRecallNotice(null);
    setCheckedItemsMap({});
    setCompletingOrderIds([]);
    setRecallingOrderIds([]);
  };

  const startAuthenticatedKdsSession = (targetSlug, data) => {
    actionGenRef.current += 1;
    pollGenRef.current += 1;
    pinAttemptGenRef.current += 1;
    if (pinTimeoutRef.current) {
      clearTimeout(pinTimeoutRef.current);
      pinTimeoutRef.current = null;
    }
    if (pollingAbortControllerRef.current) {
      try { pollingAbortControllerRef.current.abort(); } catch (e) {}
      pollingAbortControllerRef.current = null;
    }
    isPollingInProgressRef.current = false;
    optimisticRecallsRef.current.clear();
    unconfirmedCompletionsRef.current.clear();
    pendingCompletingSnapshotsRef.current.clear();
    orderActionSeqRef.current.clear();
    orderLastMutationRef.current.clear();
    pendingForceRefreshRef.current = false;
    setOptimisticRecalledOrders([]);
    setCompletingOrderIds([]);
    setRecallingOrderIds([]);
    setStoredKdsToken(targetSlug, data.token);
    setNeedsPinUnlock(false);
    setPinInput('');
    setPinError('');
    setPinSubmitting(false);
    if (data.restaurant?.name) {
      setRestaurantName(data.restaurant.name);
    }
    fetchOrders({ force: true });
  };

  const handleVerifyPin = async (e) => {
    if (e) e.preventDefault();
    const cleanPin = pinInput.trim();
    if (!/^\d{4}$/.test(cleanPin)) {
      setPinError('Please enter a valid 4-digit numeric PIN');
      return;
    }

    const targetSlug = resolveCurrentSlug();
    if (!targetSlug) return;

    const attemptId = ++pinAttemptGenRef.current;
    if (pinTimeoutRef.current) {
      clearTimeout(pinTimeoutRef.current);
      pinTimeoutRef.current = null;
    }

    setPinSubmitting(true);
    setPinError('');
    try {
      const res = await fetch('/api/kitchen/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: targetSlug, pin: cleanPin })
      });

      const data = await res.json();
      if (!isMountedRef.current || attemptId !== pinAttemptGenRef.current || resolveCurrentSlug() !== targetSlug) {
        return;
      }
      if (res.ok && data.success && data.token) {
        startAuthenticatedKdsSession(targetSlug, data);
      } else {
        if (data.error === 'KDS_NOT_CONFIGURED') {
          setPinUnconfigured(true);
        } else if (data.error === 'KDS_DISABLED') {
          setKdsDisabled(true);
        } else {
          setPinError(data.message || 'Incorrect 4-digit Kitchen PIN');
        }
      }
    } catch (err) {
      if (!isMountedRef.current || attemptId !== pinAttemptGenRef.current || resolveCurrentSlug() !== targetSlug) {
        return;
      }
      setPinError('Connection error. Please check your network and try again.');
    } finally {
      if (isMountedRef.current && attemptId === pinAttemptGenRef.current) {
        setPinSubmitting(false);
      }
    }
  };

  const handleKeypadPress = (val) => {
    if (pinInput.length < 4) {
      const newPin = pinInput + val;
      setPinInput(newPin);
      setPinError('');
      if (newPin.length === 4) {
        const attemptId = ++pinAttemptGenRef.current;
        if (pinTimeoutRef.current) {
          clearTimeout(pinTimeoutRef.current);
        }
        pinTimeoutRef.current = setTimeout(() => {
          pinTimeoutRef.current = null;
          if (!isMountedRef.current || attemptId !== pinAttemptGenRef.current) return;
          const cleanPin = newPin.trim();
          const targetSlug = resolveCurrentSlug();
          if (!targetSlug || !/^\d{4}$/.test(cleanPin)) return;
          setPinSubmitting(true);
          fetch('/api/kitchen/verify-pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug: targetSlug, pin: cleanPin })
          })
            .then(r => r.json().then(data => ({ ok: r.ok, data })))
            .then(({ ok, data }) => {
              if (!isMountedRef.current || attemptId !== pinAttemptGenRef.current || resolveCurrentSlug() !== targetSlug) return;
              if (ok && data.success && data.token) {
                startAuthenticatedKdsSession(targetSlug, data);
              } else {
                if (data.error === 'KDS_NOT_CONFIGURED') {
                  setPinUnconfigured(true);
                } else if (data.error === 'KDS_DISABLED') {
                  setKdsDisabled(true);
                } else {
                  setPinError(data.message || 'Incorrect 4-digit Kitchen PIN');
                  setPinInput('');
                }
              }
            })
            .catch(() => {
              if (isMountedRef.current && attemptId === pinAttemptGenRef.current && resolveCurrentSlug() === targetSlug) {
                setPinError('Connection error. Please try again.');
              }
            })
            .finally(() => {
              if (isMountedRef.current && attemptId === pinAttemptGenRef.current) {
                setPinSubmitting(false);
              }
            });
        }, 100);
      }
    }
  };

  const cancelPendingPinSubmit = () => {
    pinAttemptGenRef.current += 1;
    if (pinTimeoutRef.current) {
      clearTimeout(pinTimeoutRef.current);
      pinTimeoutRef.current = null;
    }
  };

  const handleKeypadDelete = () => {
    cancelPendingPinSubmit();
    setPinInput(prev => prev.slice(0, -1));
    setPinError('');
  };

  const handleKeypadClear = () => {
    cancelPendingPinSubmit();
    setPinInput('');
    setPinError('');
  };

  const handleLockScreen = () => {
    const targetSlug = resolveCurrentSlug();
    invalidateKdsSession(targetSlug, { pinErrorMsg: '' });
  };

  const handleMarkPrepared = async (orderOrId) => {
    const orderObj = typeof orderOrId === 'object' && orderOrId !== null
      ? orderOrId
      : orders.find(o => o.id === orderOrId);
    const orderId = orderObj ? orderObj.id : orderOrId;
    if (!orderId || completingOrderIds.includes(orderId)) return;

    const reqGen = actionGenRef.current;
    const orderKey = String(orderId);
    const readySeq = (orderActionSeqRef.current.get(orderKey) || 0) + 1;
    orderActionSeqRef.current.set(orderKey, readySeq);

    const targetSlug = resolveCurrentSlug();
    const token = getStoredKdsToken(targetSlug);
    const targetOrderSnapshot = orderObj || null;

    const releaseSnapshotIfCurrent = () => {
      const curSnap = pendingCompletingSnapshotsRef.current.get(orderKey);
      if (curSnap && curSnap.gen === reqGen && curSnap.seq === readySeq) {
        pendingCompletingSnapshotsRef.current.delete(orderKey);
      }
    };

    const restoreFailedOrder = () => {
      // Rejected Ready leaves recentlyCompleted untouched (including empty or restored Recall entries)
      releaseSnapshotIfCurrent();
    };

    // Keep ticket visible & disabled ("Marking Ready...") while PATCH is pending; retain snapshot across polls until settled
    if (targetOrderSnapshot) {
      pendingCompletingSnapshotsRef.current.set(orderKey, { order: targetOrderSnapshot, gen: reqGen, seq: readySeq });
    }
    setCompletingOrderIds(prev => [...prev, orderId]);

    const completeAbortController = new AbortController();
    let completeTimedOut = false;
    const completeTimeoutId = setTimeout(() => {
      completeTimedOut = true;
      try { completeAbortController.abort(); } catch (e) {}
    }, 12000);

    let serverResponded = false;
    try {
      const res = await fetch(`/api/kitchen/orders/${orderId}/complete?slug=${encodeURIComponent(targetSlug)}`, {
        method: 'PATCH',
        signal: completeAbortController.signal,
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      serverResponded = true;
      if (!isMountedRef.current || reqGen !== actionGenRef.current) {
        return;
      }
      if (res.status === 401 || res.status === 403) {
        restoreFailedOrder();
        invalidateKdsSession(targetSlug);
        return;
      }
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Failed to mark Order No: ${resolveBusinessOrderNumber(targetOrderSnapshot || orderObj) || orderId} prepared`);
      }

      // Apply grid removal & 10-entry history cap only after PATCH succeeds
      releaseSnapshotIfCurrent();
      unconfirmedCompletionsRef.current.delete(orderId);
      optimisticRecallsRef.current.delete(orderId);
      const commitSeq = ++kdsMutationSeqRef.current;
      orderLastMutationRef.current.set(orderKey, { seq: commitSeq, gen: reqGen, type: 'ready_committed' });
      setOptimisticRecalledOrders(prev => prev.filter(o => o.id !== orderId));
      setPolledOrders(prev => prev.filter(o => o.id !== orderId));
      if (orderObj) {
        setRecentlyCompleted(prev => [
          { ...orderObj, completedAt: new Date() },
          ...prev.filter(o => o.id !== orderId)
        ].slice(0, 10));
      }
      fetchOrders({ force: true });
    } catch (e) {
      if (!isMountedRef.current || reqGen !== actionGenRef.current) {
        return;
      }
      releaseSnapshotIfCurrent();
      // If response outcome is unknown (timeout/lost network after possible commit), queue poll reconciliation without adding to recentlyCompleted
      if ((!serverResponded || completeTimedOut) && targetOrderSnapshot) {
        unconfirmedCompletionsRef.current.set(orderId, {
          order: targetOrderSnapshot,
          gen: reqGen,
          actionSeq: readySeq,
          timedOutAt: Date.now()
        });
      }
      restoreFailedOrder();
      setRecallNotice({
        type: 'error',
        message: completeTimedOut
          ? `Ready request for Order No: ${resolveBusinessOrderNumber(targetOrderSnapshot || orderObj) || orderId} timed out. Reconciling queue state...`
          : (e?.message || 'Failed to mark order prepared. Order remains in queue.')
      });
      fetchOrders({ force: true });
    } finally {
      clearTimeout(completeTimeoutId);
      releaseSnapshotIfCurrent();
      if (isMountedRef.current && reqGen === actionGenRef.current) {
        setCompletingOrderIds(prev => prev.filter(id => id !== orderId));
      }
    }
  };

  /**
   * Safe, idempotent order recall with in-flight click protection,
   * rollback on failure, status parsing (409, 403, 404, 500), and queue resynchronization.
   */
  const handleRecallOrder = async (order) => {
    if (!order || !order.id) return;

    // Prevent repeated clicks from creating concurrent duplicate requests
    if (recallingOrderIds.includes(order.id)) {
      return;
    }

    const reqGen = actionGenRef.current;
    const orderKey = String(order.id);
    const undoSeq = (orderActionSeqRef.current.get(orderKey) || 0) + 1;
    orderActionSeqRef.current.set(orderKey, undoSeq);
    const targetSlug = resolveCurrentSlug();
    if (!targetSlug) {
      setRecallNotice({
        type: 'error',
        message: 'Cannot recall order: missing restaurant slug.'
      });
      return;
    }

    setRecallingOrderIds(prev => [...prev, order.id]);

    const restoreRecalledOrder = () => {
      optimisticRecallsRef.current.delete(order.id);
      setOptimisticRecalledOrders(prev => prev.filter(o => o.id !== order.id));
      setRecentlyCompleted(prev => (
        prev.some(o => o.id === order.id) ? prev : [order, ...prev].slice(0, 10)
      ));
    };

    // Optimistic recall kept separate from polledOrders
    optimisticRecallsRef.current.set(order.id, { order, gen: reqGen, actionSeq: undoSeq, outcome: 'pending' });
    setRecentlyCompleted(prev => prev.filter(o => o.id !== order.id));
    setOptimisticRecalledOrders(prev => [order, ...prev.filter(o => o.id !== order.id)]);

    const token = getStoredKdsToken(targetSlug);
    const recallAbortController = new AbortController();
    let recallTimedOut = false;
    const recallTimeoutId = setTimeout(() => {
      recallTimedOut = true;
      try { recallAbortController.abort(); } catch (e) {}
    }, 12000);

    try {
      const res = await fetch(`/api/kitchen/orders/${order.id}/recall?slug=${encodeURIComponent(targetSlug)}`, {
        method: 'PATCH',
        signal: recallAbortController.signal,
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });

      const data = await res.json().catch(() => ({}));
      if (recallTimedOut) {
        throw new Error('RECALL_TIMEOUT');
      }
      if (!isMountedRef.current || reqGen !== actionGenRef.current) {
        return;
      }
      const parsed = parseRecallErrorResponse(res.status, data, resolveBusinessOrderNumber(order));

      if (parsed.success) {
        optimisticRecallsRef.current.delete(order.id);
        setOptimisticRecalledOrders(prev => prev.filter(o => o.id !== order.id));
        // Ignore delayed Undo restoration of polledOrders if a newer action (e.g., Ready) started for this order ID
        if (orderActionSeqRef.current.get(orderKey) === undoSeq) {
          const commitSeq = ++kdsMutationSeqRef.current;
          orderLastMutationRef.current.set(orderKey, { seq: commitSeq, gen: reqGen, type: 'recall_committed', order });
          setPolledOrders(prev => filterActiveKitchenOrders([order, ...prev.filter(o => o.id !== order.id)]));
        }
        setRecallNotice({
          type: 'success',
          message: parsed.message
        });
        fetchOrders({ force: true });
      } else {
        // Confirmed rejection from server -> restore prior entry immediately
        restoreRecalledOrder();

        setRecallNotice({
          type: 'error',
          message: parsed.message
        });

        if (parsed.isForbidden && data.error === 'KDS_DISABLED') {
          setKdsDisabled(true);
        }

        // Resynchronize authoritative queue
        fetchOrders({ force: true });
      }
    } catch (err) {
      if (!isMountedRef.current || reqGen !== actionGenRef.current) {
        return;
      }
      // Unknown outcome (network failure or deadline timeout) -> reconcile with authoritative poll before restoring recentlyCompleted
      optimisticRecallsRef.current.set(order.id, {
        order,
        gen: reqGen,
        actionSeq: undoSeq,
        outcome: 'unknown',
        timedOutAt: Date.now()
      });
      setOptimisticRecalledOrders(prev => prev.filter(o => o.id !== order.id));

      setRecallNotice({
        type: 'error',
        message: recallTimedOut
          ? `Recall request for Order No: ${resolveBusinessOrderNumber(order)} timed out. Reconciling queue state...`
          : parseRecallErrorResponse(0, {}, resolveBusinessOrderNumber(order)).message
      });
      fetchOrders({ force: true });
    } finally {
      clearTimeout(recallTimeoutId);
      if (isMountedRef.current && reqGen === actionGenRef.current) {
        setRecallingOrderIds(prev => prev.filter(id => id !== order.id));
      }
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
      }
    }
  };

  const getElapsedMins = (createdAt) => {
    if (!createdAt) return 0;
    const orderTime = new Date(createdAt).getTime();
    const now = Date.now();
    return Math.max(0, Math.floor((now - orderTime) / 60000));
  };

  const safeParseItems = (rawItems) => {
    if (!rawItems) return [];
    if (Array.isArray(rawItems)) return rawItems;
    if (typeof rawItems === 'string') {
      try {
        const parsed = JSON.parse(rawItems);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  };

  const parseItems = safeParseItems;

  const formatKdsLocation = (raw, spaceType, fallbackPrefix = null) => {
    if (!raw) return 'Takeaway';
    const str = String(raw).trim();

    const cMatch = str.match(/^S?(\d+)[- •]+(?:Row[- ]*)?([A-Za-z]+)[- •]+(?:Seat[- ]*)?(\d+)$/i) ||
                   str.match(/Screen\s*(\d+)\s*[-•]\s*Row\s*([A-Za-z]+)\s*[-•]\s*Seat\s*(\d+)/i);
    if (cMatch) {
      return `Screen ${cMatch[1]} • Row ${cMatch[2].toUpperCase()} • Seat ${cMatch[3]}`;
    }
    if (str.toLowerCase().startsWith('screen')) {
      return str;
    }

    const cleanSpaceType = spaceType ? String(spaceType).trim().toLowerCase() : null;

    if (cleanSpaceType === 'cinema_seat' || cleanSpaceType === 'cinema') {
      return `Seat ${str.replace(/^seat(?:[\s#.\-:]+|(?=\d|$))/i, '').trim().toUpperCase()}`;
    }
    if (cleanSpaceType === 'room' || /^room\s*#?\d+/i.test(str)) {
      return `Room ${str.replace(/^room\s*#?/i, '').trim()}`;
    }
    if (cleanSpaceType === 'cabin' || /^cabin\s*#?\d+/i.test(str)) {
      return `Cabin ${str.replace(/^cabin\s*#?/i, '').trim()}`;
    }
    if (cleanSpaceType === 'vip' || /^vip\s*#?\d+/i.test(str)) {
      return `VIP ${str.replace(/^vip\s*#?/i, '').trim()}`;
    }
    if (cleanSpaceType === 'counter' || /^counter/i.test(str)) {
      const num = str.replace(/^counter\s*#?/i, '').trim();
      return num ? `Counter ${num}` : `Counter`;
    }
    if (cleanSpaceType === 'table' || /^table/i.test(str)) {
      const numOnly = str.replace(/^table\s*#?/i, '').trim();
      return `Table ${numOnly}`;
    }
    if (/^(takeaway|parcel)/i.test(str)) {
      return 'Takeaway';
    }

    if (fallbackPrefix) {
      const cleanFallback = String(fallbackPrefix).trim().toLowerCase();
      if (cleanFallback === 'counter') return `Counter ${str}`;
      if (cleanFallback === 'room') return `Room ${str}`;
      if (cleanFallback === 'cabin') return `Cabin ${str}`;
      if (cleanFallback === 'vip') return `VIP ${str}`;
      if (cleanFallback === 'cinema_seat' || cleanFallback === 'cinema') return `Seat ${str.replace(/^seat(?:[\s#.\-:]+|(?=\d|$))/i, '').trim().toUpperCase()}`;
    }

    return `Table ${str}`;
  };

  const toggleItemCheck = (orderId, idx) => {
    const key = `${orderId}_${idx}`;
    setCheckedItemsMap(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const aggregatedPrepItems = useMemo(() => {
    const map = {};
    orders.forEach(o => {
      const items = parseItems(o.items);
      items.forEach(it => {
        const name = it.name || it.dish_name || 'Item';
        const qty = Number(it.quantity || it.qty || 1);
        const portion = it.portion ? ` (${it.portion})` : '';
        const key = `${name}${portion}`;
        map[key] = (map[key] || 0) + qty;
      });
    });
    return Object.entries(map).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [orders]);

  const rushCount = orders.filter(o => getElapsedMins(o.created_at) >= 15).length;
  const totalDishesCount = orders.reduce((sum, o) => {
    const items = parseItems(o.items);
    return sum + items.reduce((iSum, it) => iSum + Number(it.quantity || it.qty || 1), 0);
  }, 0);

  // 1. Loading screen
  if (loading) {
    return (
      <div style={{
        minHeight: '100dvh', boxSizing: 'border-box', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '32px 20px',
        background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
        color: '#FFFFFF', textAlign: 'center', fontFamily: 'system-ui, sans-serif'
      }}>
        <Flame size={48} color="#38BDF8" style={{ marginBottom: '16px' }} />
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#F8FAFC', margin: '0 0 8px 0' }}>
          🍳 Loading Kitchen Orders...
        </h2>
        <span style={{ fontSize: '0.84rem', color: '#64748B' }}>
          Connecting to live restaurant queue
        </span>
      </div>
    );
  }

  // 2. Shared-device tenant link prompt (When accessed via generic /kitchen without slug)
  if (needsTenantPrompt || (!resolveCurrentSlug() && !loading)) {
    const handleOpenExplicitSlug = (e) => {
      if (e) e.preventDefault();
      const clean = tenantSlugInput.trim().toLowerCase();
      if (!clean) return;
      window.location.href = `/${clean}/kitchen`;
    };

    return (
      <div
        id="kds-tenant-prompt-screen"
        style={{
          minHeight: '100dvh', boxSizing: 'border-box', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', padding: '32px 20px', overflowY: 'auto',
          background: 'linear-gradient(135deg, #090D16 0%, #0F172A 100%)',
          color: '#FFFFFF', textAlign: 'center', fontFamily: 'system-ui, sans-serif'
        }}
      >
        <div style={{
          background: '#0F172A', border: '1px solid #1E293B', borderRadius: '24px',
          padding: '28px 20px', maxWidth: '460px', width: '100%',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6)', boxSizing: 'border-box'
        }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '18px',
            background: 'linear-gradient(135deg, #38BDF8 0%, #2563EB 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px auto', boxShadow: '0 8px 24px rgba(56,189,248,0.3)'
          }}>
            <Store size={32} color="#FFFFFF" />
          </div>

          <h1 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#F8FAFC', margin: '0 0 10px 0' }}>
            Restaurant Kitchen Link Required
          </h1>
          <p style={{ fontSize: '0.90rem', color: '#94A3B8', margin: '0 auto 24px auto', lineHeight: 1.6 }}>
            This kitchen display requires a restaurant-specific link. Open your restaurant's dedicated kitchen URL or enter its slug below:
          </p>

          <form onSubmit={handleOpenExplicitSlug} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
            <input
              id="kds-slug-input"
              type="text"
              placeholder="Enter business slug (e.g. ramansweet)"
              value={tenantSlugInput}
              onChange={(e) => setTenantSlugInput(e.target.value)}
              style={{
                width: '100%', padding: '14px 16px', borderRadius: '12px',
                border: '1px solid #334155', background: '#1E293B',
                color: '#F8FAFC', fontSize: '1rem', fontWeight: 700,
                outline: 'none', boxSizing: 'border-box'
              }}
            />
            <button
              id="kds-slug-submit-btn"
              type="submit"
              disabled={!tenantSlugInput.trim()}
              style={{
                width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
                background: tenantSlugInput.trim()
                  ? 'linear-gradient(135deg, #38BDF8 0%, #0284C7 100%)'
                  : '#334155',
                color: '#FFFFFF', fontWeight: 900, fontSize: '0.95rem',
                cursor: tenantSlugInput.trim() ? 'pointer' : 'not-allowed',
                boxShadow: tenantSlugInput.trim() ? '0 4px 16px rgba(56,189,248,0.3)' : 'none'
              }}
            >
              🍳 Open Kitchen Display
            </button>
          </form>

          <div style={{
            background: '#131D31', border: '1px solid #1E293B', borderRadius: '12px',
            padding: '12px 14px', textAlign: 'left', fontSize: '0.76rem', color: '#64748B', lineHeight: 1.5, wordBreak: 'break-all', overflowWrap: 'anywhere'
          }}>
            <strong style={{ color: '#94A3B8', display: 'block', marginBottom: '4px' }}>Supported Kitchen URL Formats:</strong>
            <div>• <code style={{ color: '#38BDF8' }}>touchqr.in/:restaurant-slug/kitchen</code></div>
            <div>• <code style={{ color: '#38BDF8' }}>touchqr.in/kitchen?slug=:restaurant-slug</code></div>
          </div>

          <button
            onClick={() => { window.location.href = '/'; }}
            style={{
              marginTop: '20px', background: 'none', border: 'none',
              color: '#94A3B8', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            🏠 Return to TouchQR Homepage
          </button>
        </div>
      </div>
    );
  }

  // 3. 404 Restaurant Not Found
  if (notFound) {
    return (
      <div style={{
        minHeight: '100dvh', boxSizing: 'border-box', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '32px 20px',
        background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
        color: '#FFFFFF', textAlign: 'center', fontFamily: 'system-ui, sans-serif'
      }}>
        <div style={{
          fontSize: '4.5rem', marginBottom: '16px', filter: 'drop-shadow(0 4px 16px rgba(239,68,68,0.3))'
        }}>❌</div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#F87171', margin: '0 0 8px 0' }}>
          404 - Restaurant Not Found
        </h1>
        <p style={{ fontSize: '0.92rem', color: '#94A3B8', maxWidth: '440px', margin: '0 auto 24px auto', lineHeight: 1.6 }}>
          The kitchen screen you are trying to access does not exist. Please verify the restaurant URL slug.
        </p>
        <button
          onClick={() => { window.location.href = '/'; }}
          style={{
            padding: '13px 30px', borderRadius: '9999px', border: 'none',
            background: 'linear-gradient(135deg, #FFD700 0%, #D4AF37 100%)',
            color: '#0A0A0A', fontWeight: 900, fontSize: '0.92rem', cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(255,215,0,0.3)'
          }}
        >
          🏠 Go to TouchQR Homepage
        </button>
      </div>
    );
  }

  // 4. Subscription tier locked
  if (kdsDisabled) {
    return (
      <div style={{
        minHeight: '100dvh', boxSizing: 'border-box', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '32px 20px',
        background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
        color: '#FFFFFF', textAlign: 'center', fontFamily: 'system-ui, sans-serif'
      }}>
        <div style={{
          width: '72px', height: '72px', borderRadius: '50%', background: '#FEF3C7', color: '#B45309',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', border: '2px solid #F59E0B'
        }}>
          <Flame size={38} color="#D97706" />
        </div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#FCD34D', margin: '0 0 8px 0' }}>
          🔒 Kitchen KDS Display Screen Locked
        </h1>
        <p style={{ fontSize: '0.94rem', color: '#94A3B8', maxWidth: '480px', margin: '0 auto 24px auto', lineHeight: 1.6 }}>
          Dedicated Kitchen Display System (KDS) is locked for this restaurant under its current SaaS subscription plan tier. Please upgrade to Pro or Enterprise plan to unlock KDS.
        </p>
        <button
          onClick={() => { window.location.href = '/'; }}
          style={{
            padding: '13px 30px', borderRadius: '9999px', border: 'none',
            background: 'linear-gradient(135deg, #FFD700 0%, #D4AF37 100%)',
            color: '#0A0A0A', fontWeight: 900, fontSize: '0.92rem', cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(255,215,0,0.3)'
          }}
        >
          🏠 Return to Homepage
        </button>
      </div>
    );
  }

  // 5. PIN Not Configured
  if (pinUnconfigured) {
    return (
      <div style={{
        minHeight: '100dvh', boxSizing: 'border-box', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '32px 20px',
        background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
        color: '#FFFFFF', textAlign: 'center', fontFamily: 'system-ui, sans-serif'
      }}>
        <div style={{
          width: '72px', height: '72px', borderRadius: '50%', background: '#FEE2E2', color: '#DC2626',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', border: '2px solid #EF4444'
        }}>
          <Lock size={38} color="#DC2626" />
        </div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#F87171', margin: '0 0 8px 0' }}>
          🔒 KDS Screen PIN Not Configured
        </h1>
        <p style={{ fontSize: '0.94rem', color: '#94A3B8', maxWidth: '480px', margin: '0 auto 24px auto', lineHeight: 1.6 }}>
          The restaurant administrator has not set up a 4-digit Kitchen Display PIN yet. Please log into the Admin Dashboard and configure your KDS PIN under <strong>Setup → Security</strong> to activate this kitchen display screen.
        </p>
        <button
          onClick={() => { window.location.href = `/${resolveCurrentSlug()}/admin`; }}
          style={{
            padding: '13px 30px', borderRadius: '9999px', border: 'none',
            background: 'linear-gradient(135deg, #38BDF8 0%, #0284C7 100%)',
            color: '#FFFFFF', fontWeight: 900, fontSize: '0.92rem', cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(56,189,248,0.3)'
          }}
        >
          🔐 Go to Restaurant Admin Login
        </button>
      </div>
    );
  }

  // 6. PIN Lock Keypad Screen
  if (needsPinUnlock) {
    return (
      <div style={{
        minHeight: '100dvh', boxSizing: 'border-box', display: 'flex', flexDirection: 'column',
        alignItems: 'center', padding: '24px 16px', overflowY: 'auto',
        background: 'linear-gradient(135deg, #090D16 0%, #111827 100%)',
        color: '#FFFFFF', fontFamily: 'system-ui, sans-serif'
      }}>
        <div style={{
          margin: 'auto',
          background: '#0F172A', border: '1px solid #1E293B', borderRadius: '24px',
          padding: '26px 20px', maxWidth: '380px', width: '100%',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6)', textAlign: 'center', boxSizing: 'border-box'
        }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '16px',
            background: 'linear-gradient(135deg, #38BDF8 0%, #2563EB 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px auto', boxShadow: '0 8px 24px rgba(56,189,248,0.3)'
          }}>
            <Lock size={26} color="#FFFFFF" />
          </div>

          <h2 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#F8FAFC', margin: '0 0 4px 0', overflowWrap: 'anywhere' }}>
            {restaurantName}
          </h2>
          <span style={{ fontSize: '0.82rem', color: '#94A3B8', fontWeight: 700, display: 'block', marginBottom: '20px' }}>
            {terminology.spaceIcon || '🍳'} {terminology.kdsTitle || 'Kitchen Display System (KDS)'} Screen Locked
          </span>

          {pinError && (
            <div style={{
              background: '#450A0A', border: '1px solid #EF4444', color: '#FCA5A5',
              padding: '10px 14px', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 800,
              marginBottom: '18px', textAlign: 'center'
            }}>
              ⚠️ {pinError}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'center', gap: 'clamp(8px, 3vw, 14px)', marginBottom: '24px' }}>
            {[0, 1, 2, 3].map(idx => (
              <div
                key={idx}
                style={{
                  width: 'clamp(44px, 13vw, 52px)', height: '56px', borderRadius: '14px', flexShrink: 0,
                  background: '#1E293B', border: pinInput.length === idx ? '2px solid #38BDF8' : '1px solid #334155',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.6rem', fontWeight: 900, color: '#F8FAFC',
                  boxShadow: pinInput.length === idx ? '0 0 12px rgba(56,189,248,0.3)' : 'none'
                }}
              >
                {pinInput[idx] ? '●' : ''}
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '18px' }}>
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((key) => (
              <button
                key={key}
                type="button"
                disabled={pinSubmitting}
                onClick={() => {
                  if (key === 'C') handleKeypadClear();
                  else if (key === '⌫') handleKeypadDelete();
                  else handleKeypadPress(key);
                }}
                style={{
                  padding: '16px 0', borderRadius: '14px', border: '1px solid #334155',
                  background: '#1E293B',
                  color: key === 'C' ? '#F87171' : key === '⌫' ? '#FBBF24' : '#F8FAFC',
                  fontSize: '1.25rem', fontWeight: 900, cursor: 'pointer',
                  transition: 'background 0.1s', userSelect: 'none'
                }}
              >
                {key}
              </button>
            ))}
          </div>

          <button
            onClick={handleVerifyPin}
            disabled={pinSubmitting || pinInput.length !== 4}
            style={{
              width: '100%', padding: '14px', borderRadius: '14px', border: 'none',
              background: pinInput.length === 4
                ? 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)'
                : '#334155',
              color: '#FFFFFF', fontWeight: 900, fontSize: '0.95rem',
              cursor: pinInput.length === 4 && !pinSubmitting ? 'pointer' : 'not-allowed',
              opacity: pinSubmitting ? 0.7 : 1,
              boxShadow: pinInput.length === 4 ? '0 4px 16px rgba(34,197,94,0.3)' : 'none'
            }}
          >
            {pinSubmitting ? '⏳ Verifying...' : '🔓 UNLOCK KITCHEN DISPLAY'}
          </button>

          <span style={{ fontSize: '0.72rem', color: '#64748B', display: 'block', marginTop: '16px' }}>
            🔒 Authenticated & Scoped to {restaurantName}
          </span>
        </div>
      </div>
    );
  }

  // 7. Main Standalone KDS Live Screen
  return (
    <div
      className="touchqr-kds-root"
      style={{
        minHeight: '100dvh',
        background: 'radial-gradient(circle at 50% 0%, #162444 0%, #0F172A 40%, #080D1A 100%)',
        color: '#F8FAFC',
        padding: 'clamp(10px, 2vw, 18px) clamp(10px, 2vw, 18px) calc(24px + env(safe-area-inset-bottom, 0px))',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif',
        boxSizing: 'border-box',
        overflowX: 'hidden',
        width: '100%',
        maxWidth: '100vw'
      }}
    >
      <style>{`
        .touchqr-kds-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
          gap: 14px;
          width: 100%;
          box-sizing: border-box;
        }
        @media (max-width: 640px) {
          .kds-controls-strip {
            width: 100%;
            flex-wrap: nowrap !important;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
            padding-bottom: 2px;
          }
          .kds-controls-strip::-webkit-scrollbar {
            display: none;
          }
        }
        @media (max-width: 480px) {
          .touchqr-kds-grid {
            grid-template-columns: minmax(0, 1fr);
            gap: 10px;
          }
          .kds-header-bar {
            padding: 10px 12px !important;
            gap: 8px !important;
          }
          .kds-header-title {
            font-size: 1.02rem !important;
          }
        }
        @media (max-width: 330px) {
          .touchqr-kds-root {
            padding: 6px !important;
          }
          .touchqr-kds-grid {
            gap: 8px;
          }
          .kds-card {
            border-radius: 12px !important;
          }
        }
        .kds-card-rush-glow {
          box-shadow: 0 0 25px rgba(239, 68, 68, 0.35) !important;
          animation: kdsRushPulse 2s infinite ease-in-out;
        }
        @keyframes kdsRushPulse {
          0%, 100% { border-color: #EF4444; }
          50% { border-color: #F87171; box-shadow: 0 0 35px rgba(239, 68, 68, 0.55); }
        }
        .kds-item-row {
          transition: all 0.15s ease;
        }
        .kds-item-row:hover {
          background: #1E293B !important;
        }
        .kds-action-btn:hover {
          transform: translateY(-1px);
          filter: brightness(1.08);
        }
      `}</style>

      {/* AUDIO UNLOCK BANNER */}
      {shouldShowKdsSoundPrompt({ soundPreference, isAudioReady, isAudioUnlocked: audioUnlocked }) && (
        <div
          id="kds-audio-unlock-banner"
          onClick={unlockAudio}
          style={{
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            color: '#34D399',
            padding: '10px 16px',
            borderRadius: '10px',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            flexWrap: 'wrap',
            fontSize: '0.8125rem',
            fontWeight: 500,
            cursor: 'pointer'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
            <Volume2 size={16} style={{ flexShrink: 0 }} />
            <span>Click to enable kitchen order sound alerts.</span>
          </div>
          <span style={{ textDecoration: 'underline', fontSize: '0.75rem', fontWeight: 600, flexShrink: 0 }}>Enable</span>
        </div>
      )}

      {/* RECALL / ERROR NOTIFICATION BANNER */}
      {recallNotice && (
        <div
          style={{
            background: recallNotice.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: recallNotice.type === 'success' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
            color: recallNotice.type === 'success' ? '#6EE7B7' : '#FCA5A5',
            padding: '10px 16px',
            borderRadius: '10px',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            fontSize: '0.8125rem',
            fontWeight: 500
          }}
        >
          <span style={{ minWidth: 0, flex: 1, overflowWrap: 'anywhere' }}>{recallNotice.message}</span>
          <button
            onClick={() => setRecallNotice(null)}
            aria-label="Dismiss alert"
            style={{
              background: 'none', border: 'none', color: '#94A3B8',
              fontSize: '1rem', cursor: 'pointer', width: '36px', height: '36px',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* TOP COMMAND HEADER */}
      <div
        className="kds-header-bar"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          background: '#0F172A',
          padding: '10px 16px',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          marginBottom: '14px',
          boxSizing: 'border-box'
        }}
      >
        {/* Left: Store Name & Section */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: '1 1 180px' }}>
          <div style={{ minWidth: 0 }}>
            <h1
              className="kds-header-title"
              style={{
                fontSize: '0.9375rem',
                fontWeight: 600,
                color: '#F8FAFC',
                margin: 0,
                letterSpacing: '-0.01em',
                textTransform: 'capitalize',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {restaurantName}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px', fontSize: '0.75rem', color: '#64748B' }}>
              <span>Kitchen</span>
              <span>•</span>
              <span style={{ color: orders.length > 0 ? '#38BDF8' : '#94A3B8' }}>{orders.length} active {orders.length === 1 ? 'order' : 'orders'}</span>
            </div>
          </div>
        </div>

        {/* Right Controls */}
        <div className="kds-controls-strip" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Connection indicator */}
          <div
            id="kds-connection-indicator"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0 8px',
              height: '38px',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              fontSize: '0.75rem',
              fontWeight: 500,
              color: connectionStatus === 'online' ? '#94A3B8' : '#FCA5A5'
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: connectionStatus === 'online' ? '#10B981' : '#EF4444'
              }}
            />
            <span>{connectionStatus === 'online' ? 'Online' : 'Offline'}</span>
          </div>

          {/* Sound toggle */}
          <button
            id="kds-sound-toggle-btn"
            type="button"
            onClick={handleToggleSound}
            style={{
              height: '38px',
              padding: '0 12px',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              borderRadius: '8px',
              border: '1px solid #334155',
              background: '#1E293B',
              color: soundPreference === 'muted' ? '#64748B' : '#E2E8F0',
              fontSize: '0.75rem',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {soundPreference === 'muted' ? <VolumeX size={13} /> : <Volume2 size={13} />}
            <span>{soundPreference === 'muted' ? 'Muted' : 'Sound on'}</span>
          </button>

          {/* Summary toggle */}
          {aggregatedPrepItems.length > 0 && (
            <button
              type="button"
              onClick={() => setShowPrepSummary(!showPrepSummary)}
              style={{
                height: '38px',
                padding: '0 12px',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                borderRadius: '8px',
                border: '1px solid #334155',
                background: showPrepSummary ? 'rgba(56, 189, 248, 0.1)' : '#1E293B',
                color: showPrepSummary ? '#38BDF8' : '#94A3B8',
                fontSize: '0.75rem',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Layers size={13} />
              <span>Summary</span>
            </button>
          )}

          {/* Recall */}
          {recentlyCompleted.length > 0 && (
            <button
              type="button"
              onClick={() => setShowCompletedDrawer(!showCompletedDrawer)}
              style={{
                height: '38px',
                padding: '0 12px',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                borderRadius: '8px',
                border: '1px solid #334155',
                background: '#1E293B',
                color: '#E2E8F0',
                fontSize: '0.75rem',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <RotateCcw size={12} color="#F59E0B" />
              <span>Recall ({recentlyCompleted.length})</span>
            </button>
          )}

          {/* Clock */}
          <div style={{
            height: '38px',
            background: '#1E293B',
            color: '#94A3B8',
            padding: '0 10px',
            borderRadius: '8px',
            border: '1px solid #334155',
            display: 'inline-flex',
            alignItems: 'center',
            fontSize: '0.75rem',
            fontWeight: 500,
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap',
            flexShrink: 0
          }}>
            {currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
          </div>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            style={{
              height: '38px',
              width: '38px',
              flexShrink: 0,
              background: '#1E293B',
              border: '1px solid #334155',
              color: '#94A3B8',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>

          {/* Lock */}
          <button
            onClick={handleLockScreen}
            title="Lock Display"
            style={{
              height: '38px',
              width: '38px',
              flexShrink: 0,
              background: '#1E293B',
              border: '1px solid #334155',
              color: '#94A3B8',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Lock size={13} />
          </button>
        </div>
      </div>

      {/* SUMMARY BAR */}
      {showPrepSummary && aggregatedPrepItems.length > 0 && (
        <div style={{
          background: '#0F172A',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '10px',
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          marginBottom: '12px'
        }}>
          <span style={{ color: '#64748B', fontSize: '0.75rem', fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0 }}>
            Summary:
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap', flexShrink: 0 }}>
            {aggregatedPrepItems.map(item => (
              <div
                key={item.name}
                style={{
                  background: '#1E293B',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  padding: '3px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  fontSize: '0.75rem'
                }}
              >
                <span style={{ color: '#38BDF8', fontWeight: 600 }}>{item.count}×</span>
                <span style={{ color: '#E2E8F0', fontWeight: 400 }}>{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* RECALL DRAWER */}
      {showCompletedDrawer && recentlyCompleted.length > 0 && (
        <div style={{
          background: '#0F172A', border: '1px solid #334155', borderRadius: '10px',
          padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#94A3B8' }}>
              Recently Completed
            </span>
            <button
              type="button"
              onClick={() => setShowCompletedDrawer(false)}
              style={{ background: 'none', border: 'none', color: '#64748B', fontSize: '0.75rem', cursor: 'pointer', minHeight: '36px', padding: '6px 10px', display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
            >
              Close
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '2px' }}>
            {recentlyCompleted.map(ord => {
              const isRecallingThis = recallingOrderIds.includes(ord.id);
              return (
                <div
                  key={ord.id}
                  style={{
                    background: '#1E293B', border: '1px solid #334155', borderRadius: '8px',
                    padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap', flexShrink: 0
                  }}
                >
                  <span style={{ fontSize: '0.75rem', color: '#F8FAFC', fontWeight: 500 }}>
                    {formatKdsLocation(ord.table_number, ord.space_type)}
                  </span>
                  <button
                    type="button"
                    disabled={isRecallingThis}
                    onClick={() => handleRecallOrder(ord)}
                    style={{
                      padding: '6px 12px', minHeight: '36px', borderRadius: '6px', border: '1px solid #334155',
                      background: 'transparent', display: 'inline-flex', alignItems: 'center',
                      color: '#FCD34D', fontSize: '0.72rem',
                      fontWeight: 600, cursor: isRecallingThis ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {isRecallingThis ? 'Restoring...' : 'Undo'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TICKETS GRID */}
      {orders.length === 0 ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          textAlign: 'center',
          padding: '40px 20px'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px',
            color: '#64748B'
          }}>
            <UtensilsCrossed size={22} strokeWidth={1.5} />
          </div>
          <h2 style={{
            fontSize: '1rem',
            fontWeight: 600,
            color: '#F1F5F9',
            margin: '0 0 6px 0',
            letterSpacing: '-0.01em'
          }}>
            No active orders
          </h2>
          <p style={{
            fontSize: '0.875rem',
            fontWeight: 400,
            color: '#64748B',
            margin: 0,
            maxWidth: '320px',
            lineHeight: 1.5
          }}>
            New orders will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="touchqr-kds-grid">
          {orders.map(order => {
            const elapsedMins = getElapsedMins(order.created_at);
            const isRush = elapsedMins >= 15;
            const isCritical = elapsedMins >= 25;
            const items = parseItems(order.items);
            const rawNotes = order.notes || order.special_instructions || order.customer_notes;
            const hasNotes = typeof rawNotes === 'string' && rawNotes.trim().length > 0;
            const notesText = hasNotes ? rawNotes.trim() : '';
            const roundNum = Number(order.round_number);
            const isMultiRound = !isNaN(roundNum) && Number.isInteger(roundNum) && roundNum > 1;
            const allItemsChecked = items.length > 0 && items.every((_, idx) => checkedItemsMap[`${order.id}_${idx}`]);

            return (
              <div
                key={order.id}
                className={`kds-card ${isRush ? 'kds-card-rush-glow' : ''}`}
                style={{
                  background: '#131E35',
                  borderRadius: '16px',
                  border: isCritical ? '2px solid #EF4444' : isRush ? '2px solid #F59E0B' : '1px solid rgba(255, 255, 255, 0.08)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  overflow: 'hidden',
                  minWidth: 0,
                  maxWidth: '100%',
                  boxSizing: 'border-box'
                }}
              >
                {/* TICKET TOP HEADER */}
                <div style={{
                  background: isCritical ? 'rgba(239, 68, 68, 0.15)' : (isRush ? 'rgba(245, 158, 11, 0.15)' : '#1E293B'),
                  padding: '10px 14px',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  flexWrap: 'wrap'
                }}>
                  <div style={{ minWidth: 0, flex: '1 1 150px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <div style={{ fontSize: '1rem', fontWeight: 600, color: '#FFFFFF', letterSpacing: '-0.01em', lineHeight: 1.2, overflowWrap: 'anywhere' }}>
                        {formatKdsLocation(order.table_number, order.space_type, restaurantMeta?.business_type === 'hotel_resort' ? 'room' : restaurantMeta?.table_prefix)}
                      </div>
                      {resolveBusinessOrderNumber(order) && (
                        <span style={{
                          background: 'rgba(148, 163, 184, 0.16)',
                          border: '1px solid rgba(148, 163, 184, 0.35)',
                          color: '#E2E8F0',
                          padding: '1px 7px',
                          borderRadius: '5px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          whiteSpace: 'nowrap'
                        }}>
                          KOT No: {resolveBusinessOrderNumber(order)}
                        </span>
                      )}
                      {(order.token_display || order.token_number) && (
                        <span style={{
                          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25) 0%, rgba(217, 119, 6, 0.35) 100%)',
                          border: '1.5px solid #F59E0B',
                          color: '#FDE68A',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontSize: '0.82rem',
                          fontWeight: 800,
                          letterSpacing: '0.5px',
                          whiteSpace: 'nowrap'
                        }}>
                          TOKEN {resolveTakeawayToken(order)}
                        </span>
                      )}
                      {isMultiRound && (
                        <span style={{
                          background: 'rgba(139, 92, 246, 0.2)',
                          border: '1px solid rgba(139, 92, 246, 0.4)',
                          color: '#C4B5FD',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          fontSize: '0.6875rem',
                          fontWeight: 500
                        }}>
                          Round {roundNum}
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: 400, display: 'block', overflowWrap: 'anywhere' }}>
                      {order.customer_name || 'Dine-in'}
                    </span>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{
                      background: isCritical ? 'rgba(239, 68, 68, 0.2)' : (isRush ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.06)'),
                      border: isCritical ? '1px solid rgba(239, 68, 68, 0.4)' : (isRush ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)'),
                      color: isCritical ? '#FCA5A5' : (isRush ? '#FCD34D' : '#E2E8F0'),
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      whiteSpace: 'nowrap',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <Clock size={12} />
                      <span>{elapsedMins}m</span>
                    </div>
                  </div>
                </div>

                {/* TICKET BODY */}
                <div style={{ padding: '10px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
                  {hasNotes && (
                    <div style={{
                      background: 'rgba(245, 158, 11, 0.08)',
                      border: '1px solid rgba(245, 158, 11, 0.25)',
                      borderRadius: '8px',
                      padding: '6px 10px',
                      color: '#FCD34D',
                      fontSize: '0.75rem',
                      fontWeight: 400,
                      display: 'flex',
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                      gap: '6px',
                      minWidth: 0,
                      boxSizing: 'border-box'
                    }}>
                      <span style={{ color: '#F59E0B', fontWeight: 600, flexShrink: 0 }}>Note:</span>
                      <span style={{ color: '#F1F5F9', minWidth: 0, flex: 1, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>"{notesText}"</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                    {items.map((item, idx) => {
                      const isChecked = Boolean(checkedItemsMap[`${order.id}_${idx}`]);
                      const rawMods = item.modifiers;
                      let mods = [];
                      if (Array.isArray(rawMods)) mods = rawMods;
                      else if (typeof rawMods === 'string') {
                        try { const p = JSON.parse(rawMods); if (Array.isArray(p)) mods = p; } catch {}
                      }

                      return (
                        <div
                          key={idx}
                          onClick={() => toggleItemCheck(order.id, idx)}
                          className="kds-item-row"
                          style={{
                            background: isChecked ? 'rgba(30, 41, 59, 0.4)' : '#1E293B',
                            border: '1px solid rgba(255, 255, 255, 0.04)',
                            borderRadius: '8px',
                            padding: '8px 10px',
                            minHeight: '42px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            opacity: isChecked ? 0.5 : 1,
                            userSelect: 'none',
                            minWidth: 0,
                            boxSizing: 'border-box'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                            <div style={{
                              color: isChecked ? '#10B981' : '#64748B',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              {isChecked ? <CheckSquare size={16} /> : <Square size={16} />}
                            </div>

                            <span style={{
                              color: isChecked ? '#64748B' : '#38BDF8',
                              fontSize: '0.8125rem',
                              fontWeight: 600,
                              flexShrink: 0
                            }}>
                              {item.quantity || item.qty || 1}×
                            </span>

                            <div style={{ minWidth: 0, flex: 1 }}>
                              <span style={{
                                fontSize: '0.8125rem',
                                color: isChecked ? '#64748B' : '#F1F5F9',
                                fontWeight: 500,
                                textDecoration: isChecked ? 'line-through' : 'none',
                                display: 'block',
                                lineHeight: 1.3,
                                wordBreak: 'break-word',
                                overflowWrap: 'anywhere'
                              }}>
                                {item.name || item.dish_name}
                              </span>

                              {(item.includes || item.comboIncludes) && (
                                <div style={{
                                  fontSize: '0.6875rem',
                                  color: '#34D399',
                                  marginTop: '2px',
                                  lineHeight: 1.2,
                                  wordBreak: 'break-word',
                                  overflowWrap: 'anywhere'
                                }}>
                                  Includes: {item.includes || item.comboIncludes}
                                </div>
                              )}

                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', marginTop: '2px' }}>
                                {item.portion && (
                                  <span style={{ fontSize: '0.6875rem', color: '#94A3B8', background: 'rgba(255, 255, 255, 0.05)', padding: '1px 5px', borderRadius: '4px', maxWidth: '100%', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                                    {item.portion}
                                  </span>
                                )}

                                {mods.map((m, mIdx) => (
                                  <span
                                    key={mIdx}
                                    style={{
                                      fontSize: '0.6875rem',
                                      color: '#FCD34D',
                                      background: 'rgba(245, 158, 11, 0.1)',
                                      padding: '1px 5px',
                                      borderRadius: '4px',
                                      maxWidth: '100%',
                                      wordBreak: 'break-word',
                                      overflowWrap: 'anywhere'
                                    }}
                                  >
                                    + {m.name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* TICKET FOOTER: READY BUTTON */}
                <div style={{ padding: '10px 14px', background: '#0F172A', borderTop: '1px solid rgba(255, 255, 255, 0.06)', boxSizing: 'border-box' }}>
                  <button
                    disabled={completingOrderIds.includes(order.id)}
                    onClick={() => handleMarkPrepared(order)}
                    className="kds-action-btn"
                    style={{
                      width: '100%',
                      height: '44px',
                      minHeight: '44px',
                      borderRadius: '10px',
                      border: 'none',
                      background: '#10B981',
                      color: '#FFFFFF',
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      cursor: completingOrderIds.includes(order.id) ? 'not-allowed' : 'pointer',
                      opacity: completingOrderIds.includes(order.id) ? 0.7 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <CheckCircle size={16} />
                    <span>{completingOrderIds.includes(order.id) ? 'Marking Ready...' : 'Mark Ready'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
