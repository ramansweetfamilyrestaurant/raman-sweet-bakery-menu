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
  VolumeX
} from 'lucide-react';
import {
  playKitchenSiren,
  playKdsChime,
  unlockNotificationSound,
  isNotificationSoundReady,
  subscribeAudioState
} from '../../../utils/soundManager';
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
  const [orders, setOrders] = useState([]);
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
  const terminology = getBusinessTerminology(restaurantMeta);
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
  const currentPollSlugRef = useRef('');
  const consecutiveFailuresRef = useRef(0);
  const sirenIntervalRef = useRef(null);
  const sirenTimeoutRef = useRef(null);
  const knownOrderIdsRef = useRef(null);

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
      if (isMountedRef.current) {
        fetchOrders();
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
  const fetchOrders = async () => {
    const targetSlug = resolveCurrentSlug();
    currentPollSlugRef.current = targetSlug;

    // Shared device safety: If slug is missing, display prompt and dispatch ZERO API calls
    if (!targetSlug) {
      setNeedsTenantPrompt(true);
      setLoading(false);
      return;
    }

    setNeedsTenantPrompt(false);

    // In-flight guard: do not start duplicate poll if previous request is still running
    if (isPollingInProgressRef.current) {
      return;
    }

    const token = getStoredKdsToken(targetSlug);
    if (!token) {
      setNeedsPinUnlock(true);
      setLoading(false);
      return;
    }

    isPollingInProgressRef.current = true;

    // Abort prior in-flight request if any
    if (pollingAbortControllerRef.current) {
      try { pollingAbortControllerRef.current.abort(); } catch (e) {}
    }
    const abortController = new AbortController();
    pollingAbortControllerRef.current = abortController;

    try {
      const res = await fetch(`/api/kitchen/orders?slug=${encodeURIComponent(targetSlug)}`, {
        signal: abortController.signal,
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      // Ignore response if unmounted or if tenant changed while request was in flight
      if (!isMountedRef.current || currentPollSlugRef.current !== targetSlug) {
        return;
      }

      if (res.status === 401 || res.status === 403) {
        const errData = await res.json().catch(() => ({}));
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
        clearStoredKdsToken(targetSlug);
        setNeedsPinUnlock(true);
        if (errData.message) {
          setPinError(errData.message);
        }
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
      if (!isMountedRef.current || currentPollSlugRef.current !== targetSlug) {
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
        setOrders(activeOrders);
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        // Controlled abort on unmount or slug transition; do not count as connection error
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
      // Crucial: Release in-flight guard so future polling intervals can recover
      isPollingInProgressRef.current = false;
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  // Polling interval with cleanup on unmount or slug change
  useEffect(() => {
    const targetSlug = resolveCurrentSlug();
    currentPollSlugRef.current = targetSlug;
    knownOrderIdsRef.current = null;
    consecutiveFailuresRef.current = 0;

    fetchOrders();
    const interval = setInterval(() => {
      fetchOrders();
    }, 3000);

    return () => {
      clearInterval(interval);
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

  const handleVerifyPin = async (e) => {
    if (e) e.preventDefault();
    const cleanPin = pinInput.trim();
    if (!/^\d{4}$/.test(cleanPin)) {
      setPinError('Please enter a valid 4-digit numeric PIN');
      return;
    }

    const targetSlug = resolveCurrentSlug();
    if (!targetSlug) return;

    setPinSubmitting(true);
    setPinError('');
    try {
      const res = await fetch('/api/kitchen/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: targetSlug, pin: cleanPin })
      });

      const data = await res.json();
      if (res.ok && data.success && data.token) {
        setStoredKdsToken(targetSlug, data.token);
        setNeedsPinUnlock(false);
        setPinInput('');
        setPinError('');
        if (data.restaurant?.name) {
          setRestaurantName(data.restaurant.name);
        }
        fetchOrders();
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
      setPinError('Connection error. Please check your network and try again.');
    } finally {
      if (isMountedRef.current) {
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
        setTimeout(() => {
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
              if (!isMountedRef.current) return;
              if (ok && data.success && data.token) {
                setStoredKdsToken(targetSlug, data.token);
                setNeedsPinUnlock(false);
                setPinInput('');
                setPinError('');
                if (data.restaurant?.name) setRestaurantName(data.restaurant.name);
                fetchOrders();
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
              if (isMountedRef.current) {
                setPinError('Connection error. Please try again.');
              }
            })
            .finally(() => {
              if (isMountedRef.current) {
                setPinSubmitting(false);
              }
            });
        }, 100);
      }
    }
  };

  const handleKeypadDelete = () => {
    setPinInput(prev => prev.slice(0, -1));
    setPinError('');
  };

  const handleKeypadClear = () => {
    setPinInput('');
    setPinError('');
  };

  const handleLockScreen = () => {
    const targetSlug = resolveCurrentSlug();
    clearStoredKdsToken(targetSlug);
    setNeedsPinUnlock(true);
    setOrders([]);
  };

  const handleMarkPrepared = async (orderId) => {
    const targetSlug = resolveCurrentSlug();
    const token = getStoredKdsToken(targetSlug);
    try {
      setOrders(prev => prev.filter(o => o.id !== orderId));
      const res = await fetch(`/api/kitchen/orders/${orderId}/complete?slug=${encodeURIComponent(targetSlug)}`, {
        method: 'PATCH',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (res.status === 401 || res.status === 403) {
        clearStoredKdsToken(targetSlug);
        setNeedsPinUnlock(true);
      }
      fetchOrders();
    } catch (e) {
      alert('Failed to mark order prepared');
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

    const targetSlug = resolveCurrentSlug();
    if (!targetSlug) {
      setRecallNotice({
        type: 'error',
        message: 'Cannot recall order: missing restaurant slug.'
      });
      return;
    }

    setRecallingOrderIds(prev => [...prev, order.id]);

    // Preserve previous queues for rollback on error
    const previousOrders = [...orders];
    const previousRecentlyCompleted = [...recentlyCompleted];

    // Optimistic UI update
    setRecentlyCompleted(prev => prev.filter(o => o.id !== order.id));
    setOrders(prev => [order, ...prev.filter(o => o.id !== order.id)]);

    const token = getStoredKdsToken(targetSlug);

    try {
      const res = await fetch(`/api/kitchen/orders/${order.id}/recall?slug=${encodeURIComponent(targetSlug)}`, {
        method: 'PATCH',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });

      const data = await res.json().catch(() => ({}));
      const parsed = parseRecallErrorResponse(res.status, data, order.id);

      if (parsed.success) {
        setRecallNotice({
          type: 'success',
          message: parsed.message
        });
        fetchOrders();
      } else {
        // Request rejected by server -> rollback optimistic update
        setOrders(previousOrders);
        setRecentlyCompleted(previousRecentlyCompleted);

        setRecallNotice({
          type: 'error',
          message: parsed.message
        });

        if (parsed.isForbidden && data.error === 'KDS_DISABLED') {
          setKdsDisabled(true);
        }

        // Resynchronize authoritative queue
        fetchOrders();
      }
    } catch (err) {
      // Network failure -> rollback optimistic update & resynchronize
      setOrders(previousOrders);
      setRecentlyCompleted(previousRecentlyCompleted);

      const parsed = parseRecallErrorResponse(0, {}, order.id);
      setRecallNotice({
        type: 'error',
        message: parsed.message
      });
      fetchOrders();
    } finally {
      if (isMountedRef.current) {
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
    if (!raw) return 'TAKEAWAY';
    const str = String(raw).trim();

    const cMatch = str.match(/^S?(\d+)[- •]+(?:Row[- ]*)?([A-Za-z]+)[- •]+(?:Seat[- ]*)?(\d+)$/i) ||
                   str.match(/Screen\s*(\d+)\s*[-•]\s*Row\s*([A-Za-z]+)\s*[-•]\s*Seat\s*(\d+)/i);
    if (cMatch) {
      return `🎬 SCREEN ${cMatch[1]} • ROW ${cMatch[2].toUpperCase()} • SEAT ${cMatch[3]}`;
    }
    if (str.toLowerCase().startsWith('screen')) {
      return `🎬 ${str.toUpperCase()}`;
    }

    const cleanSpaceType = spaceType ? String(spaceType).trim().toLowerCase() : null;

    if (cleanSpaceType === 'cinema_seat' || cleanSpaceType === 'cinema') {
      return `🎬 SEAT ${str.toUpperCase()}`;
    }
    if (cleanSpaceType === 'room') return `🏨 ROOM ${str.replace(/^room\s*#?/i, '')}`;
    if (cleanSpaceType === 'cabin') return `🛋️ CABIN ${str.replace(/^cabin\s*#?/i, '')}`;
    if (cleanSpaceType === 'vip') return `👑 VIP ${str.replace(/^vip\s*#?/i, '')}`;
    if (cleanSpaceType === 'counter') {
      const num = str.replace(/^counter\s*#?/i, '').trim();
      return num ? `🧾 COUNTER ${num}` : `🧾 COUNTER`;
    }
    if (cleanSpaceType === 'table') {
      const numOnly = str.replace(/^table\s*#?/i, '');
      return `TABLE ${numOnly}`;
    }

    if (/^counter/i.test(str)) {
      const num = str.replace(/^counter\s*#?/i, '').trim();
      return num ? `🧾 COUNTER ${num}` : `🧾 COUNTER`;
    }
    if (/^room\s*#?\d+/i.test(str)) return `🏨 ROOM ${str.replace(/^room\s*#?/i, '')}`;
    if (/^cabin\s*#?\d+/i.test(str)) return `🛋️ CABIN ${str.replace(/^cabin\s*#?/i, '')}`;
    if (/^vip\s*#?\d+/i.test(str)) return `👑 VIP ${str.replace(/^vip\s*#?/i, '')}`;
    if (/^(takeaway|parcel)/i.test(str) || /^[\p{Extended_Pictographic}\u2000-\u3300]/u.test(str)) {
      return str.toUpperCase();
    }

    if (fallbackPrefix) {
      const cleanFallback = String(fallbackPrefix).trim().toLowerCase();
      if (cleanFallback === 'counter') return `🧾 COUNTER ${str}`;
      if (cleanFallback === 'room') return `🏨 ROOM ${str}`;
      if (cleanFallback === 'cabin') return `🛋️ CABIN ${str}`;
      if (cleanFallback === 'vip') return `👑 VIP ${str}`;
      if (cleanFallback === 'cinema_seat' || cleanFallback === 'cinema') return `🎬 SEAT ${str.toUpperCase()}`;
    }

    return `TABLE ${str}`;
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
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '32px 20px',
        background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
        color: '#FFFFFF', textAlign: 'center', fontFamily: 'system-ui, sans-serif'
      }}>
        <Flame size={48} color="#38BDF8" style={{ marginBottom: '16px' }} />
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#F8FAFC', margin: '0 0 8px 0' }}>
          🍳 Connecting to Kitchen Display System...
        </h2>
        <span style={{ fontSize: '0.84rem', color: '#64748B' }}>
          Verifying restaurant authorization & security permissions
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
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', padding: '32px 20px',
          background: 'linear-gradient(135deg, #090D16 0%, #0F172A 100%)',
          color: '#FFFFFF', textAlign: 'center', fontFamily: 'system-ui, sans-serif'
        }}
      >
        <div style={{
          background: '#0F172A', border: '1px solid #1E293B', borderRadius: '24px',
          padding: '36px 28px', maxWidth: '460px', width: '100%',
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
                color: '#F8FAFC', fontSize: '0.95rem', fontWeight: 700,
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
            padding: '12px 14px', textAlign: 'left', fontSize: '0.76rem', color: '#64748B', lineHeight: 1.5
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
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
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
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
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
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
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
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '24px 16px',
        background: 'linear-gradient(135deg, #090D16 0%, #111827 100%)',
        color: '#FFFFFF', fontFamily: 'system-ui, sans-serif'
      }}>
        <div style={{
          background: '#0F172A', border: '1px solid #1E293B', borderRadius: '24px',
          padding: '32px 24px', maxWidth: '380px', width: '100%',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6)', textAlign: 'center', boxSizing: 'border-box'
        }}>
          <div style={{
            width: '60px', height: '60px', borderRadius: '18px',
            background: 'linear-gradient(135deg, #38BDF8 0%, #2563EB 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px auto', boxShadow: '0 8px 24px rgba(56,189,248,0.3)'
          }}>
            <Lock size={28} color="#FFFFFF" />
          </div>

          <h2 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#F8FAFC', margin: '0 0 4px 0' }}>
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

          <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', marginBottom: '24px' }}>
            {[0, 1, 2, 3].map(idx => (
              <div
                key={idx}
                style={{
                  width: '52px', height: '56px', borderRadius: '14px',
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
        minHeight: '100vh',
        background: '#070B14',
        color: '#F8FAFC',
        padding: 'clamp(8px, 2vw, 16px)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
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
        @media (max-width: 480px) {
          .touchqr-kds-grid {
            grid-template-columns: 1fr;
            gap: 10px;
          }
          .kds-header-bar {
            padding: 10px 12px !important;
            gap: 8px !important;
          }
          .kds-header-title {
            font-size: 1.05rem !important;
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
            background: 'linear-gradient(90deg, #EA580C 0%, #DC2626 100%)',
            color: '#FFFFFF',
            padding: '14px 20px',
            borderRadius: '14px',
            marginBottom: '14px',
            textAlign: 'center',
            fontWeight: 900,
            fontSize: '0.95rem',
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(234, 88, 12, 0.4)',
            border: '2px solid #FDE047',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <Volume2 size={20} />
          <span>TAP HERE TO UNLOCK KITCHEN EMERGENCY ALARM SOUND & FULL LOUD SIREN</span>
        </div>
      )}

      {/* RECALL / ERROR NOTIFICATION BANNER */}
      {recallNotice && (
        <div
          style={{
            background: recallNotice.type === 'success'
              ? 'linear-gradient(90deg, #064E3B 0%, #065F46 100%)'
              : 'linear-gradient(90deg, #7F1D1D 0%, #991B1B 100%)',
            border: recallNotice.type === 'success' ? '1px solid #10B981' : '1px solid #EF4444',
            color: recallNotice.type === 'success' ? '#D1FAE5' : '#FEE2E2',
            padding: '12px 18px',
            borderRadius: '12px',
            marginBottom: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.86rem',
            fontWeight: 800,
            boxShadow: '0 4px 14px rgba(0,0,0,0.4)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{recallNotice.type === 'success' ? '✅' : '⚠️'}</span>
            <span>{recallNotice.message}</span>
          </div>
          <button
            onClick={() => setRecallNotice(null)}
            style={{
              background: 'none', border: 'none', color: '#FFFFFF',
              fontSize: '1rem', cursor: 'pointer', opacity: 0.8
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
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: '12px', background: 'linear-gradient(180deg, #0F172A 0%, #0B1120 100%)',
          padding: '14px 20px', borderRadius: '16px', border: '1px solid #1E293B', marginBottom: '14px',
          boxSizing: 'border-box'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.5rem', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)', flexShrink: 0
          }}>
            {terminology.spaceIcon || '🍳'}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h1
                className="kds-header-title"
                style={{
                  fontSize: '1.25rem', fontWeight: 900, color: '#F8FAFC', margin: 0,
                  letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                }}
              >
                {restaurantName} — {terminology.kdsTitle || 'KDS'}
              </h1>
              <span style={{ fontSize: '0.66rem', fontWeight: 900, background: '#10B981', color: '#022C22', padding: '2px 8px', borderRadius: '6px', textTransform: 'uppercase' }}>
                {terminology.serviceStation?.toUpperCase() || 'LIVE CHEF SCREEN'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '2px', fontSize: '0.74rem', color: '#94A3B8', flexWrap: 'wrap' }}>
              <span>Active Tickets: <strong style={{ color: '#38BDF8' }}>{orders.length}</strong></span>
              <span>•</span>
              <span>Total {terminology.itemPlural || 'Dishes'}: <strong style={{ color: '#FCD34D' }}>{totalDishesCount} qty</strong></span>
              {rushCount > 0 && (
                <>
                  <span>•</span>
                  <span style={{ color: '#F87171', fontWeight: 800 }}>⚠️ {rushCount} RUSH (&gt;15m)</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* OFFLINE / RECONNECTION STATUS INDICATOR */}
          <div
            id="kds-connection-indicator"
            title={
              connectionStatus === 'online'
                ? `Connected & Live • Last sync ${lastSyncTime ? lastSyncTime.toLocaleTimeString() : 'just now'}`
                : connectionStatus === 'reconnecting'
                ? 'Network issue detected. Retrying connection...'
                : 'Offline. Retrying automatically...'
            }
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 10px',
              borderRadius: '8px',
              fontSize: '0.70rem',
              fontWeight: 900,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              background:
                connectionStatus === 'online'
                  ? 'rgba(16, 185, 129, 0.15)'
                  : connectionStatus === 'reconnecting'
                  ? 'rgba(245, 158, 11, 0.15)'
                  : 'rgba(239, 68, 68, 0.18)',
              border:
                connectionStatus === 'online'
                  ? '1px solid #10B981'
                  : connectionStatus === 'reconnecting'
                  ? '1px solid #F59E0B'
                  : '1.5px solid #EF4444',
              color:
                connectionStatus === 'online'
                  ? '#34D399'
                  : connectionStatus === 'reconnecting'
                  ? '#FCD34D'
                  : '#FCA5A5'
            }}
          >
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background:
                  connectionStatus === 'online'
                    ? '#10B981'
                    : connectionStatus === 'reconnecting'
                    ? '#F59E0B'
                    : '#EF4444',
                display: 'inline-block',
                boxShadow:
                  connectionStatus === 'online'
                    ? '0 0 6px #10B981'
                    : connectionStatus === 'reconnecting'
                    ? '0 0 6px #F59E0B'
                    : '0 0 8px #EF4444'
              }}
            />
            <span>
              {connectionStatus === 'online'
                ? 'ONLINE'
                : connectionStatus === 'reconnecting'
                ? 'RECONNECTING'
                : 'OFFLINE'}
            </span>
          </div>

          {/* SOUND ENABLE / TOGGLE CONTROL */}
          <button
            id="kds-sound-toggle-btn"
            type="button"
            onClick={handleToggleSound}
            title={
              soundPreference === 'muted'
                ? 'Sound is muted for this kitchen. Tap to enable siren alerts.'
                : isAudioReady
                ? 'Kitchen siren sound active. Tap to mute or test.'
                : 'Audio requires gesture in new browser session. Tap to enable sound.'
            }
            style={{
              height: '36px',
              padding: '0 10px',
              borderRadius: '10px',
              border: soundPreference === 'muted'
                ? '1px solid #475569'
                : isAudioReady
                ? '1px solid #10B981'
                : '1px solid #F59E0B',
              background: soundPreference === 'muted'
                ? 'rgba(71, 85, 105, 0.2)'
                : isAudioReady
                ? 'rgba(16, 185, 129, 0.15)'
                : 'rgba(245, 158, 11, 0.15)',
              color: soundPreference === 'muted'
                ? '#94A3B8'
                : isAudioReady
                ? '#34D399'
                : '#FCD34D',
              fontSize: '0.74rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {soundPreference === 'muted' ? (
              <>
                <VolumeX size={14} />
                <span>Muted</span>
              </>
            ) : isAudioReady ? (
              <>
                <Volume2 size={14} />
                <span>Sound ON</span>
              </>
            ) : (
              <>
                <Volume2 size={14} />
                <span>Enable Sound</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowPrepSummary(!showPrepSummary)}
            style={{
              height: '36px', padding: '0 10px', borderRadius: '10px', border: '1px solid #334155',
              background: showPrepSummary ? 'rgba(56, 189, 248, 0.15)' : '#1E293B',
              color: showPrepSummary ? '#38BDF8' : '#94A3B8', fontSize: '0.74rem', fontWeight: 800,
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px'
            }}
          >
            <Layers size={14} />
            <span>{showPrepSummary ? 'Hide Totals' : 'Dish Totals'}</span>
          </button>

          {recentlyCompleted.length > 0 && (
            <button
              type="button"
              onClick={() => setShowCompletedDrawer(!showCompletedDrawer)}
              style={{
                height: '36px', padding: '0 10px', borderRadius: '10px', border: '1px solid #334155',
                background: '#1E293B', color: '#F1F5F9', fontSize: '0.74rem', fontWeight: 800,
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px'
              }}
            >
              <RotateCcw size={13} color="#F59E0B" />
              <span>Recall ({recentlyCompleted.length})</span>
            </button>
          )}

          <div style={{ background: '#0F172A', color: '#38BDF8', padding: '6px 12px', borderRadius: '10px', fontWeight: 900, fontSize: '0.84rem', border: '1px solid #334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={14} />
            <span>{currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}</span>
          </div>

          <button
            onClick={toggleFullscreen}
            style={{
              height: '36px', background: '#2563EB', border: 'none', color: '#F8FAFC', padding: '0 12px', borderRadius: '10px',
              fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem'
            }}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            <span>{isFullscreen ? 'Exit' : 'Fullscreen'}</span>
          </button>

          <button
            onClick={handleLockScreen}
            title="Lock Kitchen Display Screen"
            style={{
              height: '36px', background: '#450A0A', border: '1px solid #991B1B', color: '#FCA5A5', padding: '0 12px', borderRadius: '10px',
              fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem'
            }}
          >
            <Lock size={14} />
            <span>Lock</span>
          </button>
        </div>
      </div>

      {/* CHEF PREP SUMMARY MATRIX */}
      {showPrepSummary && aggregatedPrepItems.length > 0 && (
        <div style={{
          background: '#0D1526', border: '1px solid #1E293B', borderRadius: '14px',
          padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px',
          overflowX: 'auto', scrollbarWidth: 'none', marginBottom: '14px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', color: '#94A3B8', fontSize: '0.70rem', fontWeight: 800, textTransform: 'uppercase' }}>
            <Flame size={14} color="#F59E0B" />
            <span>Active Drop Totals:</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap' }}>
            {aggregatedPrepItems.map(item => (
              <div
                key={item.name}
                style={{
                  background: '#1E293B', border: '1px solid #334155', borderRadius: '8px',
                  padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap'
                }}
              >
                <span style={{ background: '#2563EB', color: '#FFFFFF', padding: '1px 6px', borderRadius: '5px', fontSize: '0.74rem', fontWeight: 900 }}>
                  {item.count}×
                </span>
                <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#F1F5F9' }}>
                  {item.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* RECALL DRAWER */}
      {showCompletedDrawer && recentlyCompleted.length > 0 && (
        <div style={{
          background: '#0F172A', border: '1px solid #334155', borderRadius: '14px',
          padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 900, color: '#34D399', textTransform: 'uppercase' }}>
              ✓ Recently Prepared Orders (Click Undo to restore to active queue)
            </span>
            <button
              type="button"
              onClick={() => setShowCompletedDrawer(false)}
              style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 700 }}
            >
              Close ✕
            </button>
          </div>

          <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
            {recentlyCompleted.map(ord => {
              const isRecallingThis = recallingOrderIds.includes(ord.id);
              return (
                <div
                  key={ord.id}
                  style={{
                    background: '#1E293B', border: '1px solid #334155', borderRadius: '10px',
                    padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '10px', whiteSpace: 'nowrap'
                  }}
                >
                  <div>
                    <strong style={{ fontSize: '0.80rem', color: '#F8FAFC' }}>
                      {formatKdsLocation(ord.table_number, ord.space_type)}
                    </strong>
                    <span style={{ fontSize: '0.68rem', color: '#94A3B8', display: 'block' }}>
                      Order #{ord.id}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={isRecallingThis}
                    onClick={() => handleRecallOrder(ord)}
                    style={{
                      padding: '4px 8px', borderRadius: '6px', border: '1px solid #F59E0B',
                      background: isRecallingThis ? '#334155' : 'rgba(245, 158, 11, 0.15)',
                      color: isRecallingThis ? '#94A3B8' : '#FDE68A', fontSize: '0.70rem',
                      fontWeight: 800, cursor: isRecallingThis ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: '4px'
                    }}
                  >
                    <RotateCcw size={11} />
                    <span>{isRecallingThis ? 'Recalling...' : 'Undo'}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TICKETS GRID */}
      {orders.length === 0 ? (
        <div style={{ padding: '80px 20px', textAlign: 'center', background: '#0B1120', borderRadius: '20px', border: '2px dashed #1E293B', maxWidth: '600px', margin: '40px auto' }}>
          <Flame size={56} color="#475569" style={{ marginBottom: '16px' }} />
          <h2 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#94A3B8', margin: '0 0 8px 0' }}>
            Kitchen is Clear! Zero Active Orders
          </h2>
          <p style={{ fontSize: '0.88rem', color: '#64748B', margin: 0 }}>
            New QR table orders will sound a loud siren alarm and display big tickets here automatically.
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
                  background: '#0E1626',
                  borderRadius: '16px',
                  border: isCritical ? '2px solid #EF4444' : isRush ? '2px solid #F59E0B' : '1.5px solid #1E293B',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
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
                  background: isCritical ? 'linear-gradient(135deg, #7F1D1D 0%, #991B1B 100%)' : (isRush ? 'linear-gradient(135deg, #78350F 0%, #92400E 100%)' : 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)'),
                  padding: '12px 14px',
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  flexWrap: 'wrap'
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <div style={{ fontSize: '1.22rem', fontWeight: 900, color: '#FFFFFF', letterSpacing: '-0.02em', lineHeight: 1.1, wordBreak: 'break-word' }}>
                        {formatKdsLocation(order.table_number, order.space_type, restaurantMeta?.business_type === 'hotel_resort' ? 'room' : restaurantMeta?.table_prefix)}
                      </div>
                      {isMultiRound && (
                        <span style={{
                          background: '#8B5CF6',
                          color: '#FFFFFF',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontSize: '0.72rem',
                          fontWeight: 900,
                          letterSpacing: '0.04em',
                          display: 'inline-flex',
                          alignItems: 'center',
                          boxShadow: '0 1px 4px rgba(139, 92, 246, 0.4)'
                        }}>
                          ROUND {roundNum}
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.72rem', color: isRush ? '#FEF08A' : '#94A3B8', fontWeight: 700, wordBreak: 'break-word' }}>
                      Ticket #{order.id} • {order.customer_name || 'Dine-in'}
                    </span>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{
                      background: isCritical ? '#DC2626' : (isRush ? '#D97706' : '#2563EB'),
                      color: '#FFFFFF',
                      padding: '4px 9px',
                      borderRadius: '8px',
                      fontSize: '0.78rem',
                      fontWeight: 900,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <Clock size={13} />
                      <span>{elapsedMins}m ago</span>
                    </div>
                    {isRush && (
                      <span style={{ fontSize: '0.65rem', color: isCritical ? '#FCA5A5' : '#FDE68A', fontWeight: 900, display: 'block', marginTop: '2px' }}>
                        {isCritical ? '🚨 CRITICAL DELAY' : '⚠️ RUSH TICKET'}
                      </span>
                    )}
                  </div>
                </div>

                {/* TICKET BODY */}
                <div style={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
                  {hasNotes && (
                    <div style={{
                      background: 'rgba(245, 158, 11, 0.15)',
                      border: '1.5px solid #F59E0B',
                      borderRadius: '10px',
                      padding: '8px 10px',
                      color: '#FDE68A',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      minWidth: 0,
                      boxSizing: 'border-box'
                    }}>
                      <AlertTriangle size={16} color="#F59E0B" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <div style={{ wordBreak: 'break-word', overflowWrap: 'anywhere', minWidth: 0 }}>
                        <span style={{ fontSize: '0.66rem', color: '#FBBF24', textTransform: 'uppercase', display: 'block', letterSpacing: '0.04em' }}>
                          CHEF INSTRUCTION:
                        </span>
                        <span style={{ color: '#FFFFFF', fontWeight: 800 }}>"{notesText}"</span>
                      </div>
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
                            background: isChecked ? 'rgba(30, 41, 59, 0.5)' : '#131D31',
                            border: '1px solid #1E293B',
                            borderRadius: '10px',
                            padding: '8px 10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            opacity: isChecked ? 0.6 : 1,
                            userSelect: 'none',
                            minWidth: 0,
                            boxSizing: 'border-box'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                            <div style={{
                              color: isChecked ? '#10B981' : '#64748B',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              {isChecked ? <CheckSquare size={18} /> : <Square size={18} />}
                            </div>

                            <span style={{
                              background: isChecked ? '#334155' : '#2563EB',
                              color: '#FFFFFF',
                              minWidth: '28px',
                              height: '28px',
                              padding: '0 6px',
                              borderRadius: '7px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.90rem',
                              fontWeight: 900,
                              flexShrink: 0
                            }}>
                              ×{item.quantity || item.qty || 1}
                            </span>

                            <div style={{ minWidth: 0, flex: 1 }}>
                              <strong style={{
                                fontSize: '0.92rem',
                                color: isChecked ? '#94A3B8' : '#F8FAFC',
                                fontWeight: 800,
                                textDecoration: isChecked ? 'line-through' : 'none',
                                display: 'block',
                                lineHeight: 1.2,
                                wordBreak: 'break-word',
                                overflowWrap: 'anywhere'
                              }}>
                                {item.name || item.dish_name}
                              </strong>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', marginTop: '2px' }}>
                                {item.portion && (
                                  <span style={{ fontSize: '0.68rem', color: '#93C5FD', fontWeight: 700, background: 'rgba(59, 130, 246, 0.15)', padding: '1px 5px', borderRadius: '4px' }}>
                                    {item.portion}
                                  </span>
                                )}

                                {mods.map((m, mIdx) => (
                                  <span
                                    key={mIdx}
                                    style={{
                                      fontSize: '0.66rem',
                                      color: '#FEF08A',
                                      background: 'rgba(202, 138, 4, 0.2)',
                                      border: '1px solid #CA8A04',
                                      padding: '1px 5px',
                                      borderRadius: '4px',
                                      fontWeight: 800,
                                      wordBreak: 'break-word'
                                    }}
                                  >
                                    ➕ {m.name}
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
                <div style={{ padding: '12px 14px', background: '#0A101C', borderTop: '1px solid #1E293B', boxSizing: 'border-box' }}>
                  <button
                    onClick={() => {
                      setRecentlyCompleted(prev => [{ ...order, completedAt: new Date() }, ...prev.slice(0, 9)]);
                      handleMarkPrepared(order.id);
                    }}
                    className="kds-action-btn"
                    style={{
                      width: '100%',
                      minHeight: '44px',
                      borderRadius: '10px',
                      border: 'none',
                      background: allItemsChecked 
                        ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)' 
                        : 'linear-gradient(135deg, #10B981 0%, #047857 100%)',
                      color: '#FFFFFF',
                      fontSize: '0.86rem',
                      fontWeight: 900,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <BellRing size={17} />
                    <span>🔔 READY • {
                      order.order_type === 'counter' || order.table_number === 'Counter'
                        ? 'CALL TO COUNTER'
                        : terminology.isHotel
                        ? 'NOTIFY ROOM SERVICE'
                        : terminology.isCinema
                        ? 'NOTIFY USHER'
                        : terminology.isQsr || terminology.isBakery
                        ? 'CALL TO COUNTER'
                        : 'NOTIFY WAITER'
                    }</span>
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
