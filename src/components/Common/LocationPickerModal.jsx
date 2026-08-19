import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, Search, Check, X, Compass, ExternalLink, Loader2, AlertTriangle, CheckCircle2, Sliders } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icon assets in Leaflet with bundlers (Vite/Webpack)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom Gold / Emerald Restaurant Marker
const restaurantIcon = L.divIcon({
  className: 'custom-resto-marker',
  html: `<div style="
    background: linear-gradient(135deg, #DFBA67 0%, #C89F43 100%);
    width: 36px; height: 36px;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 14px rgba(0,0,0,0.45);
    border: 2.5px solid #FFFFFF;
  ">
    <span style="transform: rotate(45deg); font-size: 16px;">🍴</span>
  </div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -36]
});

export default function LocationPickerModal({
  isOpen,
  onClose,
  initialLat = 26.6500,
  initialLng = 86.5800,
  initialRadius = 500,
  initialAddress = '',
  onSave
}) {
  const [lat, setLat] = useState(Number(initialLat) || 26.6500);
  const [lng, setLng] = useState(Number(initialLng) || 86.5800);
  const [radiusMeters, setRadiusMeters] = useState(Number(initialRadius) || 500);
  const [accuracyMeters, setAccuracyMeters] = useState(null);
  const [acquisitionState, setAcquisitionState] = useState('idle'); // 'idle' | 'detecting' | 'improving' | 'success' | 'warning' | 'error'
  const [statusMsg, setStatusMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState(initialAddress || '');
  const [searching, setSearching] = useState(false);
  const [isManualAdjusted, setIsManualAdjusted] = useState(false);

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);

  // Initialize and update Leaflet Map
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [lat, lng],
        zoom: 16,
        zoomControl: true
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      // Marker
      const marker = L.marker([lat, lng], {
        draggable: true,
        icon: restaurantIcon
      }).addTo(map);

      // Circle Radius
      const circle = L.circle([lat, lng], {
        radius: radiusMeters,
        color: '#DFBA67',
        fillColor: '#DFBA67',
        fillOpacity: 0.15,
        weight: 2
      }).addTo(map);

      marker.on('dragend', (e) => {
        const newPos = e.target.getLatLng();
        const nLat = parseFloat(newPos.lat.toFixed(6));
        const nLng = parseFloat(newPos.lng.toFixed(6));
        setLat(nLat);
        setLng(nLng);
        circle.setLatLng(newPos);
        setIsManualAdjusted(true);
        setAcquisitionState('success');
        setAccuracyMeters(1); // Exact manual placement
        setStatusMsg(`📍 Manually adjusted pin to: ${nLat}, ${nLng}`);
      });

      map.on('click', (e) => {
        const nLat = parseFloat(e.latlng.lat.toFixed(6));
        const nLng = parseFloat(e.latlng.lng.toFixed(6));
        setLat(nLat);
        setLng(nLng);
        marker.setLatLng(e.latlng);
        circle.setLatLng(e.latlng);
        setIsManualAdjusted(true);
        setAcquisitionState('success');
        setAccuracyMeters(1);
        setStatusMsg(`📍 Placed pin at: ${nLat}, ${nLng}`);
      });

      mapInstanceRef.current = map;
      markerRef.current = marker;
      circleRef.current = circle;
    } else {
      mapInstanceRef.current.setView([lat, lng], 16);
      if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
      if (circleRef.current) {
        circleRef.current.setLatLng([lat, lng]);
        circleRef.current.setRadius(radiusMeters);
      }
    }

    // Force map container layout recalculation after modal renders
    const timer = setTimeout(() => {
      if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
    }, 250);

    return () => clearTimeout(timer);
  }, [isOpen, lat, lng, radiusMeters]);

  // Update Map elements when lat/lng change programmatically
  const updateMapPosition = (newLat, newLng) => {
    setLat(newLat);
    setLng(newLng);
    if (mapInstanceRef.current && markerRef.current && circleRef.current) {
      const latLng = [newLat, newLng];
      markerRef.current.setLatLng(latLng);
      circleRef.current.setLatLng(latLng);
      mapInstanceRef.current.flyTo(latLng, 17, { animate: true, duration: 1 });
    }
  };

  // High-Precision Multi-Sample GPS Acquisition
  const handleDetectGPS = () => {
    if (!navigator.geolocation) {
      setAcquisitionState('error');
      setStatusMsg('⚠️ Geolocation is not supported by your browser.');
      return;
    }

    setAcquisitionState('detecting');
    setStatusMsg('🛰️ Contacting GPS satellites & network location providers...');
    setAccuracyMeters(null);

    let bestReading = null;
    let watchId = null;
    let finished = false;

    const finalize = (reading) => {
      if (finished) return;
      finished = true;
      if (watchId !== null) {
        try { navigator.geolocation.clearWatch(watchId); } catch {}
      }

      if (reading && reading.coords) {
        const detectedLat = parseFloat(reading.coords.latitude.toFixed(6));
        const detectedLng = parseFloat(reading.coords.longitude.toFixed(6));
        const acc = Math.round(reading.coords.accuracy || 999);

        updateMapPosition(detectedLat, detectedLng);
        setAccuracyMeters(acc);
        setIsManualAdjusted(false);

        if (acc <= 50) {
          setAcquisitionState('success');
          setStatusMsg(`✅ Excellent Precision! Accuracy: ±${acc}m (Lat: ${detectedLat}, Lng: ${detectedLng})`);
        } else if (acc <= 100) {
          setAcquisitionState('success');
          setStatusMsg(`🔵 Good Quality! Accuracy: ±${acc}m — You can fine-tune pin on map.`);
        } else if (acc <= 300) {
          setAcquisitionState('warning');
          setStatusMsg(`🟡 Fair Accuracy (±${acc}m). We recommend dragging the pin directly to your restaurant building.`);
        } else {
          setAcquisitionState('warning');
          setStatusMsg(`⚠️ Low GPS Precision (±${acc}m). Please drag the map pin or search address below.`);
        }
      } else {
        setAcquisitionState('error');
        setStatusMsg('⚠️ Could not obtain GPS fix. Please search address or drag pin on map.');
      }
    };

    // Primary High Accuracy Fix with Progressive Refinement
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        bestReading = pos;
        const initialAcc = pos.coords.accuracy || 999;

        // If initial fix is already razor-sharp (<= 20m), finalize instantly
        if (initialAcc <= 20) {
          finalize(pos);
          return;
        }

        setAcquisitionState('improving');
        setStatusMsg(`📡 Initial fix: ±${Math.round(initialAcc)}m. Refining satellite lock (2-3s)...`);

        const startTime = Date.now();
        watchId = navigator.geolocation.watchPosition(
          (watchPos) => {
            if (!bestReading || (watchPos.coords.accuracy && watchPos.coords.accuracy < bestReading.coords.accuracy)) {
              bestReading = watchPos;
              setStatusMsg(`📡 Improved fix: ±${Math.round(watchPos.coords.accuracy)}m...`);
            }
            if ((watchPos.coords.accuracy && watchPos.coords.accuracy <= 15) || (Date.now() - startTime >= 3500)) {
              finalize(bestReading);
            }
          },
          () => {
            finalize(bestReading);
          },
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );

        setTimeout(() => {
          finalize(bestReading);
        }, 4000);
      },
      (err) => {
        if (err.code === 1) { // PERMISSION_DENIED
          setAcquisitionState('error');
          setStatusMsg('🔒 Location permission denied. Please allow location in browser or search address.');
        } else if (err.code === 2) { // POSITION_UNAVAILABLE
          setAcquisitionState('error');
          setStatusMsg('📍 Device Location is disabled. Please turn on Location in device settings.');
        } else {
          finalize(null);
        }
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  };

  // OpenStreetMap Nominatim Address Search
  const handleSearchAddress = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    setStatusMsg('🔍 Searching address coordinates on OpenStreetMap...');
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`, {
        headers: { 'Accept-Language': 'en' }
      });
      const data = await res.json();
      if (data && data.length > 0) {
        const item = data[0];
        const sLat = parseFloat(parseFloat(item.lat).toFixed(6));
        const sLng = parseFloat(parseFloat(item.lon).toFixed(6));
        updateMapPosition(sLat, sLng);
        setIsManualAdjusted(true);
        setAccuracyMeters(5); // Geocoded address accuracy
        setAcquisitionState('success');
        setStatusMsg(`✅ Found: ${item.display_name.substring(0, 75)}...`);
      } else {
        setAcquisitionState('warning');
        setStatusMsg('⚠️ No exact match found for this address. Try entering nearby landmark or city.');
      }
    } catch {
      setAcquisitionState('error');
      setStatusMsg('⚠️ Address lookup failed. Please drag map pin manually.');
    } finally {
      setSearching(false);
    }
  };

  const handleConfirmSave = () => {
    if (onSave) {
      onSave({
        latitude: lat,
        longitude: lng,
        max_distance_meters: radiusMeters,
        accuracy_meters: accuracyMeters,
        location_initialized: true
      });
    }
    if (onClose) onClose();
  };

  if (!isOpen) return null;

  // Accuracy Tier Badge Helper
  const getQualityBadge = () => {
    if (isManualAdjusted) {
      return <span style={{ background: '#10B981', color: '#FFF', padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800 }}>🎯 Map Pinpoint Verified</span>;
    }
    if (!accuracyMeters) return null;
    if (accuracyMeters <= 50) {
      return <span style={{ background: '#10B981', color: '#FFF', padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800 }}>🟢 Excellent (±{accuracyMeters}m)</span>;
    }
    if (accuracyMeters <= 100) {
      return <span style={{ background: '#0284C7', color: '#FFF', padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800 }}>🔵 Good (±{accuracyMeters}m)</span>;
    }
    if (accuracyMeters <= 300) {
      return <span style={{ background: '#F59E0B', color: '#FFF', padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800 }}>🟡 Fair (±{accuracyMeters}m)</span>;
    }
    return <span style={{ background: '#EF4444', color: '#FFF', padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800 }}>🔴 Low (±{accuracyMeters}m)</span>;
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(5, 20, 11, 0.85)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px'
    }}>
      <div style={{
        background: '#0B2014',
        border: '2px solid #DFBA67',
        borderRadius: '24px',
        width: '100%',
        maxWidth: '780px',
        maxHeight: '94vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
        overflow: 'hidden',
        color: '#FFFFFF'
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid rgba(223, 186, 103, 0.25)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'rgba(10, 35, 21, 0.95)'
        }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#DFBA67', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Navigation size={22} color="#DFBA67" /> High-Accuracy Restaurant Location
            </h2>
            <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#94A3B8' }}>
              Auto-detect GPS or drag the red pin to your exact restaurant entrance/building.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)', border: 'none', color: '#E2E8F0',
              width: '34px', height: '34px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '18px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* Top Control Bar: GPS Auto-Detect & Search Address */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              onClick={handleDetectGPS}
              disabled={acquisitionState === 'detecting' || acquisitionState === 'improving'}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '10px 18px', borderRadius: '12px', border: 'none',
                background: 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)',
                color: '#FFFFFF', fontWeight: 900, fontSize: '0.84rem', cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.35)', flexShrink: 0
              }}
            >
              {acquisitionState === 'detecting' || acquisitionState === 'improving' ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Acquiring GPS...
                </>
              ) : (
                <>
                  <Compass size={16} />
                  🎯 Auto Detect GPS
                </>
              )}
            </button>

            {/* Address Search Form */}
            <form onSubmit={handleSearchAddress} style={{ flex: 1, minWidth: '240px', display: 'flex', gap: '6px' }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search street, landmark, city (e.g. Market Road, Patna)..."
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: '12px',
                  background: '#071A0E', border: '1px solid rgba(223, 186, 103, 0.3)',
                  color: '#FFFFFF', fontSize: '0.84rem', outline: 'none'
                }}
              />
              <button
                type="submit"
                disabled={searching}
                style={{
                  padding: '10px 16px', borderRadius: '12px', border: '1px solid rgba(223, 186, 103, 0.4)',
                  background: 'rgba(223, 186, 103, 0.15)', color: '#DFBA67',
                  fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                {searching ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                Search
              </button>
            </form>
          </div>

          {/* Status Message Strip */}
          {statusMsg && (
            <div style={{
              padding: '10px 14px', borderRadius: '12px',
              background: acquisitionState === 'success' ? 'rgba(16, 185, 129, 0.15)' : (acquisitionState === 'warning' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(2, 132, 199, 0.15)'),
              border: acquisitionState === 'success' ? '1px solid #10B981' : (acquisitionState === 'warning' ? '1px solid #F59E0B' : '1px solid #0284C7'),
              fontSize: '0.82rem', fontWeight: 700,
              color: acquisitionState === 'success' ? '#86EFAC' : (acquisitionState === 'warning' ? '#FDE047' : '#7DD3FC'),
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px'
            }}>
              <span>{statusMsg}</span>
              {getQualityBadge()}
            </div>
          )}

          {/* Interactive Leaflet Map View */}
          <div style={{ position: 'relative', width: '100%', height: '320px', borderRadius: '16px', overflow: 'hidden', border: '2px solid rgba(223, 186, 103, 0.4)' }}>
            <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

            {/* Floating Guide Badge */}
            <div style={{
              position: 'absolute', bottom: '10px', left: '10px', zIndex: 1000,
              background: 'rgba(11, 32, 20, 0.9)', backdropFilter: 'blur(4px)',
              padding: '6px 12px', borderRadius: '8px', border: '1px solid #DFBA67',
              fontSize: '0.72rem', fontWeight: 700, color: '#DFBA67', pointerEvents: 'none'
            }}>
              💡 Drag red pin or click map to move restaurant entrance
            </div>
          </div>

          {/* Bottom Coordinate Readouts & Geofencing Radius Configuration */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <div style={{ background: '#071A0E', padding: '10px 14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#94A3B8', marginBottom: '3px' }}>LATITUDE</label>
              <input
                type="number"
                step="any"
                value={lat}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val)) updateMapPosition(val, lng);
                }}
                style={{ width: '100%', background: 'transparent', border: 'none', color: '#FFF', fontSize: '0.92rem', fontWeight: 800, outline: 'none' }}
              />
            </div>

            <div style={{ background: '#071A0E', padding: '10px 14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#94A3B8', marginBottom: '3px' }}>LONGITUDE</label>
              <input
                type="number"
                step="any"
                value={lng}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val)) updateMapPosition(lat, val);
                }}
                style={{ width: '100%', background: 'transparent', border: 'none', color: '#FFF', fontSize: '0.92rem', fontWeight: 800, outline: 'none' }}
              />
            </div>

            <div style={{ background: '#071A0E', padding: '10px 14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#DFBA67', marginBottom: '3px' }}>
                ORDER GEOFENCE RADIUS
              </label>
              <select
                value={radiusMeters}
                onChange={(e) => setRadiusMeters(Number(e.target.value))}
                style={{ width: '100%', background: 'transparent', border: 'none', color: '#FFF', fontSize: '0.86rem', fontWeight: 800, outline: 'none', cursor: 'pointer' }}
              >
                <option value={50} style={{ background: '#0B2014', color: '#FFF' }}>50 meters (Strict Dining Hall)</option>
                <option value={100} style={{ background: '#0B2014', color: '#FFF' }}>100 meters (Restaurant Campus)</option>
                <option value={250} style={{ background: '#0B2014', color: '#FFF' }}>250 meters (Compound & Parking)</option>
                <option value={500} style={{ background: '#0B2014', color: '#FFF' }}>500 meters (Neighborhood / Complex)</option>
                <option value={1000} style={{ background: '#0B2014', color: '#FFF' }}>1,000 meters (1 km Zone)</option>
                <option value={2000} style={{ background: '#0B2014', color: '#FFF' }}>2,000 meters (2 km Zone)</option>
              </select>
            </div>
          </div>

          {/* External Google Maps Verification Link */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
            <span style={{ color: '#94A3B8' }}>Golden Circle indicates allowed customer ordering radius.</span>
            <a
              href={`https://www.google.com/maps?q=${lat},${lng}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#38BDF8', fontWeight: 800, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              Verify on Google Maps <ExternalLink size={13} />
            </a>
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid rgba(223, 186, 103, 0.25)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'rgba(10, 35, 21, 0.95)'
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)',
              color: '#E2E8F0', padding: '10px 20px', borderRadius: '12px',
              fontWeight: 700, fontSize: '0.86rem', cursor: 'pointer'
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirmSave}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '12px 28px', borderRadius: '14px', border: 'none',
              background: 'linear-gradient(135deg, #DFBA67 0%, #C89F43 100%)',
              color: '#0A2315', fontWeight: 900, fontSize: '0.92rem', cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(223, 186, 103, 0.4)'
            }}
          >
            <Check size={18} />
            Confirm & Save Coordinates
          </button>
        </div>
      </div>
    </div>
  );
}
