import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Navigation, Search, Check, X, Compass, ExternalLink, Loader2, Layers, Crosshair, AlertTriangle, Sparkles, CheckCircle2, Sliders, Globe } from 'lucide-react';
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
    width: 38px; height: 38px;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 6px 18px rgba(0,0,0,0.5);
    border: 2.5px solid #FFFFFF;
    cursor: grab;
  ">
    <span style="transform: rotate(45deg); font-size: 18px;">🍴</span>
  </div>`,
  iconSize: [38, 38],
  iconAnchor: [19, 38],
  popupAnchor: [0, -38]
});

// Live Device Location Blue Pulsing Marker
const userLocationIcon = L.divIcon({
  className: 'user-live-gps-marker',
  html: `<div style="
    width: 20px; height: 20px;
    background: #0284C7;
    border: 3px solid #FFFFFF;
    border-radius: 50%;
    box-shadow: 0 0 0 6px rgba(2, 132, 199, 0.35);
  "></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10]
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
  const [samplesProgress, setSamplesProgress] = useState({ current: 0, total: 6, bestAcc: 999 });
  const [searchQuery, setSearchQuery] = useState(initialAddress || '');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [isManualAdjusted, setIsManualAdjusted] = useState(false);
  const [mapLayerType, setMapLayerType] = useState('street'); // 'street' | 'satellite'
  const [userLivePos, setUserLivePos] = useState(null);

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const userMarkerRef = useRef(null);
  const circleRef = useRef(null);
  const tileLayerRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // Initialize and update Leaflet Map
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [lat, lng],
        zoom: 17,
        zoomControl: true
      });

      // Default OpenStreetMap Street Tile
      const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 20,
      }).addTo(map);
      tileLayerRef.current = streetLayer;

      // Draggable Restaurant Marker
      const marker = L.marker([lat, lng], {
        draggable: true,
        icon: restaurantIcon
      }).addTo(map);

      // Geofence Circle Radius
      const circle = L.circle([lat, lng], {
        radius: radiusMeters,
        color: '#DFBA67',
        fillColor: '#DFBA67',
        fillOpacity: 0.16,
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
        setAccuracyMeters(1); // Exact rooftop placement
        setStatusMsg(`📍 Pin moved to: ${nLat}, ${nLng}`);
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
      mapInstanceRef.current.setView([lat, lng], mapInstanceRef.current.getZoom() || 17);
      if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
      if (circleRef.current) {
        circleRef.current.setLatLng([lat, lng]);
        circleRef.current.setRadius(radiusMeters);
      }
    }

    const timer = setTimeout(() => {
      if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
    }, 250);

    return () => clearTimeout(timer);
  }, [isOpen, lat, lng, radiusMeters]);

  // Switch Map Layer (Street vs HD Aerial Satellite)
  const switchMapLayer = (type) => {
    setMapLayerType(type);
    if (!mapInstanceRef.current || !tileLayerRef.current) return;

    mapInstanceRef.current.removeLayer(tileLayerRef.current);
    if (type === 'satellite') {
      tileLayerRef.current = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; Esri, Maxar, Earthstar Geographics',
        maxZoom: 19
      }).addTo(mapInstanceRef.current);
    } else {
      tileLayerRef.current = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 20
      }).addTo(mapInstanceRef.current);
    }
  };

  // Update Map elements when lat/lng change programmatically
  const updateMapPosition = (newLat, newLng) => {
    setLat(newLat);
    setLng(newLng);
    if (mapInstanceRef.current && markerRef.current && circleRef.current) {
      const latLng = [newLat, newLng];
      markerRef.current.setLatLng(latLng);
      circleRef.current.setLatLng(latLng);
      mapInstanceRef.current.flyTo(latLng, 18, { animate: true, duration: 0.8 });
    }
  };

  // Update Live User GPS Marker on Map
  const updateUserLiveMarker = (uLat, uLng) => {
    setUserLivePos({ lat: uLat, lng: uLng });
    if (!mapInstanceRef.current) return;
    if (!userMarkerRef.current) {
      userMarkerRef.current = L.marker([uLat, uLng], {
        icon: userLocationIcon,
        interactive: false
      }).addTo(mapInstanceRef.current);
    } else {
      userMarkerRef.current.setLatLng([uLat, uLng]);
    }
  };

  // Multi-Sample Weighted Centroid Satellite Acquisition
  const handleDetectGPS = () => {
    if (!navigator.geolocation) {
      setAcquisitionState('error');
      setStatusMsg('⚠️ Geolocation is not supported by your browser.');
      return;
    }

    setAcquisitionState('detecting');
    setStatusMsg('🛰️ Contacting GPS satellites & network location providers...');
    setAccuracyMeters(null);
    setSamplesProgress({ current: 0, total: 6, bestAcc: 999 });

    const collectedReadings = [];
    let watchId = null;
    let finished = false;

    const finalize = () => {
      if (finished) return;
      finished = true;
      if (watchId !== null) {
        try { navigator.geolocation.clearWatch(watchId); } catch {}
      }

      if (collectedReadings.length === 0) {
        setAcquisitionState('error');
        setStatusMsg('⚠️ Could not acquire GPS lock. Please search address or drag map pin.');
        return;
      }

      // Filter out low accuracy outliers (> 300m) if we have better readings
      const validReadings = collectedReadings.filter(r => r.accuracy <= 300);
      const readingsToUse = validReadings.length > 0 ? validReadings : collectedReadings;

      // Inverse-Variance Weighted Centroid Calculation
      let weightedLatSum = 0;
      let weightedLngSum = 0;
      let totalWeight = 0;
      let minAccuracy = 9999;

      for (const r of readingsToUse) {
        const weight = 1 / Math.max(r.accuracy * r.accuracy, 1);
        weightedLatSum += r.lat * weight;
        weightedLngSum += r.lng * weight;
        totalWeight += weight;
        if (r.accuracy < minAccuracy) minAccuracy = r.accuracy;
      }

      const finalLat = parseFloat((weightedLatSum / totalWeight).toFixed(6));
      const finalLng = parseFloat((weightedLngSum / totalWeight).toFixed(6));
      const finalAcc = Math.round(minAccuracy);

      updateMapPosition(finalLat, finalLng);
      setAccuracyMeters(finalAcc);
      setIsManualAdjusted(false);

      if (finalAcc <= 25) {
        setAcquisitionState('success');
        setStatusMsg(`🛰️ High-Precision Satellite Lock! (Accuracy: ±${finalAcc}m)`);
      } else if (finalAcc <= 60) {
        setAcquisitionState('success');
        setStatusMsg(`🟢 High-Quality GPS Fix (Accuracy: ±${finalAcc}m) — Fine-tune on map if needed.`);
      } else if (finalAcc <= 150) {
        setAcquisitionState('warning');
        setStatusMsg(`🟡 Moderate GPS Fix (±${finalAcc}m). Drag red pin to your exact building entrance.`);
      } else {
        setAcquisitionState('warning');
        setStatusMsg(`⚠️ Coarse GPS Fix (±${finalAcc}m). Please adjust the map pin directly.`);
      }
    };

    // Safety timeout: 4.5 seconds maximum acquisition window
    const maxTimer = setTimeout(finalize, 4500);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const initLat = pos.coords.latitude;
        const initLng = pos.coords.longitude;
        const initAcc = pos.coords.accuracy || 999;

        updateUserLiveMarker(initLat, initLng);
        collectedReadings.push({ lat: initLat, lng: initLng, accuracy: initAcc });
        setSamplesProgress({ current: 1, total: 6, bestAcc: Math.round(initAcc) });

        // If initial fix is already sub-15m military/RTK grade, finalize fast!
        if (initAcc <= 15) {
          clearTimeout(maxTimer);
          finalize();
          return;
        }

        setAcquisitionState('improving');
        setStatusMsg(`📡 Refining multi-sample satellite lock (±${Math.round(initAcc)}m)...`);

        const startTime = Date.now();
        watchId = navigator.geolocation.watchPosition(
          (watchPos) => {
            const wLat = watchPos.coords.latitude;
            const wLng = watchPos.coords.longitude;
            const wAcc = watchPos.coords.accuracy || 999;

            updateUserLiveMarker(wLat, wLng);
            collectedReadings.push({ lat: wLat, lng: wLng, accuracy: wAcc });

            const currentBest = Math.min(...collectedReadings.map(r => r.accuracy));
            setSamplesProgress({
              current: Math.min(collectedReadings.length, 6),
              total: 6,
              bestAcc: Math.round(currentBest)
            });
            setStatusMsg(`📡 Satellite sample ${collectedReadings.length}/6 (Best: ±${Math.round(currentBest)}m)...`);

            if (currentBest <= 10 || collectedReadings.length >= 6 || (Date.now() - startTime >= 3500)) {
              clearTimeout(maxTimer);
              finalize();
            }
          },
          () => {
            clearTimeout(maxTimer);
            finalize();
          },
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
      },
      (err) => {
        clearTimeout(maxTimer);
        if (err.code === 1) { // PERMISSION_DENIED
          setAcquisitionState('error');
          setStatusMsg('🔒 Location permission denied. Please allow location in browser settings or search address.');
        } else if (err.code === 2) { // POSITION_UNAVAILABLE
          setAcquisitionState('error');
          setStatusMsg('📍 Device Location is disabled. Please turn on Location in phone/system settings.');
        } else {
          setAcquisitionState('error');
          setStatusMsg('⏱️ Location acquisition timed out. Please try again or use map pin.');
        }
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
    );
  };

  // Live Debounced Address Autocomplete Search (OpenStreetMap Nominatim)
  const handleAddressInputChange = (val) => {
    setSearchQuery(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (!val || val.trim().length < 3) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const queryWithCountry = `${val}, India`;
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryWithCountry)}&limit=5`, {
          headers: { 'Accept-Language': 'en' }
        });
        const data = await res.json();
        if (Array.isArray(data)) {
          setSearchResults(data);
        }
      } catch (err) {
        console.warn('Address search failed:', err);
      } finally {
        setSearching(false);
      }
    }, 400);
  };

  const handleSelectSearchResult = (item) => {
    const sLat = parseFloat(parseFloat(item.lat).toFixed(6));
    const sLng = parseFloat(parseFloat(item.lon).toFixed(6));
    updateMapPosition(sLat, sLng);
    setSearchQuery(item.display_name.split(',')[0]);
    setSearchResults([]);
    setIsManualAdjusted(true);
    setAccuracyMeters(5);
    setAcquisitionState('success');
    setStatusMsg(`✅ Center placed at: ${item.display_name.substring(0, 60)}...`);
  };

  // Snap to Device Live Location
  const handleSnapToLiveGPS = () => {
    if (userLivePos) {
      updateMapPosition(userLivePos.lat, userLivePos.lng);
      setStatusMsg(`📍 Snapped restaurant pin to your device location!`);
    } else {
      handleDetectGPS();
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

  // Accuracy Badge Helper
  const getQualityBadge = () => {
    if (isManualAdjusted) {
      return <span style={{ background: '#10B981', color: '#FFF', padding: '3px 9px', borderRadius: '6px', fontSize: '0.74rem', fontWeight: 800 }}>🎯 Map Pinpoint Verified</span>;
    }
    if (!accuracyMeters) return null;
    if (accuracyMeters <= 30) {
      return <span style={{ background: '#10B981', color: '#FFF', padding: '3px 9px', borderRadius: '6px', fontSize: '0.74rem', fontWeight: 800 }}>🛰️ Military/High-Precision (±{accuracyMeters}m)</span>;
    }
    if (accuracyMeters <= 70) {
      return <span style={{ background: '#0284C7', color: '#FFF', padding: '3px 9px', borderRadius: '6px', fontSize: '0.74rem', fontWeight: 800 }}>🟢 Good Quality (±{accuracyMeters}m)</span>;
    }
    if (accuracyMeters <= 200) {
      return <span style={{ background: '#F59E0B', color: '#FFF', padding: '3px 9px', borderRadius: '6px', fontSize: '0.74rem', fontWeight: 800 }}>🟡 Fair (±{accuracyMeters}m)</span>;
    }
    return <span style={{ background: '#EF4444', color: '#FFF', padding: '3px 9px', borderRadius: '6px', fontSize: '0.74rem', fontWeight: 800 }}>🔴 Low (±{accuracyMeters}m)</span>;
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(5, 20, 11, 0.88)',
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
        maxWidth: '820px',
        maxHeight: '94vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 60px rgba(0,0,0,0.65)',
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
              Multi-sample satellite GPS & HD Aerial imagery for sub-meter restaurant pinpointing.
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
          
          {/* Search + Action Bar */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', position: 'relative' }}>
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
                  Sampling GPS ({samplesProgress.current}/{samplesProgress.total})...
                </>
              ) : (
                <>
                  <Compass size={16} />
                  🎯 Auto Detect GPS
                </>
              )}
            </button>

            {/* Address Autocomplete Input */}
            <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleAddressInputChange(e.target.value)}
                  placeholder="Type landmark, bazaar, town, city (e.g. Station Road, Patna)..."
                  style={{
                    width: '100%', padding: '10px 36px 10px 14px', borderRadius: '12px',
                    background: '#071A0E', border: '1px solid rgba(223, 186, 103, 0.35)',
                    color: '#FFFFFF', fontSize: '0.84rem', outline: 'none', boxSizing: 'border-box'
                  }}
                />
                <div style={{ position: 'absolute', right: '12px', color: '#DFBA67' }}>
                  {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                </div>
              </div>

              {/* Live Search Results Dropdown */}
              {searchResults.length > 0 && (
                <div style={{
                  position: 'absolute', top: '105%', left: 0, right: 0, zIndex: 10000,
                  background: '#071A0E', border: '1.5px solid #DFBA67', borderRadius: '12px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.7)', overflow: 'hidden', maxHeight: '200px', overflowY: 'auto'
                }}>
                  {searchResults.map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleSelectSearchResult(item)}
                      style={{
                        padding: '10px 14px', borderBottom: idx < searchResults.length - 1 ? '1px solid rgba(255,255,255,0.08)' : 'none',
                        cursor: 'pointer', fontSize: '0.8rem', color: '#E2E8F0',
                        transition: 'background 0.2s',
                        display: 'flex', alignItems: 'center', gap: '8px'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(223, 186, 103, 0.2)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <MapPin size={14} color="#DFBA67" />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.display_name}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Status & Accuracy Feedback Strip */}
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

          {/* Interactive Leaflet Map View with Layer Switcher & Quick Controls */}
          <div style={{ position: 'relative', width: '100%', height: '340px', borderRadius: '16px', overflow: 'hidden', border: '2px solid rgba(223, 186, 103, 0.4)' }}>
            <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

            {/* Top Right: Layer Switcher (Street vs HD Aerial Satellite) */}
            <div style={{
              position: 'absolute', top: '10px', right: '10px', zIndex: 1000,
              background: 'rgba(11, 32, 20, 0.92)', backdropFilter: 'blur(6px)',
              padding: '4px', borderRadius: '10px', border: '1px solid rgba(223, 186, 103, 0.4)',
              display: 'flex', gap: '4px'
            }}>
              <button
                type="button"
                onClick={() => switchMapLayer('street')}
                style={{
                  padding: '5px 10px', borderRadius: '7px', border: 'none',
                  background: mapLayerType === 'street' ? '#DFBA67' : 'transparent',
                  color: mapLayerType === 'street' ? '#0A2315' : '#E2E8F0',
                  fontSize: '0.74rem', fontWeight: 800, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '4px'
                }}
              >
                <Globe size={13} /> Street
              </button>
              <button
                type="button"
                onClick={() => switchMapLayer('satellite')}
                style={{
                  padding: '5px 10px', borderRadius: '7px', border: 'none',
                  background: mapLayerType === 'satellite' ? '#DFBA67' : 'transparent',
                  color: mapLayerType === 'satellite' ? '#0A2315' : '#E2E8F0',
                  fontSize: '0.74rem', fontWeight: 800, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '4px'
                }}
              >
                <Layers size={13} /> 🛰️ HD Satellite
              </button>
            </div>

            {/* Top Left: Quick Snap to Device GPS */}
            <div style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 1000 }}>
              <button
                type="button"
                onClick={handleSnapToLiveGPS}
                style={{
                  background: 'rgba(11, 32, 20, 0.92)', backdropFilter: 'blur(6px)',
                  border: '1px solid #DFBA67', color: '#DFBA67',
                  padding: '6px 12px', borderRadius: '8px', fontSize: '0.74rem', fontWeight: 800,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px'
                }}
              >
                <Crosshair size={14} /> Snap to My Device
              </button>
            </div>

            {/* Floating Guide Badge */}
            <div style={{
              position: 'absolute', bottom: '10px', left: '10px', zIndex: 1000,
              background: 'rgba(11, 32, 20, 0.92)', backdropFilter: 'blur(6px)',
              padding: '6px 12px', borderRadius: '8px', border: '1px solid #DFBA67',
              fontSize: '0.72rem', fontWeight: 700, color: '#DFBA67', pointerEvents: 'none'
            }}>
              💡 Drag gold pin or click map directly on your restaurant entrance
            </div>
          </div>

          {/* Coordinate Readouts & Geofencing Radius Configuration */}
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
              Verify Pin on Google Maps <ExternalLink size={13} />
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
