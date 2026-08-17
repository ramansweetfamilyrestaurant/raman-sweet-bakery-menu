import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, Store, CheckCircle2, ArrowRight, ArrowLeft, Upload, Loader2, AlertCircle, Building2, Phone, Sparkles } from 'lucide-react';
import { uploadImage, updateTenantSettings, completeOnboarding } from '../../api/client';

export default function OnboardingSetup({ token, restaurantInfo, setRestaurantInfo, onComplete }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form State initialized from prop or loaded data
  const [formData, setFormData] = useState({
    name: restaurantInfo?.name || '',
    tagline: restaurantInfo?.tagline || '100% Quality Food & Service',
    phone: restaurantInfo?.phone || '',
    whatsapp_number: restaurantInfo?.whatsapp_number || restaurantInfo?.phone || '',
    address: restaurantInfo?.address || '',
    city: '',
    state: '',
    pincode: '',
    latitude: restaurantInfo?.latitude !== undefined && restaurantInfo?.latitude !== null ? restaurantInfo.latitude : 26.6500,
    longitude: restaurantInfo?.longitude !== undefined && restaurantInfo?.longitude !== null ? restaurantInfo.longitude : 84.9167,
    location_initialized: restaurantInfo?.location_initialized || false,
    logo: restaurantInfo?.logo || '',
    openingHours: restaurantInfo?.openingHours || restaurantInfo?.opening_hours || '8:00 AM - 10:30 PM',
    resto_type: restaurantInfo?.resto_type || 'veg',
    theme_color: restaurantInfo?.theme_color || 'gold'
  });

  const [fieldErrors, setFieldErrors] = useState({});
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [locationStatus, setLocationStatus] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Sync state if restaurantInfo loads asynchronously
  useEffect(() => {
    if (restaurantInfo) {
      setFormData(prev => ({
        ...prev,
        name: prev.name || restaurantInfo.name || '',
        tagline: prev.tagline || restaurantInfo.tagline || '100% Quality Food & Service',
        phone: prev.phone || restaurantInfo.phone || '',
        whatsapp_number: prev.whatsapp_number || restaurantInfo.whatsapp_number || restaurantInfo.phone || '',
        address: prev.address || restaurantInfo.address || '',
        latitude: restaurantInfo.latitude !== undefined && restaurantInfo.latitude !== null ? restaurantInfo.latitude : prev.latitude,
        longitude: restaurantInfo.longitude !== undefined && restaurantInfo.longitude !== null ? restaurantInfo.longitude : prev.longitude,
        location_initialized: restaurantInfo.location_initialized !== undefined ? restaurantInfo.location_initialized : prev.location_initialized,
        logo: prev.logo || restaurantInfo.logo || '',
        openingHours: prev.openingHours || restaurantInfo.openingHours || restaurantInfo.opening_hours || '8:00 AM - 10:30 PM',
        resto_type: prev.resto_type || restaurantInfo.resto_type || 'veg'
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
      await updateTenantSettings({
        name: formData.name.trim(),
        tagline: formData.tagline.trim(),
        phone: formData.phone.trim(),
        whatsapp_number: formData.whatsapp_number.trim() || formData.phone.trim(),
        address: fullAddr || formData.address.trim()
      }, token);

      setCurrentStep(2);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save basic details. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Auto Detect GPS Location
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('Geolocation is not supported by your browser. Please enter coordinates manually.');
      return;
    }

    setDetectingLocation(true);
    setLocationStatus('');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = parseFloat(position.coords.latitude.toFixed(6));
        const lon = parseFloat(position.coords.longitude.toFixed(6));
        setFormData(prev => ({
          ...prev,
          latitude: lat,
          longitude: lon,
          location_initialized: true
        }));
        setLocationStatus('Location detected successfully!');
        setDetectingLocation(false);
      },
      (error) => {
        setDetectingLocation(false);
        if (error.code === error.PERMISSION_DENIED) {
          setLocationStatus('Location permission denied. Please allow location access or enter coordinates manually.');
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setLocationStatus('Unable to detect your location. Please try again.');
        } else if (error.code === error.TIMEOUT) {
          setLocationStatus('Location detection timed out. Please try again.');
        } else {
          setLocationStatus('Failed to detect location. Please enter coordinates manually.');
        }
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Save Step 2
  const handleSaveStep2 = async () => {
    setSaving(true);
    setErrorMsg('');
    try {
      await updateTenantSettings({
        latitude: Number(formData.latitude),
        longitude: Number(formData.longitude),
        location_initialized: true
      }, token);

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
      await updateTenantSettings({
        logo: formData.logo,
        openingHours: formData.openingHours,
        resto_type: formData.resto_type,
        theme_color: formData.theme_color,
        location_initialized: true
      }, token);

      await completeOnboarding(token);

      setSuccessMsg('Your restaurant is ready!');
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
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6">
      <div className="w-full max-w-2xl bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-6 bg-slate-850 border-b border-slate-700 text-center relative">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-500 mb-3">
            <Store className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-white">Complete Your Restaurant Setup</h1>
          <p className="text-sm text-slate-400 mt-1">Add your basic restaurant information before continuing to your dashboard.</p>

          {/* Step Progress Indicator */}
          <div className="flex items-center justify-center gap-2 mt-6">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${currentStep === 1 ? 'bg-amber-500 text-slate-950' : 'bg-slate-700 text-slate-300'}`}>
              <span>1</span> Step 1 of 3: Basic Details
            </div>
            <div className={`w-4 h-0.5 ${currentStep >= 2 ? 'bg-amber-500' : 'bg-slate-700'}`}></div>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${currentStep === 2 ? 'bg-amber-500 text-slate-950' : 'bg-slate-700 text-slate-300'}`}>
              <span>2</span> Step 2: Location
            </div>
            <div className={`w-4 h-0.5 ${currentStep >= 3 ? 'bg-amber-500' : 'bg-slate-700'}`}></div>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${currentStep === 3 ? 'bg-amber-500 text-slate-950' : 'bg-slate-700 text-slate-300'}`}>
              <span>3</span> Step 3: Branding
            </div>
          </div>
        </div>

        {/* Global Messages */}
        {errorMsg && (
          <div className="m-6 mb-0 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="m-6 mb-0 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-sm flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span className="font-semibold">{successMsg}</span>
          </div>
        )}

        {/* Form Body */}
        <div className="p-6 sm:p-8">
          {/* STEP 1: Basic Restaurant Details */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Restaurant Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g. Royal Curry House"
                  className={`w-full px-4 py-2.5 rounded-xl bg-slate-900 border text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 ${fieldErrors.name ? 'border-rose-500' : 'border-slate-700'}`}
                />
                {fieldErrors.name && <p className="text-xs text-rose-400 mt-1">{fieldErrors.name}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Tagline</label>
                <input
                  type="text"
                  name="tagline"
                  value={formData.tagline}
                  onChange={handleChange}
                  placeholder="e.g. 100% Quality Food & Service"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Phone Number *</label>
                  <input
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="e.g. 9876543210"
                    className={`w-full px-4 py-2.5 rounded-xl bg-slate-900 border text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 ${fieldErrors.phone ? 'border-rose-500' : 'border-slate-700'}`}
                  />
                  {fieldErrors.phone && <p className="text-xs text-rose-400 mt-1">{fieldErrors.phone}</p>}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">WhatsApp Ordering Number</label>
                  <input
                    type="text"
                    name="whatsapp_number"
                    value={formData.whatsapp_number}
                    onChange={handleChange}
                    placeholder="Same as phone if empty"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Address *</label>
                <textarea
                  name="address"
                  rows={2}
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="Street address, landmark, building name..."
                  className={`w-full px-4 py-2.5 rounded-xl bg-slate-900 border text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 ${fieldErrors.address ? 'border-rose-500' : 'border-slate-700'}`}
                />
                {fieldErrors.address && <p className="text-xs text-rose-400 mt-1">{fieldErrors.address}</p>}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">City</label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    placeholder="City"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">State</label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    placeholder="State"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Pincode</label>
                  <input
                    type="text"
                    name="pincode"
                    value={formData.pincode}
                    onChange={handleChange}
                    placeholder="Pincode"
                    className={`w-full px-3 py-2 rounded-xl bg-slate-900 border text-white text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 ${fieldErrors.pincode ? 'border-rose-500' : 'border-slate-700'}`}
                  />
                  {fieldErrors.pincode && <p className="text-[10px] text-rose-400 mt-1">{fieldErrors.pincode}</p>}
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveStep1}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-semibold hover:bg-amber-400 transition-colors disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Save & Continue <ArrowRight className="w-4 h-4" /></>}
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Location */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300">
                <p className="font-semibold text-amber-200 mb-1 flex items-center gap-1.5">
                  <Navigation className="w-4 h-4" /> GPS Location Setup
                </p>
                Auto-detecting your location helps customers find your restaurant accurately. GPS permission is only requested when you click the button below.
              </div>

              <div className="text-center py-4">
                <button
                  type="button"
                  onClick={handleDetectLocation}
                  disabled={detectingLocation}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-500 transition-colors disabled:opacity-50 shadow-lg shadow-blue-600/20"
                >
                  {detectingLocation ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Detecting Coordinates...
                    </>
                  ) : (
                    <>
                      <Navigation className="w-5 h-5" />
                      Auto Detect Location
                    </>
                  )}
                </button>

                {locationStatus && (
                  <p className={`mt-3 text-xs ${locationStatus.includes('success') ? 'text-emerald-400 font-semibold' : 'text-amber-400'}`}>
                    {locationStatus}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    name="latitude"
                    value={formData.latitude}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    name="longitude"
                    value={formData.longitude}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-700 text-slate-300 font-medium hover:bg-slate-600 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button
                  type="button"
                  onClick={handleSaveStep2}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-semibold hover:bg-amber-400 transition-colors disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Save & Continue <ArrowRight className="w-4 h-4" /></>}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Branding & Basic Settings */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">Restaurant Logo</label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-2xl bg-slate-900 border border-slate-700 overflow-hidden flex items-center justify-center text-slate-500">
                    {formData.logo ? (
                      <img src={formData.logo} alt="Logo Preview" className="w-full h-full object-cover" />
                    ) : (
                      <Store className="w-8 h-8 opacity-40" />
                    )}
                  </div>
                  <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-650 text-white text-sm font-medium transition-colors">
                    {uploadingLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    Upload Logo
                    <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Opening Hours</label>
                  <input
                    type="text"
                    name="openingHours"
                    value={formData.openingHours}
                    onChange={handleChange}
                    placeholder="e.g. 8:00 AM - 10:30 PM"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Restaurant Type</label>
                  <select
                    name="resto_type"
                    value={formData.resto_type}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="veg">Pure Veg 🟢</option>
                    <option value="non_veg">Non-Veg / Both 🔴</option>
                    <option value="cafe">Cafe / Bakery ☕</option>
                    <option value="fast_food">Fast Food 🍔</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-700 text-slate-300 font-medium hover:bg-slate-600 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button
                  type="button"
                  onClick={handleCompleteSetup}
                  disabled={saving}
                  className="flex items-center gap-2 px-8 py-3 rounded-xl bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 transition-colors disabled:opacity-50 shadow-lg shadow-emerald-500/20"
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Sparkles className="w-5 h-5" /> Complete Setup</>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
