import React, { useState } from 'react';
import { MapPin, Navigation, ShieldCheck, AlertCircle, RotateCcw, Lock, Radio, CheckCircle2, X } from 'lucide-react';
import { verifyCustomerLocationApi } from '../api/client';

export default function LocationVerificationModal({
  isOpen,
  onClose,
  restaurantInfo,
  tableNumber,
  tableToken,
  tableLabel,
  onLocationVerified,
  allowDismiss = true
}) {
  const [status, setStatus] = useState('idle'); // 'idle' | 'verifying' | 'success' | 'outside_boundary' | 'permission_denied' | 'location_off' | 'timeout' | 'error'
  const [errorMsg, setErrorMsg] = useState('');
  const [distanceInfo, setDistanceInfo] = useState(null);

  if (!isOpen) return null;

  const handleRequestLocation = () => {
    if (status === 'verifying') return; // Guard against double-tap

    if (!navigator.geolocation) {
      setStatus('error');
      setErrorMsg('Your mobile browser does not support GPS location. Please use Chrome or Safari.');
      return;
    }

    setStatus('verifying');
    setErrorMsg('');

    // High accuracy GPS request with fallback
    const primaryOptions = {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0
    };

    const fallbackOptions = {
      enableHighAccuracy: false,
      timeout: 15000,
      maximumAge: 30000
    };

    const processPosition = async (pos) => {
      try {
        const custLat = pos.coords.latitude;
        const custLng = pos.coords.longitude;
        const custAcc = Math.round(pos.coords.accuracy || 999);

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
          setStatus('success');

          const verifiedPayload = {
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

          // Auto-close success modal after 1.2s
          setTimeout(() => {
            if (onClose) onClose();
          }, 1200);
        } else {
          setDistanceInfo({
            distance: verifyRes.distance_meters,
            radius: verifyRes.allowed_radius
          });
          setStatus('outside_boundary');
          setErrorMsg(verifyRes.message || 'You appear to be outside the restaurant ordering boundary.');
        }
      } catch (apiErr) {
        const errMsg = String(apiErr.message || '');
        if (errMsg.toLowerCase().includes('outside') || apiErr.status === 403) {
          setStatus('outside_boundary');
          setErrorMsg(errMsg || 'You appear to be outside the restaurant dining area.');
        } else {
          setStatus('error');
          setErrorMsg(errMsg || 'Location verification failed. Please try again.');
        }
      }
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        processPosition(pos);
      },
      (err) => {
        console.warn('Primary GPS attempt error:', err);

        if (err.code === 1) {
          // PERMISSION_DENIED
          setStatus('permission_denied');
          setErrorMsg('Location permission is required to verify you are currently at this dining table.');
          return;
        }

        // If high accuracy timed out (code 3) or position unavailable (code 2), attempt fallback network positioning
        navigator.geolocation.getCurrentPosition(
          (fallbackPos) => {
            processPosition(fallbackPos);
          },
          (fallbackErr) => {
            if (fallbackErr.code === 1) {
              setStatus('permission_denied');
              setErrorMsg('Location permission is required to verify you are currently at this dining table.');
            } else if (fallbackErr.code === 2) {
              setStatus('location_off');
              setErrorMsg('Device location is turned OFF. Please enable Location/GPS in your phone settings.');
            } else if (fallbackErr.code === 3) {
              setStatus('timeout');
              setErrorMsg('GPS verification timed out. Please check your signal and tap Try Again.');
            } else {
              setStatus('error');
              setErrorMsg('Unable to acquire GPS signal. Please ensure location is enabled.');
            }
          },
          fallbackOptions
        );
      },
      primaryOptions
    );
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(8px)',
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <div style={{
        background: '#FFFFFF',
        width: '100%',
        maxWidth: '420px',
        borderRadius: '24px',
        padding: '24px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: '1px solid #E2E8F0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        position: 'relative'
      }}>
        {/* Optional Close / Browse Menu Button */}
        {allowDismiss && status !== 'verifying' && status !== 'success' && (
          <button
            onClick={onClose}
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

        {/* State 1: Idle / Initial Prompt */}
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
              style={{
                width: '100%',
                padding: '14px 20px',
                borderRadius: '14px',
                border: 'none',
                background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
                color: '#FFFFFF',
                fontWeight: 900,
                fontSize: '0.94rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 6px 20px rgba(5, 150, 105, 0.35)',
                transition: 'transform 0.1s ease'
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

        {/* State 2: Verifying in Progress */}
        {status === 'verifying' && (
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
              marginBottom: '16px',
              animation: 'pulse 1.5s infinite'
            }}>
              <Radio size={32} className="animate-spin" />
            </div>

            <h3 style={{ fontSize: '1.20rem', fontWeight: 900, color: '#0F172A', margin: '0 0 8px 0' }}>
              Verifying your location...
            </h3>

            <p style={{ fontSize: '0.84rem', color: '#64748B', lineHeight: 1.5, margin: '0 0 20px 0' }}>
              Acquiring GPS signal & verifying table boundary. Please tap "Allow" if prompted by your browser.
            </p>

            <div style={{
              width: '100%',
              padding: '12px',
              borderRadius: '12px',
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              fontSize: '0.80rem',
              color: '#0284C7',
              fontWeight: 800
            }}>
              📡 Contacting Satellites...
            </div>
          </>
        )}

        {/* State 3: Success Verified */}
        {status === 'success' && (
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

        {/* State 4: Outside Ordering Boundary */}
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
              {errorMsg || 'Table orders must be placed while physically present inside the dining area.'}
            </p>

            <button
              onClick={handleRequestLocation}
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

        {/* State 5: Permission Denied */}
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
              Location permission is required for table ordering.
            </h3>

            <div style={{
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: '12px',
              padding: '12px 14px',
              fontSize: '0.78rem',
              color: '#334155',
              lineHeight: 1.5,
              textAlign: 'left',
              marginBottom: '16px',
              width: '100%',
              boxSizing: 'border-box'
            }}>
              <strong style={{ display: 'block', color: '#0F172A', marginBottom: '4px' }}>How to enable:</strong>
              1. Tap the 🔒 <strong>Lock</strong> or ⓘ icon in your browser address bar.<br />
              2. Tap <strong>Permissions ➔ Location</strong> and select <strong>Allow</strong>.<br />
              3. Tap <strong>Try Again</strong> below.
            </div>

            <button
              onClick={handleRequestLocation}
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

        {/* State 6: Location Services Turned OFF */}
        {status === 'location_off' && (
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
              <Radio size={32} />
            </div>

            <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0F172A', margin: '0 0 8px 0' }}>
              Device Location is Turned OFF
            </h3>

            <p style={{ fontSize: '0.82rem', color: '#64748B', lineHeight: 1.5, margin: '0 0 16px 0' }}>
              Please turn ON Location / GPS from your phone's notification panel or settings, then tap Try Again.
            </p>

            <button
              onClick={handleRequestLocation}
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

        {/* State 7: Timeout or Generic Error */}
        {(status === 'timeout' || status === 'error') && (
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
              {status === 'timeout' ? 'GPS Signal Timeout' : 'Location Verification Error'}
            </h3>

            <p style={{ fontSize: '0.82rem', color: '#64748B', lineHeight: 1.5, margin: '0 0 16px 0' }}>
              {errorMsg || 'Unable to get accurate GPS reading. Please check your signal and try again.'}
            </p>

            <button
              onClick={handleRequestLocation}
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
