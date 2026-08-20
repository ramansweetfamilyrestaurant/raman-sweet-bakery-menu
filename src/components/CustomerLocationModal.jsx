import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin,
  Navigation,
  ShieldCheck,
  AlertCircle,
  RotateCcw,
  Lock,
  Radio,
  CheckCircle2,
  X,
  Compass,
  Smartphone,
  Info
} from 'lucide-react';
import { verifyCustomerLocationApi } from '../api/client';

export default function CustomerLocationModal({
  isOpen,
  onClose,
  restaurantInfo,
  tableNumber,
  tableToken,
  tableLabel,
  onLocationVerified,
  allowDismiss = true
}) {
  // State Machine:
  // 'idle' | 'requesting_location' | 'verifying_with_server' | 'verified' |
  // 'outside_boundary' | 'permission_denied' | 'permission_permanently_blocked' |
  // 'location_services_off' | 'location_timeout' | 'low_accuracy' | 'error'
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [distanceInfo, setDistanceInfo] = useState(null);
  const [accuracyVal, setAccuracyVal] = useState(null);
  const isAcquiringRef = useRef(false);

  useEffect(() => {
    if (isOpen && status !== 'verified') {
      // Check initial permissions state silently to optimize first button tap
      if (navigator.permissions && navigator.permissions.query) {
        navigator.permissions.query({ name: 'geolocation' })
          .then(perm => {
            if (perm.state === 'denied' && status === 'idle') {
              setStatus('permission_permanently_blocked');
            }
          })
          .catch(() => {});
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRequestLocation = () => {
    if (isAcquiringRef.current) return; // Prevent duplicate rapid taps
    isAcquiringRef.current = true;

    if (!navigator.geolocation) {
      isAcquiringRef.current = false;
      setStatus('error');
      setErrorMsg('Your mobile browser does not support GPS location. Please use a modern browser (Chrome or Safari).');
      return;
    }

    setStatus('requesting_location');
    setErrorMsg('');

    const primaryOptions = {
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 60000
    };

    const fallbackOptions = {
      enableHighAccuracy: false,
      timeout: 8000,
      maximumAge: 120000
    };

    const processPosition = async (pos) => {
      try {
        setStatus('verifying_with_server');
        const custLat = pos.coords.latitude;
        const custLng = pos.coords.longitude;
        const custAcc = Math.round(pos.coords.accuracy || 999);
        setAccuracyVal(custAcc);

        const slug = restaurantInfo?.slug || '';
        const verifyRes = await verifyCustomerLocationApi({
          slug,
          table_number: tableNumber || '1',
          table_token: tableToken || '',
          latitude: custLat,
          longitude: custLng,
          accuracy: custAcc
        });

        if (verifyRes.verified) {
          setDistanceInfo({
            distance: verifyRes.distance_meters,
            radius: verifyRes.allowed_radius
          });
          setStatus('verified');

          const verifiedPayload = {
            verificationToken: verifyRes.verification_token,
            locationToken: verifyRes.location_token,
            customerLat: custLat,
            customerLng: custLng,
            accuracy: custAcc,
            distanceMeters: verifyRes.distance_meters,
            timestamp: Date.now()
          };

          if (onLocationVerified) {
            onLocationVerified(verifiedPayload);
          }

          setTimeout(() => {
            isAcquiringRef.current = false;
            if (onClose) onClose();
          }, 1200);
        } else {
          isAcquiringRef.current = false;
          setDistanceInfo({
            distance: verifyRes.distance_meters,
            radius: verifyRes.allowed_radius
          });
          setStatus('outside_boundary');
          setErrorMsg(verifyRes.message || 'You appear to be outside the restaurant ordering area.');
        }
      } catch (apiErr) {
        isAcquiringRef.current = false;
        const errMsg = String(apiErr.message || '');
        if (errMsg.toLowerCase().includes('accuracy') || apiErr.error === 'low_accuracy') {
          setStatus('low_accuracy');
          setErrorMsg(errMsg || 'GPS signal accuracy is too weak.');
        } else if (errMsg.toLowerCase().includes('outside') || apiErr.status === 403 || apiErr.error === 'outside_boundary') {
          setStatus('outside_boundary');
          setErrorMsg(errMsg || 'You appear to be outside the restaurant dining area.');
        } else {
          setStatus('error');
          setErrorMsg(errMsg || 'Location verification failed. Please try again.');
        }
      }
    };

    const handleGpsFailure = (err) => {
      isAcquiringRef.current = false;
      console.warn('Geolocation Error:', err);

      if (err.code === 1) {
        // PERMISSION_DENIED
        // Check permissions API asynchronously if available to distinguish permanent lock
        if (navigator.permissions && navigator.permissions.query) {
          navigator.permissions.query({ name: 'geolocation' })
            .then(p => {
              if (p.state === 'denied') {
                setStatus('permission_permanently_blocked');
              } else {
                setStatus('permission_denied');
              }
            })
            .catch(() => {
              setStatus('permission_denied');
            });
        } else {
          setStatus('permission_denied');
        }
      } else if (err.code === 2) {
        // POSITION_UNAVAILABLE (Device Location Services / GPS toggled off or unavailable)
        setStatus('location_services_off');
        setErrorMsg("Couldn't get your current location. Please make sure Location Services are turned on, then try again.");
      } else if (err.code === 3) {
        // TIMEOUT
        setStatus('location_timeout');
        setErrorMsg('Getting your location is taking longer than expected. Please check your connection and Location Services, then try again.');
      } else {
        setStatus('error');
        setErrorMsg("Couldn't get your current location. Please make sure Location Services are turned on, then try again.");
      }
    };

    // Synchronous primary High Accuracy Geolocation invocation directly in user gesture path
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        processPosition(pos);
      },
      (err) => {
        // If high-accuracy timed out, attempt one network-based fallback before failing
        if (err.code === 3) {
          navigator.geolocation.getCurrentPosition(
            (fallbackPos) => {
              processPosition(fallbackPos);
            },
            (fallbackErr) => {
              handleGpsFailure(fallbackErr);
            },
            fallbackOptions
          );
        } else {
          handleGpsFailure(err);
        }
      },
      primaryOptions
    );
  };

  const isBusy = status === 'requesting_location' || status === 'verifying_with_server';

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      background: 'rgba(15, 23, 42, 0.78)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <div style={{
        background: '#FFFFFF',
        width: '100%',
        maxWidth: '430px',
        borderRadius: '24px',
        padding: '26px 22px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.28)',
        border: '1px solid #E2E8F0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        position: 'relative',
        boxSizing: 'border-box'
      }}>
        {/* Optional Dismiss / Browse Menu Button */}
        {allowDismiss && !isBusy && status !== 'verified' && (
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: '#F1F5F9',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#64748B'
            }}
          >
            <X size={16} />
          </button>
        )}

        {/* ---------------------------------------------------- */}
        {/* STATE 1: IDLE / INITIAL PROMPT */}
        {/* ---------------------------------------------------- */}
        {status === 'idle' && (
          <>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '20px',
              background: '#DCFCE7',
              color: '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.15)'
            }}>
              <MapPin size={32} />
            </div>

            <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0F172A', margin: '0 0 6px 0' }}>
              Verify your location
            </h3>

            {tableLabel && (
              <span style={{
                fontSize: '0.78rem',
                fontWeight: 800,
                color: '#047857',
                background: '#ECFDF5',
                padding: '4px 12px',
                borderRadius: '12px',
                marginBottom: '12px',
                display: 'inline-block',
                border: '1px solid #A7F3D0'
              }}>
                {tableLabel}
              </span>
            )}

            <p style={{ fontSize: '0.86rem', color: '#64748B', lineHeight: 1.5, margin: '0 0 20px 0' }}>
              To place an order from this table, we need to verify that you are currently inside the restaurant.
            </p>

            <button
              onClick={handleRequestLocation}
              disabled={isBusy}
              style={{
                width: '100%',
                padding: '14px 20px',
                borderRadius: '14px',
                border: 'none',
                background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
                color: '#FFFFFF',
                fontWeight: 900,
                fontSize: '0.94rem',
                cursor: isBusy ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 6px 20px rgba(5, 150, 105, 0.35)'
              }}
            >
              <Navigation size={18} />
              Enable Location & Continue
            </button>

            {allowDismiss && (
              <button
                onClick={onClose}
                style={{
                  marginTop: '12px',
                  background: 'none',
                  border: 'none',
                  color: '#64748B',
                  fontSize: '0.80rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: '6px'
                }}
              >
                Browse Menu First
              </button>
            )}
          </>
        )}

        {/* ---------------------------------------------------- */}
        {/* STATE 2: REQUESTING LOCATION / VERIFYING */}
        {/* ---------------------------------------------------- */}
        {isBusy && (
          <>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '20px',
              background: '#E0F2FE',
              color: '#0284C7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px'
            }}>
              <Compass size={32} className="animate-spin" />
            </div>

            <h3 style={{ fontSize: '1.20rem', fontWeight: 900, color: '#0F172A', margin: '0 0 8px 0' }}>
              {status === 'requesting_location' ? 'Acquiring GPS location...' : 'Verifying with restaurant...'}
            </h3>

            <p style={{ fontSize: '0.84rem', color: '#64748B', lineHeight: 1.5, margin: '0 0 18px 0' }}>
              {status === 'requesting_location'
                ? 'Please tap "Allow" if your browser displays a permission prompt.'
                : 'Validating dining table boundary with server...'}
            </p>

            <div style={{
              width: '100%',
              padding: '12px',
              borderRadius: '12px',
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              fontSize: '0.80rem',
              color: '#0284C7',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}>
              <Radio size={14} className="animate-pulse" />
              <span>Checking Satellite & Network Signals...</span>
            </div>
          </>
        )}

        {/* ---------------------------------------------------- */}
        {/* STATE 3: VERIFIED SUCCESS */}
        {/* ---------------------------------------------------- */}
        {status === 'verified' && (
          <>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '20px',
              background: '#DCFCE7',
              color: '#15803D',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px'
            }}>
              <CheckCircle2 size={36} />
            </div>

            <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#15803D', margin: '0 0 8px 0' }}>
              Location Verified!
            </h3>

            <p style={{ fontSize: '0.84rem', color: '#475569', lineHeight: 1.5, margin: 0 }}>
              You are inside the dining area. Table ordering is now enabled.
            </p>
          </>
        )}

        {/* ---------------------------------------------------- */}
        {/* STATE 4: OUTSIDE BOUNDARY */}
        {/* ---------------------------------------------------- */}
        {status === 'outside_boundary' && (
          <>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '20px',
              background: '#FEF2F2',
              color: '#DC2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px'
            }}>
              <AlertCircle size={32} />
            </div>

            <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: '#991B1B', margin: '0 0 8px 0' }}>
              You appear to be outside the restaurant's ordering area.
            </h3>

            <p style={{ fontSize: '0.82rem', color: '#64748B', lineHeight: 1.5, margin: '0 0 16px 0' }}>
              {errorMsg || 'Table orders can only be placed while physically seated inside the dining area.'}
            </p>

            <button
              onClick={handleRequestLocation}
              disabled={isBusy}
              style={{
                width: '100%',
                padding: '13px 20px',
                borderRadius: '14px',
                border: 'none',
                background: '#0F172A',
                color: '#FFFFFF',
                fontWeight: 900,
                fontSize: '0.90rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <RotateCcw size={16} />
              Try Again
            </button>
          </>
        )}

        {/* ---------------------------------------------------- */}
        {/* STATE 5: DEVICE LOCATION / GPS SERVICES ARE OFF */}
        {/* ---------------------------------------------------- */}
        {status === 'location_services_off' && (
          <>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '20px',
              background: '#FEF2F2',
              color: '#DC2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px'
            }}>
              <Smartphone size={32} />
            </div>

            <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0F172A', margin: '0 0 6px 0' }}>
              Check Location Services
            </h3>

            <p style={{ fontSize: '0.84rem', color: '#475569', lineHeight: 1.5, margin: '0 0 14px 0' }}>
              {errorMsg || "Couldn't get your current location. Please make sure Location Services are turned on, then try again."}
            </p>

            <div style={{
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: '14px',
              padding: '12px 14px',
              fontSize: '0.78rem',
              color: '#334155',
              lineHeight: 1.5,
              textAlign: 'left',
              marginBottom: '16px',
              width: '100%',
              boxSizing: 'border-box'
            }}>
              <strong style={{ display: 'block', color: '#0F172A', marginBottom: '4px' }}>📱 How to turn on:</strong>
              • <strong>Android:</strong> Swipe down notification bar from the top of your screen and tap the <strong>Location / GPS</strong> tile.<br />
              • <strong>iPhone:</strong> Open <strong>Settings ➔ Privacy & Security ➔ Location Services</strong> and toggle <strong>ON</strong>.
            </div>

            <button
              onClick={handleRequestLocation}
              disabled={isBusy}
              style={{
                width: '100%',
                padding: '13px 20px',
                borderRadius: '14px',
                border: 'none',
                background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
                color: '#FFFFFF',
                fontWeight: 900,
                fontSize: '0.90rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(5, 150, 105, 0.3)'
              }}
            >
              <RotateCcw size={16} />
              Try Again
            </button>
          </>
        )}

        {/* ---------------------------------------------------- */}
        {/* STATE 6: PERMISSION DENIED (TEMPORARY / PROMPT) */}
        {/* ---------------------------------------------------- */}
        {status === 'permission_denied' && (
          <>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '20px',
              background: '#FEF3C7',
              color: '#D97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px'
            }}>
              <Lock size={32} />
            </div>

            <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0F172A', margin: '0 0 8px 0' }}>
              Location permission is required for table ordering
            </h3>

            <p style={{ fontSize: '0.84rem', color: '#64748B', lineHeight: 1.5, margin: '0 0 16px 0' }}>
              To place an order from this table, please grant location access when prompted by your browser.
            </p>

            <button
              onClick={handleRequestLocation}
              disabled={isBusy}
              style={{
                width: '100%',
                padding: '13px 20px',
                borderRadius: '14px',
                border: 'none',
                background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
                color: '#FFFFFF',
                fontWeight: 900,
                fontSize: '0.90rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <Navigation size={16} />
              Enable Location & Continue
            </button>
          </>
        )}

        {/* ---------------------------------------------------- */}
        {/* STATE 7: PERMISSION PERMANENTLY BLOCKED */}
        {/* ---------------------------------------------------- */}
        {status === 'permission_permanently_blocked' && (
          <>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '20px',
              background: '#FEF3C7',
              color: '#D97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px'
            }}>
              <Lock size={32} />
            </div>

            <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0F172A', margin: '0 0 8px 0' }}>
              Location permission is blocked
            </h3>

            <div style={{
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: '14px',
              padding: '12px 14px',
              fontSize: '0.78rem',
              color: '#334155',
              lineHeight: 1.5,
              textAlign: 'left',
              marginBottom: '16px',
              width: '100%',
              boxSizing: 'border-box'
            }}>
              <strong style={{ display: 'block', color: '#0F172A', marginBottom: '4px' }}>🔒 How to unblock in browser:</strong>
              1. Tap the 🔒 <strong>Lock</strong> or ⓘ icon in your browser address bar (top).<br />
              2. Tap <strong>Permissions ➔ Location</strong> and select <strong>Allow</strong>.<br />
              3. Tap <strong>Try Again</strong> below.
            </div>

            <button
              onClick={handleRequestLocation}
              disabled={isBusy}
              style={{
                width: '100%',
                padding: '13px 20px',
                borderRadius: '14px',
                border: 'none',
                background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
                color: '#FFFFFF',
                fontWeight: 900,
                fontSize: '0.90rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <RotateCcw size={16} />
              Try Again
            </button>
          </>
        )}

        {/* ---------------------------------------------------- */}
        {/* STATE 8: GPS TIMEOUT */}
        {/* ---------------------------------------------------- */}
        {status === 'location_timeout' && (
          <>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '20px',
              background: '#FEF2F2',
              color: '#DC2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px'
            }}>
              <AlertCircle size={32} />
            </div>

            <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0F172A', margin: '0 0 8px 0' }}>
              Location verification timed out
            </h3>

            <p style={{ fontSize: '0.82rem', color: '#64748B', lineHeight: 1.5, margin: '0 0 16px 0' }}>
              Getting your location is taking longer than expected. Please check your connection and Location Services, then try again.
            </p>

            <button
              onClick={handleRequestLocation}
              disabled={isBusy}
              style={{
                width: '100%',
                padding: '13px 20px',
                borderRadius: '14px',
                border: 'none',
                background: '#0F172A',
                color: '#FFFFFF',
                fontWeight: 900,
                fontSize: '0.90rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <RotateCcw size={16} />
              Try Again
            </button>
          </>
        )}

        {/* ---------------------------------------------------- */}
        {/* STATE 9: LOW ACCURACY */}
        {/* ---------------------------------------------------- */}
        {status === 'low_accuracy' && (
          <>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '20px',
              background: '#FEF3C7',
              color: '#D97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px'
            }}>
              <Compass size={32} />
            </div>

            <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0F172A', margin: '0 0 8px 0' }}>
              Low GPS Accuracy
            </h3>

            <p style={{ fontSize: '0.82rem', color: '#64748B', lineHeight: 1.5, margin: '0 0 16px 0' }}>
              {errorMsg || `GPS signal accuracy is too weak${accuracyVal ? ` (±${accuracyVal}m)` : ''}. Please move closer to a window or ensure High Accuracy Location is enabled.`}
            </p>

            <button
              onClick={handleRequestLocation}
              disabled={isBusy}
              style={{
                width: '100%',
                padding: '13px 20px',
                borderRadius: '14px',
                border: 'none',
                background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
                color: '#FFFFFF',
                fontWeight: 900,
                fontSize: '0.90rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <RotateCcw size={16} />
              Try Again
            </button>
          </>
        )}

        {/* ---------------------------------------------------- */}
        {/* STATE 10: GENERIC FALLBACK ERROR */}
        {/* ---------------------------------------------------- */}
        {status === 'error' && (
          <>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '20px',
              background: '#FEF2F2',
              color: '#DC2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px'
            }}>
              <AlertCircle size={32} />
            </div>

            <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0F172A', margin: '0 0 8px 0' }}>
              Location Verification Error
            </h3>

            <p style={{ fontSize: '0.82rem', color: '#64748B', lineHeight: 1.5, margin: '0 0 16px 0' }}>
              {errorMsg || "We couldn't get your current location. Please make sure Location Services are turned on and try again."}
            </p>

            <button
              onClick={handleRequestLocation}
              disabled={isBusy}
              style={{
                width: '100%',
                padding: '13px 20px',
                borderRadius: '14px',
                border: 'none',
                background: '#0F172A',
                color: '#FFFFFF',
                fontWeight: 900,
                fontSize: '0.90rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <RotateCcw size={16} />
              Try Again
            </button>
          </>
        )}
      </div>
    </div>
  );
}
