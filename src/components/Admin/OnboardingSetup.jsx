import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, Store, CheckCircle2, ArrowRight, ArrowLeft, Upload, Loader2, AlertCircle, Sparkles, Search, ExternalLink, Compass, Map } from 'lucide-react';
import { uploadImage, updateTenantSettings, completeOnboarding } from '../../api/client';
import LocationPickerModal from '../Common/LocationPickerModal';
import {
  BUSINESS_TYPES,
  FOOD_TYPES,
  SERVICE_MODELS,
  BUSINESS_TYPE_METADATA,
  FOOD_TYPE_METADATA,
  SERVICE_MODEL_METADATA,
  resolveBusinessProfile,
  resolveServiceModelForBusinessType
} from '../../utils/businessTaxonomy';

export default function OnboardingSetup({ token, restaurantInfo, setRestaurantInfo, onComplete }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showMapPicker, setShowMapPicker] = useState(false);

  // Form State initialized from prop or loaded data
  const [formData, setFormData] = useState(() => {
    const profile = resolveBusinessProfile(restaurantInfo || {});
    return {
      name: restaurantInfo?.name || '',
      owner_name: restaurantInfo?.owner_name || '',
      tagline: restaurantInfo?.tagline || '100% Quality Food & Service',
      phone: restaurantInfo?.phone || '',
      whatsapp_number: restaurantInfo?.whatsapp_number || restaurantInfo?.phone || '',
      address: restaurantInfo?.address || '',
      city: restaurantInfo?.city || '',
      state: restaurantInfo?.state || '',
      pincode: restaurantInfo?.pincode || '',
      latitude: restaurantInfo?.latitude !== undefined && restaurantInfo?.latitude !== null ? restaurantInfo.latitude : 26.6500,
      longitude: restaurantInfo?.longitude !== undefined && restaurantInfo?.longitude !== null ? restaurantInfo.longitude : 84.9167,
      location_initialized: restaurantInfo?.location_initialized || false,
      logo: restaurantInfo?.logo || '',
      openingHours: restaurantInfo?.openingHours || restaurantInfo?.opening_hours || '8:00 AM - 10:30 PM',
      resto_type: restaurantInfo?.resto_type || 'pure_veg',
      business_type: restaurantInfo?.business_type || profile.business_type || 'restaurant',
      food_type: restaurantInfo?.food_type || profile.food_type || 'pure_veg',
      service_model: restaurantInfo?.service_model || profile.service_model || 'dine_in_table',
      theme_color: restaurantInfo?.theme_color || 'gold'
    };
  });

  const [fieldErrors, setFieldErrors] = useState({});
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [locationStatus, setLocationStatus] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Sync state if restaurantInfo loads asynchronously
  useEffect(() => {
    if (restaurantInfo) {
      const profile = resolveBusinessProfile(restaurantInfo);
      setFormData(prev => ({
        ...prev,
        name: prev.name || restaurantInfo.name || '',
        owner_name: prev.owner_name || restaurantInfo.owner_name || '',
        tagline: prev.tagline || restaurantInfo.tagline || '100% Quality Food & Service',
        phone: prev.phone || restaurantInfo.phone || '',
        whatsapp_number: prev.whatsapp_number || restaurantInfo.whatsapp_number || restaurantInfo.phone || '',
        address: prev.address || restaurantInfo.address || '',
        city: prev.city || restaurantInfo.city || '',
        state: prev.state || restaurantInfo.state || '',
        pincode: prev.pincode || restaurantInfo.pincode || '',
        latitude: restaurantInfo.latitude !== undefined && restaurantInfo.latitude !== null ? restaurantInfo.latitude : prev.latitude,
        longitude: restaurantInfo.longitude !== undefined && restaurantInfo.longitude !== null ? restaurantInfo.longitude : prev.longitude,
        location_initialized: restaurantInfo.location_initialized !== undefined ? restaurantInfo.location_initialized : prev.location_initialized,
        logo: prev.logo || restaurantInfo.logo || '',
        openingHours: prev.openingHours || restaurantInfo.openingHours || restaurantInfo.opening_hours || '8:00 AM - 10:30 PM',
        resto_type: prev.resto_type || restaurantInfo.resto_type || 'pure_veg',
        business_type: prev.business_type || restaurantInfo.business_type || profile.business_type || 'restaurant',
        food_type: prev.food_type || restaurantInfo.food_type || profile.food_type || 'pure_veg',
        service_model: prev.service_model || restaurantInfo.service_model || profile.service_model || 'dine_in_table',
        theme_color: prev.theme_color || restaurantInfo.theme_color || 'gold'
      }));
    }
  }, [restaurantInfo]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // Step 1 Validation
  const validateStep1 = () => {
    const errors = {};
    if (!formData.name.trim()) errors.name = 'Restaurant Name is required';
    if (!formData.phone.trim()) {
      errors.phone = 'Phone number is required';
    } else if (formData.phone.replace(/[^0-9]/g, '').length < 10) {
      errors.phone = 'Please enter a valid 10-digit phone number';
    }
    if (!formData.address.trim()) errors.address = 'Address is required';

    if (formData.pincode && formData.pincode.replace(/[^0-9]/g, '').length !== 6) {
      errors.pincode = 'Pincode must be 6 digits';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Save Step 1
  const handleSaveStep1 = async () => {
    if (!validateStep1()) return;
    setSaving(true);
    setErrorMsg('');
    try {
      const fullAddr = [formData.address.trim(), formData.city.trim(), formData.state.trim(), formData.pincode.trim()].filter(Boolean).join(', ');
      await updateTenantSettings(token, {
        name: formData.name.trim(),
        tagline: formData.tagline.trim(),
        phone: formData.phone.trim(),
        whatsapp_number: formData.whatsapp_number.trim() || formData.phone.trim(),
        address: fullAddr || formData.address.trim(),
        city: formData.city.trim(),
        state: formData.state.trim(),
        pincode: formData.pincode.trim()
      });

      setCurrentStep(2);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save basic details. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Multi-Sample Precision GPS Engine
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('⚠️ Geolocation is not supported by your browser. Please enter coordinates manually.');
      return;
    }

    setDetectingLocation(true);
    setLocationStatus('📍 Accessing high-precision GPS satellite sensor...');

    let bestReading = null;
    let watchId = null;
    let finished = false;

    const finalize = (reading) => {
      if (finished) return;
      finished = true;
      if (watchId !== null) {
        try { navigator.geolocation.clearWatch(watchId); } catch {}
      }
      setDetectingLocation(false);

      if (reading && reading.coords) {
        const lat = parseFloat(reading.coords.latitude.toFixed(6));
        const lon = parseFloat(reading.coords.longitude.toFixed(6));
        const accuracy = Math.round(reading.coords.accuracy || 0);

        setFormData(prev => ({
          ...prev,
          latitude: lat,
          longitude: lon,
          location_initialized: true
        }));
        setLocationStatus(`✅ GPS Fixed! Lat: ${lat}, Lng: ${lon} (Accuracy: ±${accuracy}m)`);
      } else {
        setLocationStatus('⚠️ Could not get accurate GPS lock. You can search from your restaurant address below.');
      }
    };

    // 1. Initial High-Accuracy Fix
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        bestReading = pos;
        // If accuracy is sharp (<= 20 meters), finalize immediately
        if (pos.coords.accuracy && pos.coords.accuracy <= 20) {
          finalize(pos);
          return;
        }

        // Otherwise, watch for 3.5 seconds to acquire a tighter GPS fix
        const startTime = Date.now();
        watchId = navigator.geolocation.watchPosition(
          (watchPos) => {
            if (!bestReading || (watchPos.coords.accuracy && watchPos.coords.accuracy < bestReading.coords.accuracy)) {
              bestReading = watchPos;
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
        if (err.code === err.PERMISSION_DENIED) {
          setLocationStatus('⚠️ GPS Permission Denied. Please enable location in browser settings or use Address Search.');
          setDetectingLocation(false);
        } else {
          finalize(null);
        }
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  };

  // Address Geocoder fallback using OpenStreetMap Nominatim API
  const [geocodingAddress, setGeocodingAddress] = useState(false);
  const handleGeocodeAddress = async () => {
    const queryParts = [formData.address, formData.city, formData.state, formData.pincode, 'India'].filter(Boolean);
    const fullQuery = queryParts.join(', ').trim();
    if (!fullQuery || fullQuery === 'India') {
      setLocationStatus('⚠️ Please enter your Street Address and City in Step 1 to lookup coordinates.');
      return;
    }

    setGeocodingAddress(true);
    setLocationStatus('🔍 Searching coordinates from address on OpenStreetMap...');
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullQuery)}&limit=1`, {
        headers: { 'Accept-Language': 'en' }
      });
      const data = await res.json();
      if (data && data.length > 0) {
        const item = data[0];
        const lat = parseFloat(parseFloat(item.lat).toFixed(6));
        const lon = parseFloat(parseFloat(item.lon).toFixed(6));
        setFormData(prev => ({
          ...prev,
          latitude: lat,
          longitude: lon,
          location_initialized: true
        }));
        setLocationStatus(`✅ Address coordinates matched: ${item.display_name.substring(0, 65)}...`);
      } else {
        setLocationStatus('⚠️ Could not find exact coordinates for this address. Try entering nearby landmark or manual lat/lng.');
      }
    } catch (e) {
      setLocationStatus('⚠️ Address lookup failed. Please enter coordinates manually.');
    } finally {
      setGeocodingAddress(false);
    }
  };

  // Save Step 2
  const handleSaveStep2 = async () => {
    setSaving(true);
    setErrorMsg('');
    try {
      await updateTenantSettings(token, {
        latitude: Number(formData.latitude),
        longitude: Number(formData.longitude),
        location_initialized: true
      });

      setCurrentStep(3);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save location details. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Logo Upload
  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingLogo(true);
    setErrorMsg('');
    try {
      const uploadRes = await uploadImage(file, 'logos', token);
      if (uploadRes && (uploadRes.publicUrl || uploadRes.url)) {
        const logoUrl = uploadRes.publicUrl || uploadRes.url;
        setFormData(prev => ({ ...prev, logo: logoUrl }));
      }
    } catch (err) {
      setErrorMsg(err.message || 'Image upload failed. Please try again.');
    } finally {
      setUploadingLogo(false);
    }
  };

  // Final Step 3 Completion
  const handleCompleteSetup = async () => {
    setSaving(true);
    setErrorMsg('');
    try {
      const safeResto = (formData.food_type === 'pure_veg' ? 'pure_veg' : formData.food_type === 'veg_nonveg' ? 'veg_nonveg' : (formData.business_type === 'bakery_confectionery' ? 'bakery' : (formData.resto_type || 'pure_veg')));
      await updateTenantSettings(token, {
        logo: formData.logo,
        openingHours: formData.openingHours,
        business_type: formData.business_type,
        food_type: formData.food_type,
        service_model: formData.service_model,
        business_category: formData.business_category || 'dine_in',
        resto_type: safeResto,
        theme_color: formData.theme_color,
        location_initialized: true
      });

      await completeOnboarding(token);

      setSuccessMsg('✨ Setup Complete! Loading your restaurant dashboard...');
      setTimeout(() => {
        if (onComplete) onComplete();
      }, 800);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to complete setup. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #05140B 0%, #0A2315 50%, #164E2A 100%)',
      color: '#F8FAFC',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif"
    }}>
      <div style={{
        width: '100%',
        maxWidth: '620px',
        background: 'rgba(17, 44, 27, 0.95)',
        border: '1px solid rgba(223, 186, 103, 0.3)',
        borderRadius: '24px',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(20px)',
        overflow: 'hidden'
      }}>
        
        {/* Header */}
        <div style={{
          padding: '28px 24px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          textAlign: 'center'
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '52px',
            height: '52px',
            background: 'rgba(223, 186, 103, 0.15)',
            border: '1.5px solid #DFBA67',
            borderRadius: '16px',
            color: '#DFBA67',
            marginBottom: '12px'
          }}>
            <Store size={28} />
          </div>
          <h1 style={{ fontSize: '1.45rem', fontWeight: 900, color: '#FFFFFF', margin: '0 0 6px' }}>
            Complete Your Restaurant Setup
          </h1>
          <p style={{ fontSize: '0.84rem', color: '#94A3B8', margin: 0 }}>
            Add your basic restaurant information before continuing to your dashboard.
          </p>

          {/* Stepper Indicator */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            marginTop: '20px'
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '9999px',
              fontSize: '0.78rem', fontWeight: 800,
              background: currentStep === 1 ? '#DFBA67' : 'rgba(255,255,255,0.08)',
              color: currentStep === 1 ? '#0A2315' : '#94A3B8'
            }}>
              <span>1</span> Basic Details
            </div>
            <div style={{ width: '20px', height: '2px', background: currentStep >= 2 ? '#DFBA67' : 'rgba(255,255,255,0.1)' }} />
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '9999px',
              fontSize: '0.78rem', fontWeight: 800,
              background: currentStep === 2 ? '#DFBA67' : 'rgba(255,255,255,0.08)',
              color: currentStep === 2 ? '#0A2315' : '#94A3B8'
            }}>
              <span>2</span> Location
            </div>
            <div style={{ width: '20px', height: '2px', background: currentStep >= 3 ? '#DFBA67' : 'rgba(255,255,255,0.1)' }} />
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '9999px',
              fontSize: '0.78rem', fontWeight: 800,
              background: currentStep === 3 ? '#DFBA67' : 'rgba(255,255,255,0.08)',
              color: currentStep === 3 ? '#0A2315' : '#94A3B8'
            }}>
              <span>3</span> Branding
            </div>
          </div>
        </div>

        {/* Global Messages */}
        {errorMsg && (
          <div style={{
            margin: '16px 24px 0', padding: '12px 16px', borderRadius: '12px',
            background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #EF4444',
            color: '#FCA5A5', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '10px'
          }}>
            <AlertCircle size={18} />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div style={{
            margin: '16px 24px 0', padding: '12px 16px', borderRadius: '12px',
            background: 'rgba(34, 197, 94, 0.15)', border: '1px solid #22C55E',
            color: '#86EFAC', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '10px'
          }}>
            <CheckCircle2 size={18} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form Body */}
        <div style={{ padding: '24px' }}>
          {/* STEP 1: Basic Details */}
          {currentStep === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#E2E8F0', marginBottom: '6px' }}>
                  Restaurant Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g. Raman Sweet Bakery"
                  style={{
                    width: '100%', padding: '12px 16px', borderRadius: '12px',
                    background: '#071A0E', border: fieldErrors.name ? '1.5px solid #EF4444' : '1px solid rgba(223, 186, 103, 0.3)',
                    color: '#FFFFFF', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box'
                  }}
                />
                {fieldErrors.name && <p style={{ color: '#FCA5A5', fontSize: '0.74rem', margin: '4px 0 0' }}>{fieldErrors.name}</p>}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#E2E8F0', marginBottom: '6px' }}>
                  Tagline
                </label>
                <input
                  type="text"
                  name="tagline"
                  value={formData.tagline}
                  onChange={handleChange}
                  placeholder="e.g. 100% Quality Food & Service"
                  style={{
                    width: '100%', padding: '12px 16px', borderRadius: '12px',
                    background: '#071A0E', border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#FFFFFF', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#E2E8F0', marginBottom: '6px' }}>
                    Phone Number *
                  </label>
                  <input
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="e.g. 9876543210"
                    style={{
                      width: '100%', padding: '12px 16px', borderRadius: '12px',
                      background: '#071A0E', border: fieldErrors.phone ? '1.5px solid #EF4444' : '1px solid rgba(223, 186, 103, 0.3)',
                      color: '#FFFFFF', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box'
                    }}
                  />
                  {fieldErrors.phone && <p style={{ color: '#FCA5A5', fontSize: '0.74rem', margin: '4px 0 0' }}>{fieldErrors.phone}</p>}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#E2E8F0', marginBottom: '6px' }}>
                    WhatsApp Ordering Number
                  </label>
                  <input
                    type="text"
                    name="whatsapp_number"
                    value={formData.whatsapp_number}
                    onChange={handleChange}
                    placeholder="Same as phone if empty"
                    style={{
                      width: '100%', padding: '12px 16px', borderRadius: '12px',
                      background: '#071A0E', border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#FFFFFF', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#E2E8F0', marginBottom: '6px' }}>
                  Address *
                </label>
                <textarea
                  name="address"
                  rows={2}
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="Street address, landmark, building name..."
                  style={{
                    width: '100%', padding: '12px 16px', borderRadius: '12px',
                    background: '#071A0E', border: fieldErrors.address ? '1.5px solid #EF4444' : '1px solid rgba(223, 186, 103, 0.3)',
                    color: '#FFFFFF', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box', resize: 'vertical'
                  }}
                />
                {fieldErrors.address && <p style={{ color: '#FCA5A5', fontSize: '0.74rem', margin: '4px 0 0' }}>{fieldErrors.address}</p>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#94A3B8', marginBottom: '4px' }}>City</label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    placeholder="City"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', background: '#071A0E', border: '1px solid rgba(255,255,255,0.15)', color: '#FFF', fontSize: '0.84rem', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#94A3B8', marginBottom: '4px' }}>State</label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    placeholder="State"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', background: '#071A0E', border: '1px solid rgba(255,255,255,0.15)', color: '#FFF', fontSize: '0.84rem', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#94A3B8', marginBottom: '4px' }}>Pincode</label>
                  <input
                    type="text"
                    name="pincode"
                    value={formData.pincode}
                    onChange={handleChange}
                    placeholder="Pincode"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', background: '#071A0E', border: '1px solid rgba(255,255,255,0.15)', color: '#FFF', fontSize: '0.84rem', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={handleSaveStep1}
                  disabled={saving}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    padding: '12px 28px', borderRadius: '14px', border: 'none',
                    background: 'linear-gradient(135deg, #DFBA67 0%, #C89F43 100%)',
                    color: '#0A2315', fontWeight: 900, fontSize: '0.9rem', cursor: 'pointer',
                    boxShadow: '0 4px 15px rgba(223, 186, 103, 0.35)'
                  }}
                >
                  {saving ? <Loader2 size={18} className="animate-spin" /> : <>Save & Continue <ArrowRight size={18} /></>}
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Location */}
          {currentStep === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{
                padding: '16px', borderRadius: '14px', background: 'rgba(223, 186, 103, 0.1)',
                border: '1px solid rgba(223, 186, 103, 0.3)', color: '#DFBA67', fontSize: '0.82rem', lineHeight: 1.5
              }}>
                <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.88rem', color: '#DFBA67', marginBottom: '4px' }}>
                  <Navigation size={18} /> High-Precision GPS Location Setup
                </strong>
                Accurate coordinates ensure customers can only place orders when physically dining at your restaurant. You can detect via live device GPS or search your address.
              </div>

              {/* Action Buttons: Auto GPS + Address Search */}
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={handleDetectLocation}
                  disabled={detectingLocation || geocodingAddress}
                  style={{
                    flex: '1 1 180px',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    padding: '14px 18px', borderRadius: '14px', border: 'none',
                    background: 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)',
                    color: '#FFFFFF', fontWeight: 900, fontSize: '0.88rem', cursor: 'pointer',
                    boxShadow: '0 4px 15px rgba(2, 132, 199, 0.4)'
                  }}
                >
                  {detectingLocation ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Detecting GPS...
                    </>
                  ) : (
                    <>
                      <Compass size={18} />
                      🎯 Auto Detect GPS
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowMapPicker(true)}
                  style={{
                    flex: '1 1 180px',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    padding: '14px 18px', borderRadius: '14px', border: '1px solid #DFBA67',
                    background: 'linear-gradient(135deg, #DFBA67 0%, #C89F43 100%)',
                    color: '#0A2315', fontWeight: 900, fontSize: '0.88rem', cursor: 'pointer',
                    boxShadow: '0 4px 15px rgba(223, 186, 103, 0.35)'
                  }}
                >
                  <Map size={18} />
                  🗺️ Interactive Map & Pinpoint
                </button>

                <button
                  type="button"
                  onClick={handleGeocodeAddress}
                  disabled={detectingLocation || geocodingAddress}
                  style={{
                    flex: '1 1 180px',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    padding: '14px 18px', borderRadius: '14px', border: '1px solid rgba(223, 186, 103, 0.4)',
                    background: 'rgba(223, 186, 103, 0.12)',
                    color: '#DFBA67', fontWeight: 800, fontSize: '0.88rem', cursor: 'pointer'
                  }}
                >
                  {geocodingAddress ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Searching Address...
                    </>
                  ) : (
                    <>
                      <Search size={18} />
                      📍 Search Address
                    </>
                  )}
                </button>
              </div>

              {locationStatus && (
                <div style={{
                  padding: '10px 14px', borderRadius: '10px',
                  background: locationStatus.includes('✅') ? 'rgba(34, 197, 94, 0.12)' : 'rgba(234, 179, 8, 0.12)',
                  border: locationStatus.includes('✅') ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(234, 179, 8, 0.3)',
                  fontSize: '0.82rem', fontWeight: 700,
                  color: locationStatus.includes('✅') ? '#86EFAC' : '#FDE047',
                  textAlign: 'center'
                }}>
                  {locationStatus}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#E2E8F0', marginBottom: '6px' }}>Latitude</label>
                  <input
                    type="number"
                    step="any"
                    name="latitude"
                    value={formData.latitude}
                    onChange={handleChange}
                    placeholder="e.g. 28.6139"
                    style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', background: '#071A0E', border: '1px solid rgba(255,255,255,0.15)', color: '#FFF', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#E2E8F0', marginBottom: '6px' }}>Longitude</label>
                  <input
                    type="number"
                    step="any"
                    name="longitude"
                    value={formData.longitude}
                    onChange={handleChange}
                    placeholder="e.g. 77.2090"
                    style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', background: '#071A0E', border: '1px solid rgba(255,255,255,0.15)', color: '#FFF', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Verify on Google Maps preview */}
              {Boolean(Number(formData.latitude) && Number(formData.longitude)) && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setShowMapPicker(true)}
                    style={{
                      background: 'none', border: 'none', color: '#DFBA67', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'underline'
                    }}
                  >
                    🗺️ Open Map Editor
                  </button>
                  <a
                    href={`https://www.google.com/maps?q=${formData.latitude},${formData.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                      color: '#38BDF8', fontSize: '0.8rem', fontWeight: 800, textDecoration: 'none'
                    }}
                  >
                    Google Maps Pin <ExternalLink size={13} />
                  </a>
                </div>
              )}

              {/* Location Picker Modal */}
              <LocationPickerModal
                isOpen={showMapPicker}
                onClose={() => setShowMapPicker(false)}
                initialLat={Number(formData.latitude) || 26.6500}
                initialLng={Number(formData.longitude) || 86.5800}
                initialAddress={`${formData.address || ''} ${formData.city || ''} ${formData.state || ''} ${formData.pincode || ''}`.trim()}
                onSave={(loc) => {
                  setFormData(prev => ({
                    ...prev,
                    latitude: loc.latitude,
                    longitude: loc.longitude,
                    location_initialized: true
                  }));
                  setLocationStatus(`✅ Location pinned on map! Lat: ${loc.latitude}, Lng: ${loc.longitude}`);
                }}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    padding: '12px 22px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.2)',
                    background: 'rgba(255,255,255,0.06)', color: '#E2E8F0', fontWeight: 700, fontSize: '0.86rem', cursor: 'pointer'
                  }}
                >
                  <ArrowLeft size={16} /> Back
                </button>
                <button
                  type="button"
                  onClick={handleSaveStep2}
                  disabled={saving}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    padding: '12px 28px', borderRadius: '14px', border: 'none',
                    background: 'linear-gradient(135deg, #DFBA67 0%, #C89F43 100%)',
                    color: '#0A2315', fontWeight: 900, fontSize: '0.9rem', cursor: 'pointer',
                    boxShadow: '0 4px 15px rgba(223, 186, 103, 0.35)'
                  }}
                >
                  {saving ? <Loader2 size={18} className="animate-spin" /> : <>Save & Continue <ArrowRight size={18} /></>}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Branding */}
          {currentStep === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#E2E8F0', marginBottom: '8px' }}>Restaurant Logo</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{
                    width: '74px', height: '74px', borderRadius: '16px', background: '#071A0E',
                    border: '1.5px solid rgba(223, 186, 103, 0.4)', overflow: 'hidden',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {formData.logo ? (
                      <img src={formData.logo} alt="Logo Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <Store size={32} color="#94A3B8" />
                    )}
                  </div>
                  <label style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    padding: '12px 20px', borderRadius: '12px', background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.2)', color: '#FFFFFF', fontWeight: 700,
                    fontSize: '0.84rem', cursor: 'pointer'
                  }}>
                    {uploadingLogo ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                    Upload Logo
                    <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
                  </label>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#E2E8F0', marginBottom: '6px' }}>Opening Hours</label>
                <input
                  type="text"
                  name="openingHours"
                  value={formData.openingHours}
                  onChange={handleChange}
                  placeholder="e.g. 8:00 AM - 10:30 PM"
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', background: '#071A0E', border: '1px solid rgba(255,255,255,0.15)', color: '#FFF', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              {/* 3-Tier Business Profile Controls */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', background: '#071A0E', padding: '16px', borderRadius: '16px', border: '1px solid rgba(223, 186, 103, 0.3)' }}>
                <strong style={{ fontSize: '0.86rem', color: '#DFBA67', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  🏢 Business Profile Taxonomy
                </strong>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {/* Control 1: Business Type */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#E2E8F0', marginBottom: '4px' }}>
                      Business Type
                    </label>
                    <select
                      name="business_type"
                      value={formData.business_type || 'restaurant'}
                      onChange={(e) => {
                        const newBiz = e.target.value;
                        const safeResto = (formData.food_type === 'pure_veg' ? 'pure_veg' : formData.food_type === 'veg_nonveg' ? 'veg_nonveg' : (newBiz === 'bakery_confectionery' ? 'bakery' : 'pure_veg'));
                        const autoService = resolveServiceModelForBusinessType(newBiz, formData.service_model);
                        setFormData(prev => ({
                          ...prev,
                          business_type: newBiz,
                          service_model: autoService,
                          resto_type: safeResto
                        }));
                      }}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', background: '#0A2315', border: '1px solid rgba(223, 186, 103, 0.4)', color: '#FFF', fontSize: '0.84rem', outline: 'none', boxSizing: 'border-box' }}
                    >
                      {BUSINESS_TYPES.map(type => (
                        <option key={type} value={type}>
                          {BUSINESS_TYPE_METADATA[type]?.icon || '🏢'} {BUSINESS_TYPE_METADATA[type]?.label || type}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Control 2: Food Type */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#E2E8F0', marginBottom: '4px' }}>
                      Food Dietary Type
                    </label>
                    <select
                      name="food_type"
                      value={formData.food_type || 'pure_veg'}
                      onChange={(e) => {
                        const newFood = e.target.value;
                        const safeResto = (newFood === 'pure_veg' ? 'pure_veg' : newFood === 'veg_nonveg' ? 'veg_nonveg' : (formData.business_type === 'bakery_confectionery' ? 'bakery' : 'pure_veg'));
                        setFormData(prev => ({
                          ...prev,
                          food_type: newFood,
                          resto_type: safeResto
                        }));
                      }}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', background: '#0A2315', border: '1px solid rgba(223, 186, 103, 0.4)', color: '#FFF', fontSize: '0.84rem', outline: 'none', boxSizing: 'border-box' }}
                    >
                      {FOOD_TYPES.map(type => (
                        <option key={type} value={type}>
                          {FOOD_TYPE_METADATA[type]?.icon || '🥗'} {FOOD_TYPE_METADATA[type]?.label || type}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Control 3: Service Model */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#E2E8F0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>Service Model</span>
                      <span style={{ fontSize: '0.70rem' }}>🔒</span>
                    </label>
                    <span style={{ fontSize: '0.66rem', fontWeight: 700, color: '#DFBA67', background: 'rgba(223, 186, 103, 0.15)', padding: '2px 6px', borderRadius: '8px' }}>
                      Auto-selected
                    </span>
                  </div>
                  <div style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', background: '#0A2315', border: '1px solid rgba(223, 186, 103, 0.4)', color: '#FFF', fontSize: '0.84rem', boxSizing: 'border-box', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{SERVICE_MODEL_METADATA[formData.service_model]?.label || formData.service_model}</span>
                    <span style={{ fontSize: '0.70rem', color: '#94A3B8' }}>Determined by Business Type</span>
                  </div>
                </div>

                {/* Live Preview */}
                <div style={{ padding: '8px 12px', background: 'rgba(223, 186, 103, 0.08)', borderRadius: '10px', border: '1px dashed rgba(223, 186, 103, 0.3)', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#DFBA67' }}>
                    {BUSINESS_TYPE_METADATA[formData.business_type]?.icon || '🍽️'} {BUSINESS_TYPE_METADATA[formData.business_type]?.label?.replace(/\s*\(.*\)/, '') || formData.business_type}
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.3)' }}>•</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#86EFAC' }}>
                    {FOOD_TYPE_METADATA[formData.food_type]?.icon || '🟢'} {FOOD_TYPE_METADATA[formData.food_type]?.label || formData.food_type}
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.3)' }}>•</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#93C5FD' }}>
                    {SERVICE_MODEL_METADATA[formData.service_model]?.label || formData.service_model}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    padding: '12px 22px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.2)',
                    background: 'rgba(255,255,255,0.06)', color: '#E2E8F0', fontWeight: 700, fontSize: '0.86rem', cursor: 'pointer'
                  }}
                >
                  <ArrowLeft size={16} /> Back
                </button>
                <button
                  type="button"
                  onClick={handleCompleteSetup}
                  disabled={saving}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    padding: '14px 32px', borderRadius: '14px', border: 'none',
                    background: 'linear-gradient(135deg, #15803D 0%, #22C55E 100%)',
                    color: '#FFFFFF', fontWeight: 900, fontSize: '0.94rem', cursor: 'pointer',
                    boxShadow: '0 4px 20px rgba(34, 197, 94, 0.4)'
                  }}
                >
                  {saving ? <Loader2 size={18} className="animate-spin" /> : <><Sparkles size={18} /> Complete Setup & Open Dashboard</>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
