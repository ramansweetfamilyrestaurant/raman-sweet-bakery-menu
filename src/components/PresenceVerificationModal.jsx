import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin,
  Navigation,
  ShieldCheck,
  AlertCircle,
  RotateCcw,
  UserCheck,
  Clock,
  CheckCircle2,
  X,
  Compass,
  Smartphone,
  Info,
  Radio,
  XCircle,
  Sparkles
} from 'lucide-react';
import { verifyCustomerLocationApi, requestStaffPresenceVerification, fetchPresenceStatus } from '../api/client';
import { isValidQrTokenFormat } from '../utils/qrSecurity';

export default function PresenceVerificationModal({
  isOpen,
  onClose,
  restaurantInfo,
  tableNumber = '1',
  spaceType = 'table',
  tableToken = '',
  tableLabel = 'Table',
  presencePolicy = {},
  onVerified,
  initialAction = 'auto' // 'auto' | 'gps' | 'staff'
}) {
  const mode = 'GPS_WITH_STAFF_FALLBACK';
  const allowedMethods = ['GPS', 'STAFF'];
  const isStaffAllowed = true;
  const isGpsAllowed = true;

  // State Machine:
  // 'GPS_PROMPT' | 'GPS_ACQUIRING' | 'GPS_FAILED' | 'STAFF_REQUESTING' | 'STAFF_WAITING' | 'STAFF_REJECTED' | 'STAFF_EXPIRED' | 'VERIFIED'
  const [viewState, setViewState] = useState('GPS_PROMPT');
  const [errorMessage, setErrorMessage] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [accuracyVal, setAccuracyVal] = useState(null);
  const [distanceVal, setDistanceVal] = useState(null);
  const [staffExpirySeconds, setStaffExpirySeconds] = useState(120);
  const [activeVerificationToken, setActiveVerificationToken] = useState('');

  const isMountedRef = useRef(true);
  const isAcquiringGpsRef = useRef(false);
  const isRequestingStaffRef = useRef(false);
  const gpsWatchdogRef = useRef(null);
  const pollTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);

  // Initialize or reset view on open
  useEffect(() => {
    isMountedRef.current = true;

    if (isOpen) {
      setErrorMessage('');
      setRejectionReason('');

      if (initialAction === 'staff') {
        handleRequestStaff();
      } else {
        // Auto-start GPS acquisition on first presentation for seamless UX
        handleAcquireGps();
      }
    }

    return () => {
      isMountedRef.current = false;
      cleanupAllTimers();
    };
  }, [isOpen]);

  const cleanupAllTimers = () => {
    if (gpsWatchdogRef.current) {
      clearTimeout(gpsWatchdogRef.current);
      gpsWatchdogRef.current = null;
    }
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    isAcquiringGpsRef.current = false;
    isRequestingStaffRef.current = false;
  };

  if (!isOpen) return null;

  // --------------------------------------------------------------------------
  // 1. GPS VERIFICATION HANDLER
  // --------------------------------------------------------------------------
  const handleAcquireGps = () => {
    if (isAcquiringGpsRef.current) return;
    isAcquiringGpsRef.current = true;
    cleanupAllTimers();

    const cleanToken = String(tableToken || '').trim();
    if (!cleanToken || !isValidQrTokenFormat(cleanToken)) {
      isAcquiringGpsRef.current = false;
      setViewState('GPS_FAILED');
      setErrorMessage('Invalid or unverified Table QR. Please scan the official QR code at your dining table.');
      return;
    }

    if (!navigator.geolocation) {
      isAcquiringGpsRef.current = false;
      setViewState('GPS_FAILED');
      setErrorMessage('Your mobile browser does not support GPS location. Please use Chrome or Safari.');
      return;
    }

    setViewState('GPS_ACQUIRING');
    setErrorMessage('');

    let hasCompleted = false;

    // Outer 10-second watchdog timer
    gpsWatchdogRef.current = setTimeout(() => {
      if (!hasCompleted && isMountedRef.current) {
        hasCompleted = true;
        isAcquiringGpsRef.current = false;
        setViewState('GPS_FAILED');
        setErrorMessage('Getting your GPS signal timed out. Please ensure Location is enabled in browser settings.');
      }
    }, 10000);

    const geoOptions = {
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 30000
    };

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (hasCompleted || !isMountedRef.current) return;
        hasCompleted = true;
        if (gpsWatchdogRef.current) clearTimeout(gpsWatchdogRef.current);

        try {
          const custLat = pos.coords.latitude;
          const custLng = pos.coords.longitude;
          const custAcc = Math.round(pos.coords.accuracy || 999);
          setAccuracyVal(custAcc);

          const slug = restaurantInfo?.slug || '';
          const verifyRes = await verifyCustomerLocationApi({
            slug,
            table_number: tableNumber || '1',
            space_type: spaceType || 'table',
            table_token: cleanToken,
            latitude: custLat,
            longitude: custLng,
            accuracy: custAcc
          });

          if (!isMountedRef.current) return;

          if (verifyRes && verifyRes.verified && verifyRes.presence_token) {
            setDistanceVal(verifyRes.distance_meters);
            setViewState('VERIFIED');
            isAcquiringGpsRef.current = false;

            setTimeout(() => {
              if (isMountedRef.current && onVerified) {
                onVerified(verifyRes.presence_token, 'GPS');
              }
            }, 600);
          } else {
            isAcquiringGpsRef.current = false;
            setViewState('GPS_FAILED');
            setErrorMessage(verifyRes?.message || 'Location verification was outside the dining boundary.');
          }
        } catch (err) {
          if (!isMountedRef.current) return;
          isAcquiringGpsRef.current = false;
          setViewState('GPS_FAILED');
          setErrorMessage(err.message || 'Could not verify location with restaurant.');
        }
      },
      (err) => {
        if (hasCompleted || !isMountedRef.current) return;
        hasCompleted = true;
        if (gpsWatchdogRef.current) clearTimeout(gpsWatchdogRef.current);
        isAcquiringGpsRef.current = false;
        setViewState('GPS_FAILED');

        if (err.code === 1) {
          setErrorMessage('Location permission was denied. Please allow location access in your browser bar or use Staff Verification.');
        } else if (err.code === 2) {
          setErrorMessage('Location unavailable. Please ensure device GPS is turned on.');
        } else {
          setErrorMessage('Location request timed out. Please tap retry or ask staff for verification.');
        }
      },
      geoOptions
    );
  };

  // --------------------------------------------------------------------------
  // 2. STAFF FALLBACK REQUEST HANDLER
  // --------------------------------------------------------------------------
  const handleRequestStaff = async () => {
    if (isRequestingStaffRef.current) return;
    isRequestingStaffRef.current = true;
    cleanupAllTimers();

    const cleanToken = String(tableToken || '').trim();
    if (!cleanToken) {
      isRequestingStaffRef.current = false;
      setViewState('GPS_FAILED');
      setErrorMessage('A valid Table QR code is required to request staff verification.');
      return;
    }

    setViewState('STAFF_REQUESTING');
    setErrorMessage('');

    try {
      const slug = restaurantInfo?.slug || '';
      const res = await requestStaffPresenceVerification({
        slug,
        table_number: tableNumber || '1',
        space_type: spaceType || 'table',
        table_token: cleanToken
      });

      if (!isMountedRef.current) return;
      isRequestingStaffRef.current = false;

      if (res && res.success && res.verification_token) {
        setActiveVerificationToken(res.verification_token);
        setViewState('STAFF_WAITING');

        // Calculate countdown seconds from expires_at
        let timeoutSec = 120;
        if (res.expires_at) {
          const diff = Math.max(10, Math.round((new Date(res.expires_at).getTime() - Date.now()) / 1000));
          timeoutSec = diff;
        }
        setStaffExpirySeconds(timeoutSec);

        // Start countdown timer
        countdownTimerRef.current = setInterval(() => {
          if (!isMountedRef.current) return;
          setStaffExpirySeconds((prev) => {
            if (prev <= 1) {
              clearInterval(countdownTimerRef.current);
              setViewState('STAFF_EXPIRED');
              return 0;
            }
            return prev - 1;
          });
        }, 1000);

        // Start controlled single polling loop
        startStaffStatusPolling(res.verification_token, res.poll_after_ms || 2000);
      } else {
        setViewState('GPS_FAILED');
        setErrorMessage(res?.message || 'Could not send verification request to staff.');
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      isRequestingStaffRef.current = false;
      setViewState('GPS_FAILED');
      setErrorMessage(err.message || 'Failed to connect to restaurant staff service.');
    }
  };

  // --------------------------------------------------------------------------
  // 3. STAFF STATUS POLLING LOOP (SINGLE TIMER)
  // --------------------------------------------------------------------------
  const startStaffStatusPolling = (tokenToPoll, pollIntervalMs = 2000) => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);

    const poll = async () => {
      if (!isMountedRef.current || !tokenToPoll) return;

      try {
        const statusRes = await fetchPresenceStatus(tokenToPoll);
        if (!isMountedRef.current) return;

        if (statusRes.status === 'verified' && statusRes.presence_token) {
          cleanupAllTimers();
          setViewState('VERIFIED');

          setTimeout(() => {
            if (isMountedRef.current && onVerified) {
              onVerified(statusRes.presence_token, 'STAFF');
            }
          }, 600);
          return;
        } else if (statusRes.status === 'rejected') {
          cleanupAllTimers();
          setViewState('STAFF_REJECTED');
          setRejectionReason(statusRes.rejection_reason || 'Verification was rejected by restaurant staff.');
          return;
        } else if (statusRes.status === 'expired') {
          cleanupAllTimers();
          setViewState('STAFF_EXPIRED');
          return;
        }

        // Still pending -> schedule next poll tick
        pollTimerRef.current = setTimeout(poll, pollIntervalMs);
      } catch (err) {
        // Tolerant network retry on transient polling errors
        if (isMountedRef.current) {
          pollTimerRef.current = setTimeout(poll, pollIntervalMs + 1000);
        }
      }
    };

    pollTimerRef.current = setTimeout(poll, pollIntervalMs);
  };

  const handleCancelAndClose = () => {
    cleanupAllTimers();
    if (onClose) onClose();
  };

  // Helper formatting for countdown display
  const formatCountdown = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const currentLabel = tableLabel || `${spaceType === 'cabin' ? 'Cabin' : (spaceType === 'room' ? 'Room' : (spaceType === 'vip' ? 'VIP' : 'Table'))} ${tableNumber || '1'}`;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(10, 25, 41, 0.78)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      zIndex: 10005,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    }}>
      <div style={{
        background: '#FFFFFF',
        borderRadius: '26px',
        maxWidth: '430px',
        width: '100%',
        padding: '24px',
        boxShadow: '0 25px 60px rgba(0,0,0,0.35)',
        animation: 'fadeIn 0.22s ease-out',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Header Ribbon */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '18px',
          borderBottom: '1.5px solid #F1F5F9',
          paddingBottom: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              background: '#ECFDF5',
              color: '#059669',
              padding: '8px',
              borderRadius: '12px',
              display: 'flex'
            }}>
              <ShieldCheck size={22} />
            </div>
            <div>
              <strong style={{ fontSize: '1.02rem', color: '#0F172A', display: 'block' }}>
                Table Presence Verification
              </strong>
              <span style={{ fontSize: '0.76rem', color: '#059669', fontWeight: 800 }}>
                {currentLabel} • {restaurantInfo?.name || 'TouchQR'}
              </span>
            </div>
          </div>
          <button
            onClick={handleCancelAndClose}
            style={{
              background: '#F1F5F9',
              border: 'none',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              cursor: 'pointer',
              fontWeight: 900,
              color: '#64748B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ✕
          </button>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* VIEW 1: GPS PROMPT / IDLE                                          */}
        {/* ------------------------------------------------------------------ */}
        {viewState === 'GPS_PROMPT' && (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{
              width: '64px',
              height: '64px',
              background: '#F0FDF4',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: '#16A34A'
            }}>
              <MapPin size={32} />
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0F172A', marginBottom: '8px' }}>
              Confirm your table presence
            </h3>
            <p style={{ fontSize: '0.86rem', color: '#64748B', lineHeight: 1.5, marginBottom: '20px' }}>
              To ensure orders are delivered to the correct seat, please confirm you are dining at <strong>{currentLabel}</strong>.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {isGpsAllowed && (
                <button
                  onClick={handleAcquireGps}
                  style={{
                    width: '100%',
                    padding: '14px',
                    background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '14px',
                    fontWeight: 800,
                    fontSize: '0.94rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 6px 16px rgba(5, 150, 105, 0.35)'
                  }}
                >
                  <Navigation size={18} />
                  <span>Verify Location & Order</span>
                </button>
              )}

              {isStaffAllowed && (
                <button
                  onClick={handleRequestStaff}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#F8FAFC',
                    color: '#334155',
                    border: '1.5px solid #E2E8F0',
                    borderRadius: '14px',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <UserCheck size={18} color="#64748B" />
                  <span>Ask Staff / Waiter to Verify</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* VIEW 2: GPS ACQUIRING (LOADING)                                    */}
        {/* ------------------------------------------------------------------ */}
        {viewState === 'GPS_ACQUIRING' && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{
              width: '72px',
              height: '72px',
              background: '#EFF6FF',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 18px',
              color: '#2563EB',
              animation: 'pulse 1.8s infinite'
            }}>
              <Compass size={36} style={{ animation: 'spin 4s linear infinite' }} />
            </div>
            <h3 style={{ fontSize: '1.12rem', fontWeight: 800, color: '#0F172A', marginBottom: '8px' }}>
              Acquiring GPS location...
            </h3>
            <p style={{ fontSize: '0.84rem', color: '#64748B', lineHeight: 1.5, marginBottom: '18px' }}>
              Connecting to satellites to confirm dining presence at <strong>{currentLabel}</strong>.
            </p>
            <div style={{
              background: '#F8FAFC',
              borderRadius: '12px',
              padding: '10px 14px',
              border: '1px solid #E2E8F0',
              fontSize: '0.78rem',
              color: '#475569',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}>
              <Radio size={15} color="#2563EB" />
              <span>Verifying high-precision geofence...</span>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* VIEW 3: GPS FAILED / OUTSIDE BOUNDARY                              */}
        {/* ------------------------------------------------------------------ */}
        {viewState === 'GPS_FAILED' && (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{
              width: '64px',
              height: '64px',
              background: '#FEF2F2',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: '#DC2626'
            }}>
              <AlertCircle size={32} />
            </div>
            <h3 style={{ fontSize: '1.12rem', fontWeight: 800, color: '#0F172A', marginBottom: '8px' }}>
              Location Verification Required
            </h3>
            <p style={{ fontSize: '0.84rem', color: '#64748B', lineHeight: 1.5, marginBottom: '16px' }}>
              {errorMessage || 'Unable to verify dining presence via device GPS.'}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {isGpsAllowed && (
                <button
                  onClick={handleAcquireGps}
                  style={{
                    width: '100%',
                    padding: '13px',
                    background: '#10B981',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '14px',
                    fontWeight: 800,
                    fontSize: '0.92rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <RotateCcw size={17} />
                  <span>Retry Location GPS</span>
                </button>
              )}

              {isStaffAllowed && (
                <button
                  onClick={handleRequestStaff}
                  style={{
                    width: '100%',
                    padding: '13px',
                    background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '14px',
                    fontWeight: 800,
                    fontSize: '0.92rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 6px 16px rgba(37, 99, 235, 0.35)'
                  }}
                >
                  <UserCheck size={18} />
                  <span>Ask Staff / Waiter to Verify</span>
                </button>
              )}

              <button
                onClick={handleCancelAndClose}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'transparent',
                  color: '#94A3B8',
                  border: 'none',
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Back to Menu
              </button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* VIEW 4: STAFF REQUESTING (LOADING)                                 */}
        {/* ------------------------------------------------------------------ */}
        {viewState === 'STAFF_REQUESTING' && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{
              width: '72px',
              height: '72px',
              background: '#F0FDF4',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 18px',
              color: '#059669',
              animation: 'pulse 1.8s infinite'
            }}>
              <UserCheck size={36} />
            </div>
            <h3 style={{ fontSize: '1.12rem', fontWeight: 800, color: '#0F172A', marginBottom: '8px' }}>
              Contacting restaurant staff...
            </h3>
            <p style={{ fontSize: '0.84rem', color: '#64748B', lineHeight: 1.5 }}>
              Sending verification request for <strong>{currentLabel}</strong>.
            </p>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* VIEW 5: STAFF WAITING (POLLING WITH COUNTDOWN)                     */}
        {/* ------------------------------------------------------------------ */}
        {viewState === 'STAFF_WAITING' && (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{
              width: '70px',
              height: '70px',
              background: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: '#059669',
              boxShadow: '0 8px 24px rgba(5, 150, 105, 0.2)'
            }}>
              <Clock size={34} style={{ animation: 'spin 12s linear infinite' }} />
            </div>
            <h3 style={{ fontSize: '1.14rem', fontWeight: 800, color: '#0F172A', marginBottom: '6px' }}>
              Verification Sent to Staff
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.5, marginBottom: '14px' }}>
              Please ask any waiter or staff member to confirm your presence at <strong>{currentLabel}</strong>.
            </p>

            {/* Countdown timer badge */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: '#F1F5F9',
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '0.82rem',
              fontWeight: 800,
              color: staffExpirySeconds < 30 ? '#DC2626' : '#0F172A',
              marginBottom: '18px'
            }}>
              <Clock size={14} color={staffExpirySeconds < 30 ? '#DC2626' : '#64748B'} />
              <span>Waiting for approval ({formatCountdown(staffExpirySeconds)})</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {isGpsAllowed && (
                <button
                  onClick={handleAcquireGps}
                  style={{
                    width: '100%',
                    padding: '11px',
                    background: '#F8FAFC',
                    color: '#334155',
                    border: '1.5px solid #CBD5E1',
                    borderRadius: '12px',
                    fontWeight: 700,
                    fontSize: '0.86rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <Navigation size={15} color="#64748B" />
                  <span>Switch to GPS Verification</span>
                </button>
              )}

              <button
                onClick={handleCancelAndClose}
                style={{
                  width: '100%',
                  padding: '9px',
                  background: 'transparent',
                  color: '#94A3B8',
                  border: 'none',
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Cancel Request
              </button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* VIEW 6: STAFF REJECTED                                             */}
        {/* ------------------------------------------------------------------ */}
        {viewState === 'STAFF_REJECTED' && (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{
              width: '64px',
              height: '64px',
              background: '#FEF2F2',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: '#DC2626'
            }}>
              <XCircle size={32} />
            </div>
            <h3 style={{ fontSize: '1.12rem', fontWeight: 800, color: '#0F172A', marginBottom: '8px' }}>
              Verification Not Approved
            </h3>
            <p style={{ fontSize: '0.84rem', color: '#64748B', lineHeight: 1.5, marginBottom: '18px' }}>
              {rejectionReason || 'The staff could not confirm presence for this table request.'}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {isStaffAllowed && (
                <button
                  onClick={handleRequestStaff}
                  style={{
                    width: '100%',
                    padding: '13px',
                    background: '#2563EB',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '14px',
                    fontWeight: 800,
                    fontSize: '0.92rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <UserCheck size={18} />
                  <span>Request Staff Again</span>
                </button>
              )}

              {isGpsAllowed && (
                <button
                  onClick={handleAcquireGps}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#F8FAFC',
                    color: '#334155',
                    border: '1.5px solid #E2E8F0',
                    borderRadius: '14px',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <Navigation size={16} />
                  <span>Verify with GPS</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* VIEW 7: STAFF EXPIRED                                              */}
        {/* ------------------------------------------------------------------ */}
        {viewState === 'STAFF_EXPIRED' && (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{
              width: '64px',
              height: '64px',
              background: '#FFFBEB',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: '#D97706'
            }}>
              <Clock size={32} />
            </div>
            <h3 style={{ fontSize: '1.12rem', fontWeight: 800, color: '#0F172A', marginBottom: '8px' }}>
              Request Expired
            </h3>
            <p style={{ fontSize: '0.84rem', color: '#64748B', lineHeight: 1.5, marginBottom: '18px' }}>
              The verification request timed out. Please ask staff again or verify via GPS.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {isStaffAllowed && (
                <button
                  onClick={handleRequestStaff}
                  style={{
                    width: '100%',
                    padding: '13px',
                    background: '#10B981',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '14px',
                    fontWeight: 800,
                    fontSize: '0.92rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <UserCheck size={18} />
                  <span>Send New Staff Request</span>
                </button>
              )}
              {isGpsAllowed && (
                <button
                  onClick={handleAcquireGps}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#F8FAFC',
                    color: '#334155',
                    border: '1.5px solid #E2E8F0',
                    borderRadius: '14px',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <Navigation size={16} />
                  <span>Verify with GPS</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* VIEW 8: VERIFIED (SUCCESS)                                         */}
        {/* ------------------------------------------------------------------ */}
        {viewState === 'VERIFIED' && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{
              width: '72px',
              height: '72px',
              background: '#ECFDF5',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: '#059669',
              animation: 'bounce 0.5s ease-out'
            }}>
              <CheckCircle2 size={40} />
            </div>
            <h3 style={{ fontSize: '1.18rem', fontWeight: 900, color: '#0F172A', marginBottom: '6px' }}>
              Presence Confirmed!
            </h3>
            <p style={{ fontSize: '0.86rem', color: '#059669', fontWeight: 700, marginBottom: '14px' }}>
              ✓ Authorized at {currentLabel}
            </p>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: '#F8FAFC',
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '0.78rem',
              color: '#64748B'
            }}>
              <Sparkles size={14} color="#EAB308" />
              <span>Placing your table order now...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
