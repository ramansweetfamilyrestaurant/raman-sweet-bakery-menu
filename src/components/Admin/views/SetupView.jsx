import React, { useState, useEffect } from 'react';
import { Store, Bell, Utensils, MapPin, CreditCard, Lock, ChevronRight, Upload, Volume2, ShieldCheck, Printer, Map, Plus, Trash2, Edit, Check, X, AlertTriangle, Film, Armchair, Crown, RefreshCw, Zap, Clock, CheckCircle2, History, ArrowUpRight, ArrowDownRight, Info } from 'lucide-react';
import AdminDrawer from '../components/AdminDrawer';
import LocationPickerModal from '../../Common/LocationPickerModal';
import {
  BUSINESS_TYPES,
  FOOD_TYPES,
  SERVICE_MODELS,
  BUSINESS_TYPE_METADATA,
  FOOD_TYPE_METADATA,
  SERVICE_MODEL_METADATA,
  resolveBusinessProfile,
  resolveBannerBadge,
  resolveServiceModelForBusinessType
} from '../../../utils/businessTaxonomy';
import {
  fetchCinemaScreens,
  createCinemaScreen,
  updateCinemaScreen,
  deleteCinemaScreen,
  fetchCinemaSeats,
  batchCreateCinemaSeats,
  deleteCinemaSeat,
  fetchPaymentHistory,
  fetchSubscriptionStatus,
  fetchPublicPlans,
  cancelSubscription,
  changePlan
} from '../../../api/client';
import { CUSTOMER_MENU_THEMES, THEME_LIST, resolveTheme } from '../../../constants/themes';

export default function SetupView({
  settingsForm = {},
  setSettingsForm,
  handleSaveSettings,
  credForm = {},
  setCredForm,
  handleChangeCredentials,
  credMsg = {},
  token,
  uploadImage,
  setShowPrinterModal,
  setShowHelpModal,
  onOpenBillingModal,
  onRefreshInfo,
  readOnly = false,
  supportPhone,
  restaurantInfo,
  onNavigate,
  onOptimizeDatabase,
  initialDrawer = null
}) {
  const [settingsTab, setSettingsTab] = useState('general'); // 'general' | 'restaurant' | 'operations' | 'menu-billing' | 'security' | 'advanced'
  const [openDrawer, setOpenDrawer] = useState(initialDrawer); // 'profile', 'devices', 'menu', 'location', 'subscription', 'security', 'cinema'
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [showMapModal, setShowMapModal] = useState(false);
  const [savingForm, setSavingForm] = useState(false);

  // Subscription & Billing Management State
  const [subTab, setSubTab] = useState('overview'); // 'overview' | 'plans' | 'history'
  const [subData, setSubData] = useState(null);
  const [loadingSub, setLoadingSub] = useState(false);
  const [availablePlans, setAvailablePlans] = useState([]);
  const [paymentHistory, setPaymentHistory] = useState({ loading: false, data: [], error: null });
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [planToChange, setPlanToChange] = useState(null); // target plan object for confirmation modal
  const [actionLoading, setActionLoading] = useState(false);
  const [billingActionMsg, setBillingActionMsg] = useState(null); // { type: 'success' | 'error', text: '' }
  const [kdsPinInput, setKdsPinInput] = useState('');
  const [kdsPinMsg, setKdsPinMsg] = useState(null); // { type: 'success' | 'error', text: '' }
  const [savingKdsPin, setSavingKdsPin] = useState(false);

  const handleSaveKdsPin = async (e) => {
    if (e) e.preventDefault();
    const cleanPin = kdsPinInput.trim();
    if (!cleanPin && !restaurantInfo?.kds_pin_configured) {
      setKdsPinMsg({ type: 'error', text: 'Please enter a 4-digit numeric PIN (e.g. 1234)' });
      return;
    }
    if (cleanPin && !/^\d{4}$/.test(cleanPin)) {
      setKdsPinMsg({ type: 'error', text: 'KDS PIN must be exactly 4 numeric digits (e.g. 1234)' });
      return;
    }

    setSavingKdsPin(true);
    setKdsPinMsg(null);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ kds_pin: cleanPin })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setKdsPinMsg({
          type: 'success',
          text: cleanPin ? '✓ 4-Digit Kitchen PIN saved! Kitchen screen is now active.' : '✓ KDS PIN has been cleared and locked.'
        });
        setKdsPinInput('');
        if (onRefreshInfo) await onRefreshInfo();
      } else {
        setKdsPinMsg({
          type: 'error',
          text: data.message || data.error || 'Failed to update KDS PIN'
        });
      }
    } catch (err) {
      setKdsPinMsg({ type: 'error', text: 'Network error saving KDS PIN' });
    } finally {
      setSavingKdsPin(false);
    }
  };

  const loadSubscriptionData = async () => {
    if (!token) return;
    setLoadingSub(true);
    try {
      const data = await fetchSubscriptionStatus(token);
      if (data) {
        setSubData(data);
      }
    } catch (err) {
      console.warn('Error loading subscription status:', err);
    } finally {
      setLoadingSub(false);
    }
  };

  const loadPlansData = async () => {
    try {
      const plans = await fetchPublicPlans();
      if (Array.isArray(plans) && plans.length > 0) {
        setAvailablePlans(plans);
      }
    } catch (err) {
      console.warn('Error loading SaaS plans:', err);
    }
  };

  const loadPaymentHistoryData = async () => {
    if (!token) return;
    setPaymentHistory(prev => ({ ...prev, loading: true, error: null }));
    try {
      const res = await fetchPaymentHistory(token);
      setPaymentHistory({
        loading: false,
        data: Array.isArray(res?.payments) ? res.payments : [],
        error: null
      });
    } catch (err) {
      console.warn('Error loading payment history:', err);
      setPaymentHistory({
        loading: false,
        data: [],
        error: err.message || 'Unable to load payment history'
      });
    }
  };

  useEffect(() => {
    if (openDrawer === 'subscription') {
      loadSubscriptionData();
      loadPlansData();
      loadPaymentHistoryData();
    }
  }, [openDrawer]);

  const handleCancelAutoRenew = async () => {
    if (!token || actionLoading) return;
    setActionLoading(true);
    setBillingActionMsg(null);
    try {
      const res = await cancelSubscription(token, 'Owner requested cancellation from Admin Setup');
      if (res && res.success) {
        setBillingActionMsg({
          type: 'success',
          text: `✓ Automatic renewal turned off. Your current plan remains active until ${res.access_until ? new Date(res.access_until).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'end of current period'}.`
        });
        setShowCancelModal(false);
        await loadSubscriptionData();
        if (onRefreshInfo) await onRefreshInfo();
      } else {
        setBillingActionMsg({
          type: 'error',
          text: res?.error || res?.message || 'Failed to turn off automatic renewal.'
        });
      }
    } catch (err) {
      setBillingActionMsg({
        type: 'error',
        text: err.message || 'Server error while processing cancellation.'
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmPlanChange = async () => {
    if (!token || !planToChange || actionLoading) return;
    setActionLoading(true);
    setBillingActionMsg(null);
    try {
      const res = await changePlan(planToChange.key, token);
      if (res && res.success) {
        const isSched = res.effective === 'next_billing_cycle';
        setBillingActionMsg({
          type: 'success',
          text: isSched
            ? `✓ Plan change scheduled! ${planToChange.name} (₹${planToChange.price}/mo) will activate on ${res.effective_at ? new Date(res.effective_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'your next billing cycle'}.`
            : `✓ Plan changed immediately to ${planToChange.name}! Your trial continues unchanged.`
        });
        setPlanToChange(null);
        await loadSubscriptionData();
        if (onRefreshInfo) await onRefreshInfo();
      } else {
        setBillingActionMsg({
          type: 'error',
          text: res?.message || res?.error || 'Failed to change plan.'
        });
      }
    } catch (err) {
      setBillingActionMsg({
        type: 'error',
        text: err.message || 'Server error while requesting plan change.'
      });
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    if (initialDrawer) {
      setOpenDrawer(initialDrawer);
    }
  }, [initialDrawer]);

  // Cinema Management State
  const profile = resolveBusinessProfile(settingsForm || {});
  const isCinema = (profile?.business_type || settingsForm?.business_type) === 'cinema_theatre' || 
                   (profile?.service_model || settingsForm?.service_model) === 'cinema' ||
                   (profile?.service_model || settingsForm?.service_model) === 'seat_service';

  const [cinemaScreens, setCinemaScreens] = useState([]);
  const [cinemaSeats, setCinemaSeats] = useState([]);
  const [loadingCinema, setLoadingCinema] = useState(false);
  const [cinemaMsg, setCinemaMsg] = useState(null); // { type: 'success'|'error', text: '' }
  const [showScreenModal, setShowScreenModal] = useState(false);
  const [editingScreen, setEditingScreen] = useState(null);
  const [screenForm, setScreenForm] = useState({ screen_number: '', name: '', active: true });
  const [savingScreen, setSavingScreen] = useState(false);
  const [selectedScreenForSeats, setSelectedScreenForSeats] = useState(null);
  const [bulkSeatForm, setBulkSeatForm] = useState({ row_label: 'A', seat_start: 1, seat_end: 20 });
  const [savingSeats, setSavingSeats] = useState(false);

  const loadCinemaData = async () => {
    if (!token || !isCinema) return;
    setLoadingCinema(true);
    try {
      const [screensRes, seatsRes] = await Promise.all([
        fetchCinemaScreens(token).catch(() => ({ success: false, screens: [] })),
        fetchCinemaSeats(token).catch(() => ({ success: false, seats: [] }))
      ]);
      setCinemaScreens(screensRes?.screens || []);
      setCinemaSeats(seatsRes?.seats || []);
    } catch (err) {
      console.error('Error loading cinema data:', err);
    } finally {
      setLoadingCinema(false);
    }
  };

  useEffect(() => {
    if (isCinema && token) {
      loadCinemaData();
    }
  }, [isCinema, token]);

  const handleOpenAddScreen = () => {
    const nextNum = cinemaScreens.length > 0
      ? Math.max(...cinemaScreens.map(s => Number(s.screen_number) || 0)) + 1
      : 1;
    setEditingScreen(null);
    setScreenForm({ screen_number: String(nextNum), name: `Screen ${nextNum}`, active: true });
    setShowScreenModal(true);
    setCinemaMsg(null);
  };

  const handleOpenEditScreen = (screen) => {
    setEditingScreen(screen);
    setScreenForm({ screen_number: String(screen.screen_number), name: screen.name || `Screen ${screen.screen_number}`, active: screen.active !== false });
    setShowScreenModal(true);
    setCinemaMsg(null);
  };

  const handleSaveScreen = async (e) => {
    if (e) e.preventDefault();
    if (savingScreen) return;
    const num = parseInt(screenForm.screen_number, 10);
    if (!editingScreen && (isNaN(num) || num <= 0)) {
      setCinemaMsg({ type: 'error', text: 'Please enter a valid positive screen number.' });
      return;
    }
    if (!screenForm.name || !screenForm.name.trim()) {
      setCinemaMsg({ type: 'error', text: 'Please enter a screen name.' });
      return;
    }

    setSavingScreen(true);
    setCinemaMsg(null);
    try {
      if (editingScreen) {
        await updateCinemaScreen(token, editingScreen.id, {
          name: screenForm.name.trim(),
          active: Boolean(screenForm.active)
        });
        setCinemaMsg({ type: 'success', text: `Screen ${editingScreen.screen_number} updated successfully.` });
      } else {
        await createCinemaScreen(token, {
          screen_number: num,
          name: screenForm.name.trim()
        });
        setCinemaMsg({ type: 'success', text: `Screen ${num} created successfully.` });
      }
      setShowScreenModal(false);
      await loadCinemaData();
    } catch (err) {
      const errMsg = err?.message || 'Failed to save cinema screen';
      setCinemaMsg({ type: 'error', text: errMsg });
    } finally {
      setSavingScreen(false);
    }
  };

  const handleDeleteScreen = async (screen) => {
    if (!window.confirm(`Delete Screen ${screen.screen_number} (${screen.name})?\n\nAll seats configured under this screen will also be removed.`)) {
      return;
    }
    try {
      await deleteCinemaScreen(token, screen.id);
      if (selectedScreenForSeats && selectedScreenForSeats.id === screen.id) {
        setSelectedScreenForSeats(null);
      }
      setCinemaMsg({ type: 'success', text: `Screen ${screen.screen_number} and all its seats deleted.` });
      await loadCinemaData();
    } catch (err) {
      setCinemaMsg({ type: 'error', text: err?.message || 'Failed to delete screen' });
    }
  };

  const handleBatchCreateSeats = async (e) => {
    if (e) e.preventDefault();
    if (savingSeats || !selectedScreenForSeats) return;
    const row = String(bulkSeatForm.row_label || '').trim().toUpperCase();
    const start = parseInt(bulkSeatForm.seat_start, 10);
    const end = parseInt(bulkSeatForm.seat_end, 10);

    if (!row || !/^[A-Z]{1,2}$/.test(row)) {
      setCinemaMsg({ type: 'error', text: 'Row label must be a letter (e.g. A, B, AA).' });
      return;
    }
    if (isNaN(start) || isNaN(end) || start < 1 || end < start || end > 100) {
      setCinemaMsg({ type: 'error', text: 'Valid seat range is 1 to 100.' });
      return;
    }

    setSavingSeats(true);
    setCinemaMsg(null);
    try {
      const res = await batchCreateCinemaSeats(token, {
        screen_id: selectedScreenForSeats.id,
        row_label: row,
        seat_start: start,
        seat_end: end
      });
      setCinemaMsg({ type: 'success', text: res?.message || `Configured Row ${row} seats ${start} to ${end}.` });
      await loadCinemaData();
    } catch (err) {
      setCinemaMsg({ type: 'error', text: err?.message || 'Failed to configure seats' });
    } finally {
      setSavingSeats(false);
    }
  };

  const handleDeleteSeat = async (seat) => {
    if (!window.confirm(`Delete Seat ${seat.seat_code}?\n\nExisting printed QR standees for this seat will no longer be valid for ordering.`)) {
      return;
    }
    try {
      await deleteCinemaSeat(token, seat.id);
      setCinemaMsg({ type: 'success', text: `Seat ${seat.seat_code} deleted.` });
      await loadCinemaData();
    } catch (err) {
      setCinemaMsg({ type: 'error', text: err?.message || 'Failed to delete seat' });
    }
  };

  const handleFormSave = async (e) => {
    if (e) e.preventDefault();
    if (savingForm) return;
    setSavingForm(true);
    try {
      await handleSaveSettings();
      setSaveSuccessMsg('✅ Settings saved successfully!');
      setTimeout(() => setSaveSuccessMsg(''), 3000);
      setOpenDrawer(null);
    } catch (err) {
      // Alert already triggered by handleSaveSettings
    } finally {
      setSavingForm(false);
    }
  };

  const handleSecuritySave = async (e) => {
    if (e) e.preventDefault();
    await handleChangeCredentials();
    if (credMsg?.type === 'success') {
      setTimeout(() => setOpenDrawer(null), 1500);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const url = await uploadImage(file, token, 'logos');
      if (url && setSettingsForm) {
        setSettingsForm(prev => ({ ...prev, logo: url }));
      }
    } catch (err) {
      alert('Logo upload failed: ' + err.message);
    } finally {
      setUploadingLogo(false);
    }
  };

  const [gpsSuccessMsg, setGpsSuccessMsg] = useState('');
  const [gpsErrorState, setGpsErrorState] = useState(null); // { title, msg, isDenied }

  const handleDetectGps = async () => {
    setGpsSuccessMsg('');
    setGpsErrorState(null);

    // Step 1: Check if geolocation API exists
    if (!navigator.geolocation) {
      setGpsErrorState({
        title: '❌ GPS Not Supported',
        msg: 'Unable to detect location. Browser does not support geolocation.',
        isDenied: false
      });
      return;
    }

    // Step 2: Check secure context (HTTPS required for geolocation)
    if (window.isSecureContext === false) {
      setGpsErrorState({
        title: '🔒 HTTPS Required',
        msg: 'HTTPS is required for browser location detection. Please access via https:// URL.',
        isDenied: false
      });
      return;
    }

    // Step 3: Check permission status if Permissions API available
    if (navigator.permissions) {
      try {
        const permStatus = await navigator.permissions.query({ name: 'geolocation' });
        if (permStatus.state === 'denied') {
          setGpsErrorState({
            title: '🔒 Location permission is blocked',
            msg: 'Allow Location access for this site in your browser settings.',
            isDenied: true
          });
          return;
        }
      } catch (e) {
        // Permissions API not fully supported, continue to getCurrentPosition
      }
    }

    // Step 4: High-Accuracy REAL GPS Location Request (maximumAge: 0, enableHighAccuracy: true)
    setGpsLoading(true);

    let bestReading = null;
    let samplesCount = 0;
    let watchId = null;

    const finalizeLocation = (position) => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }

      setGpsLoading(false);

      if (!position || !position.coords) {
        setGpsErrorState({
          title: '❌ Location Error',
          msg: 'Unable to detect your location. Please try again.',
          isDenied: false
        });
        return;
      }

      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const accuracy = position.coords.accuracy || 999;

      // Debug Log
      console.log('[LOCATION DEBUG]', {
        lat,
        lng,
        accuracy: `${Math.round(accuracy)}m`,
        altitude: position.coords.altitude,
        heading: position.coords.heading,
        speed: position.coords.speed,
        timestamp: new Date(position.timestamp).toISOString()
      });

      // Validate Coordinate Boundaries (-90 <= lat <= 90, -180 <= lng <= 180)
      if (typeof lat !== 'number' || typeof lng !== 'number' || lat < -90 || lat > 90 || lng < -180 || lng > 180 || isNaN(lat) || isNaN(lng)) {
        setGpsErrorState({
          title: '❌ Invalid Coordinates',
          msg: 'Detected coordinates are invalid. Please try again.',
          isDenied: false
        });
        return;
      }

      // Preserve full float precision in state
      if (setSettingsForm) {
        setSettingsForm(prev => ({
          ...prev,
          latitude: lat,
          longitude: lng,
          location_initialized: true
        }));
      }

      if (accuracy <= 50) {
        setGpsSuccessMsg(`✓ GPS Location captured (Accuracy: ±${Math.round(accuracy)}m)`);
      } else {
        setGpsSuccessMsg(`✓ Location detected (Accuracy: ±${Math.round(accuracy)}m). Fine-tune pin on map if needed.`);
      }

      setTimeout(() => setGpsSuccessMsg(''), 7000);
    };

    const handleGpsError = (err) => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }

      setGpsLoading(false);

      if (bestReading) {
        // Use best reading collected so far if available
        finalizeLocation(bestReading);
        return;
      }

      if (err.code === 1) {
        // PERMISSION_DENIED
        setGpsErrorState({
          title: '🔒 Location permission is blocked',
          msg: 'Allow Location access for this site in your browser settings.',
          isDenied: true
        });
      } else if (err.code === 2) {
        // POSITION_UNAVAILABLE
        setGpsErrorState({
          title: '📍 Location is turned off',
          msg: 'Please turn on Location/GPS on your device and try again.',
          isDenied: false
        });
      } else if (err.code === 3) {
        // TIMEOUT
        setGpsErrorState({
          title: '⏱️ Location Timeout',
          msg: 'Unable to get an accurate location right now. Make sure Location is ON and move to an open area.',
          isDenied: false
        });
      } else {
        setGpsErrorState({
          title: '❌ Location Error',
          msg: 'Unable to detect your location. Please try again.',
          isDenied: false
        });
      }
    };

    // Primary High Accuracy Attempt
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        bestReading = pos;
        if (pos.coords.accuracy <= 50) {
          finalizeLocation(pos);
        } else {
          // If initial reading accuracy > 50m, sample for up to 4 seconds to pick the best reading
          const startTime = Date.now();
          watchId = navigator.geolocation.watchPosition(
            (watchPos) => {
              samplesCount++;
              if (!bestReading || watchPos.coords.accuracy < bestReading.coords.accuracy) {
                bestReading = watchPos;
              }
              if (watchPos.coords.accuracy <= 50 || (Date.now() - startTime) >= 4000) {
                finalizeLocation(bestReading);
              }
            },
            () => {
              finalizeLocation(bestReading);
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
          );

          // Force finalize after 4 seconds max if watchPosition stays open
          setTimeout(() => {
            if (watchId !== null) {
              finalizeLocation(bestReading);
            }
          }, 4500);
        }
      },
      handleGpsError,
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
    );
  };

  const testAlarmSound = () => {
    try {
      const audio = new Audio('/assets/emergency_alarm.mp3');
      audio.play().catch(() => {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      });
      alert('🔊 Playing Test Siren Ringtone!');
    } catch (e) {
      alert('Audio alert triggered');
    }
  };

  const requestPushPermission = () => {
    if ('Notification' in window) {
      Notification.requestPermission().then(perm => {
        alert(`Push Notifications Permission: ${perm.toUpperCase()}`);
      });
    } else {
      alert('Push notifications not supported on this browser.');
    }
  };

  const isProfileConfigured = Boolean(settingsForm?.name && (settingsForm?.phone || restaurantInfo?.phone));
  const isLogoConfigured = Boolean(settingsForm?.logo || restaurantInfo?.logo);
  const isGpsConfigured = Boolean(settingsForm?.latitude && settingsForm?.longitude);
  const isSecurityConfigured = true;

  const totalChecks = 4;
  const passedChecks = [isProfileConfigured, isLogoConfigured, isGpsConfigured, isSecurityConfigured].filter(Boolean).length;
  const isFullySetup = passedChecks === totalChecks;

  const showAll = settingsTab === 'general';
  const showRestaurant = showAll || settingsTab === 'restaurant';
  const showOperations = showAll || settingsTab === 'operations';
  const showMenuBilling = showAll || settingsTab === 'menu-billing';
  const showSecurity = showAll || settingsTab === 'security';
  const showAdvanced = showAll || settingsTab === 'advanced';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      maxWidth: '1400px',
      margin: '0 auto',
      width: '100%',
      boxSizing: 'border-box',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    }}>
      <style>{`
        .settings-header-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 14px;
          background: #FFFFFF;
          border-radius: 16px;
          border: 1px solid #EAE5DF;
          padding: 16px 22px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.02);
        }
        .settings-tabs-scroll {
          display: flex;
          align-items: center;
          gap: 8px;
          overflow-x: auto;
          padding-bottom: 2px;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
        }
        .settings-tabs-scroll::-webkit-scrollbar {
          display: none;
        }
        .settings-tab-btn {
          padding: 8px 18px;
          border-radius: 10px;
          border: 1px solid #EAE5DF;
          background: #FFFFFF;
          color: #475569;
          font-size: 0.80rem;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.15s ease;
        }
        .settings-tab-btn.active {
          border-color: #261B14;
          background: #261B14;
          color: #FFFFFF;
          box-shadow: 0 2px 6px rgba(38, 27, 20, 0.15);
        }
        .settings-tab-btn:hover:not(.active) {
          border-color: #CBD5E1;
          background: #F8FAFC;
          color: #0F172A;
        }
        .settings-top-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }
        .quick-actions-2x2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .quick-action-item {
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 14px;
          background: #FAF8F5;
          border: 1px solid #EAE5DF;
          border-radius: 12px;
          transition: all 0.15s ease;
          text-align: left;
        }
        .quick-action-item:hover {
          background: #FFFFFF;
          border-color: #FF5A1F;
          transform: translateY(-1px);
          box-shadow: 0 4px 10px rgba(255, 90, 31, 0.06);
        }
        .frequently-used-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
        }
        .more-settings-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 12px;
        }
        .settings-card-primary {
          cursor: pointer;
          background: #FFFFFF;
          border-radius: 16px;
          border: 1px solid #EAE5DF;
          padding: 18px 16px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 14px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.02);
          transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .settings-card-primary:hover {
          border-color: #FF5A1F;
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(255, 90, 31, 0.08);
        }
        .settings-card-secondary {
          cursor: pointer;
          background: #FFFFFF;
          border-radius: 14px;
          border: 1px solid #EAE5DF;
          padding: 14px 14px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 10px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.02);
          transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .settings-card-secondary:hover {
          border-color: #FF5A1F;
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(255, 90, 31, 0.08);
        }
        .tab-content-grid-3col {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 14px;
        }
        @media (max-width: 1200px) {
          .frequently-used-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .more-settings-grid {
            grid-template-columns: repeat(3, 1fr) !important;
          }
        }
        @media (max-width: 768px) {
          .settings-top-grid {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }
          .quick-actions-2x2 {
            grid-template-columns: 1fr 1fr !important;
            gap: 8px !important;
          }
          .frequently-used-grid {
            grid-template-columns: 1fr !important;
            gap: 10px !important;
          }
          .more-settings-grid {
            grid-template-columns: 1fr !important;
            gap: 10px !important;
          }
          .settings-header-card {
            padding: 14px 16px !important;
          }
        }
      `}</style>

      {/* ========================================================
          1. MASTER PAGE HEADER WITH PROGRESS INDICATOR
         ======================================================== */}
      <div className="settings-header-card">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '1.22rem', fontWeight: 900, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
              Settings & Setup
            </h2>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              background: '#DCFCE7',
              color: '#16A34A',
              fontSize: '0.68rem',
              fontWeight: 800,
              padding: '3px 9px',
              borderRadius: '12px',
              border: '1px solid #BBF7D0'
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#16A34A' }} />
              All systems ready
            </span>
          </div>
          <p style={{ fontSize: '0.76rem', color: '#64748B', margin: '3px 0 0 0', fontWeight: 500 }}>
            Manage your restaurant, menu preferences, operations, security and account.
          </p>
        </div>

        {/* Right Side: Setup Progress Indicator */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: '#FAF8F5',
          padding: '8px 14px',
          borderRadius: '12px',
          border: '1px solid #EAE5DF'
        }}>
          <div style={{ position: 'relative', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="32" height="32" viewBox="0 0 36 36">
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="#E2E8F0"
                strokeWidth="3.5"
              />
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="#16A34A"
                strokeWidth="3.5"
                strokeDasharray={`${(passedChecks / totalChecks) * 100}, 100`}
                strokeLinecap="round"
              />
            </svg>
            <Check size={14} color="#16A34A" style={{ position: 'absolute' }} />
          </div>
          <div>
            <div style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 600 }}>Setup Progress</div>
            <div style={{ fontSize: '0.86rem', fontWeight: 900, color: '#0F172A' }}>
              {passedChecks} / {totalChecks} Complete
            </div>
          </div>
        </div>
      </div>

      {saveSuccessMsg && (
        <div style={{
          background: '#DCFCE7',
          color: '#15803D',
          border: '1px solid #86EFAC',
          padding: '10px 16px',
          borderRadius: '12px',
          fontSize: '0.82rem',
          fontWeight: 800,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle2 size={16} />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* ========================================================
          2. CONTEXTUAL SETTINGS NAVIGATION TABS
         ======================================================== */}
      <div className="settings-tabs-scroll">
        {[
          { id: 'general', label: 'General' },
          { id: 'restaurant', label: 'Restaurant' },
          { id: 'operations', label: 'Operations' },
          { id: 'menu-billing', label: 'Menu & Billing' },
          { id: 'security', label: 'Security' },
          { id: 'advanced', label: 'Advanced' }
        ].map(tab => {
          const isActive = settingsTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSettingsTab(tab.id)}
              className={`settings-tab-btn ${isActive ? 'active' : ''}`}
            >
              {isActive && (
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#FF5A1F' }} />
              )}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================
          3. TAB VIEW 1: GENERAL (CURATED DASHBOARD OVERVIEW)
         ======================================================== */}
      {settingsTab === 'general' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {/* TOP ROW: QUICK ACTIONS (LEFT) + RESTAURANT HEALTH (RIGHT) */}
          <div className="settings-top-grid">
            {/* LEFT: Quick Actions */}
            <div style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #EAE5DF',
              padding: '16px 18px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Zap size={16} color="#FF5A1F" />
                <strong style={{ fontSize: '0.86rem', color: '#0F172A', fontWeight: 800 }}>Quick Actions</strong>
              </div>

              <div className="quick-actions-2x2">
                {/* Action 1: Edit Profile */}
                <div className="quick-action-item" onClick={() => setOpenDrawer('profile')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: '#FFF4EE', color: '#FF5A1F', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Store size={16} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <strong style={{ fontSize: '0.78rem', color: '#0F172A', fontWeight: 800, display: 'block' }}>Edit Profile</strong>
                      <span style={{ fontSize: '0.68rem', color: '#64748B', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Update info</span>
                    </div>
                  </div>
                  <ChevronRight size={14} color="#94A3B8" />
                </div>

                {/* Action 2: GST & Currency */}
                <div className="quick-action-item" onClick={() => setOpenDrawer('menu')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: '#FFF4EE', color: '#FF5A1F', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Utensils size={16} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <strong style={{ fontSize: '0.78rem', color: '#0F172A', fontWeight: 800, display: 'block' }}>GST & Currency</strong>
                      <span style={{ fontSize: '0.68rem', color: '#64748B', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Configure tax</span>
                    </div>
                  </div>
                  <ChevronRight size={14} color="#94A3B8" />
                </div>

                {/* Action 3: Test Order Alert */}
                <div className="quick-action-item" onClick={testAlarmSound}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: '#E0F2FE', color: '#0284C7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Bell size={16} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <strong style={{ fontSize: '0.78rem', color: '#0F172A', fontWeight: 800, display: 'block' }}>Test Order Alert</strong>
                      <span style={{ fontSize: '0.68rem', color: '#64748B', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Test sound</span>
                    </div>
                  </div>
                  <ChevronRight size={14} color="#94A3B8" />
                </div>

                {/* Action 4: Generate QR */}
                <div className="quick-action-item" onClick={() => onNavigate && onNavigate('qr-generator')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: '#DCFCE7', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Printer size={16} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <strong style={{ fontSize: '0.78rem', color: '#0F172A', fontWeight: 800, display: 'block' }}>Generate QR</strong>
                      <span style={{ fontSize: '0.68rem', color: '#64748B', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Table standees</span>
                    </div>
                  </div>
                  <ChevronRight size={14} color="#94A3B8" />
                </div>
              </div>
            </div>

            {/* RIGHT: Restaurant Health Card */}
            <div style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #EAE5DF',
              padding: '16px 18px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldCheck size={16} color="#16A34A" />
                  <strong style={{ fontSize: '0.86rem', color: '#0F172A', fontWeight: 800 }}>Restaurant Health</strong>
                </div>
                <p style={{ fontSize: '0.72rem', color: '#64748B', margin: '2px 0 0 0' }}>
                  All core settings are configured and ready.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: isProfileConfigured ? '#15803D' : '#64748B', fontWeight: isProfileConfigured ? 700 : 500 }}>
                  <span style={{ width: '16px', height: '16px', borderRadius: '50%', background: isProfileConfigured ? '#DCFCE7' : '#F1F5F9', color: isProfileConfigured ? '#16A34A' : '#94A3B8', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.68rem', fontWeight: 900 }}>✓</span>
                  <span>Business Profile</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: isGpsConfigured ? '#15803D' : '#64748B', fontWeight: isGpsConfigured ? 700 : 500 }}>
                  <span style={{ width: '16px', height: '16px', borderRadius: '50%', background: isGpsConfigured ? '#DCFCE7' : '#F1F5F9', color: isGpsConfigured ? '#16A34A' : '#94A3B8', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.68rem', fontWeight: 900 }}>✓</span>
                  <span>Location & GPS</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: isLogoConfigured ? '#15803D' : '#64748B', fontWeight: isLogoConfigured ? 700 : 500 }}>
                  <span style={{ width: '16px', height: '16px', borderRadius: '50%', background: isLogoConfigured ? '#DCFCE7' : '#F1F5F9', color: isLogoConfigured ? '#16A34A' : '#94A3B8', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.68rem', fontWeight: 900 }}>✓</span>
                  <span>Restaurant Logo</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#15803D', fontWeight: 700 }}>
                  <span style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#DCFCE7', color: '#16A34A', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.68rem', fontWeight: 900 }}>✓</span>
                  <span>Order Alerts</span>
                </div>
              </div>

              <div style={{ fontSize: '0.72rem', color: '#16A34A', fontWeight: 700, background: '#F0FDF4', padding: '6px 10px', borderRadius: '8px', border: '1px solid #DCFCE7', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>Your restaurant is ready to go 🎉</span>
              </div>
            </div>
          </div>

          {/* MIDDLE: FREQUENTLY USED (4-COLUMN GRID) */}
          <div>
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#FF5A1F', fontSize: '0.9rem' }}>⭐</span>
                <strong style={{ fontSize: '0.92rem', color: '#0F172A', fontWeight: 800 }}>Frequently Used</strong>
              </div>
              <span style={{ fontSize: '0.74rem', color: '#64748B' }}>Quick access to the most important settings</span>
            </div>

            <div className="frequently-used-grid">
              {/* Card 1: Business Profile */}
              <div className="settings-card-primary" onClick={() => setOpenDrawer('profile')}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#FFF4EE', color: '#FF5A1F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Store size={20} />
                </div>
                <div>
                  <strong style={{ fontSize: '0.92rem', color: '#0F172A', fontWeight: 800, display: 'block', marginBottom: '4px' }}>Business Profile</strong>
                  <span style={{ fontSize: '0.74rem', color: '#64748B', lineHeight: 1.4, display: 'block' }}>
                    Restaurant name, logo, contact details and address
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '6px' }}>
                  <span style={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    padding: '3px 8px',
                    borderRadius: '6px',
                    background: '#DCFCE7',
                    color: '#15803D',
                    border: '1px solid #BBF7D0'
                  }}>
                    Configured
                  </span>
                  <ChevronRight size={16} color="#94A3B8" />
                </div>
              </div>

              {/* Card 2: Menu Preferences */}
              <div className="settings-card-primary" onClick={() => setOpenDrawer('menu')}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#FFF4EE', color: '#FF5A1F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Utensils size={20} />
                </div>
                <div>
                  <strong style={{ fontSize: '0.92rem', color: '#0F172A', fontWeight: 800, display: 'block', marginBottom: '4px' }}>Menu Preferences</strong>
                  <span style={{ fontSize: '0.74rem', color: '#64748B', lineHeight: 1.4, display: 'block' }}>
                    Currency, GST, categories, menu display and more
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '6px' }}>
                  <span style={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    padding: '3px 8px',
                    borderRadius: '6px',
                    background: '#DCFCE7',
                    color: '#15803D',
                    border: '1px solid #BBF7D0'
                  }}>
                    Configured
                  </span>
                  <ChevronRight size={16} color="#94A3B8" />
                </div>
              </div>

              {/* Card 3: Orders & Devices */}
              <div className="settings-card-primary" onClick={() => setOpenDrawer('devices')}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#E0F2FE', color: '#0284C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Bell size={20} />
                </div>
                <div>
                  <strong style={{ fontSize: '0.92rem', color: '#0F172A', fontWeight: 800, display: 'block', marginBottom: '4px' }}>Orders & Devices</strong>
                  <span style={{ fontSize: '0.74rem', color: '#64748B', lineHeight: 1.4, display: 'block' }}>
                    Order alerts, devices, printers and notifications
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '6px' }}>
                  <span style={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    padding: '3px 8px',
                    borderRadius: '6px',
                    background: '#E0F2FE',
                    color: '#0284C7',
                    border: '1px solid #BAE6FD'
                  }}>
                    Connected
                  </span>
                  <ChevronRight size={16} color="#94A3B8" />
                </div>
              </div>

              {/* Card 4: Billing & Subscription */}
              <div className="settings-card-primary" onClick={() => setOpenDrawer('subscription')}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#DCFCE7', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CreditCard size={20} />
                </div>
                <div>
                  <strong style={{ fontSize: '0.92rem', color: '#0F172A', fontWeight: 800, display: 'block', marginBottom: '4px' }}>Billing & Subscription</strong>
                  <span style={{ fontSize: '0.74rem', color: '#64748B', lineHeight: 1.4, display: 'block' }}>
                    Current plan, invoices, usage and upgrades
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '6px' }}>
                  <span style={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    padding: '3px 8px',
                    borderRadius: '6px',
                    background: '#DCFCE7',
                    color: '#16A34A',
                    border: '1px solid #BBF7D0'
                  }}>
                    Active Plan
                  </span>
                  <ChevronRight size={16} color="#94A3B8" />
                </div>
              </div>
            </div>
          </div>

          {/* BOTTOM: MORE SETTINGS (5-COLUMN GRID) */}
          <div>
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.9rem' }}>⚙️</span>
                <strong style={{ fontSize: '0.92rem', color: '#0F172A', fontWeight: 800 }}>More Settings</strong>
              </div>
              <span style={{ fontSize: '0.74rem', color: '#64748B' }}>Additional settings and tools for your restaurant</span>
            </div>

            <div className="more-settings-grid">
              {/* More 1: Location & GPS */}
              <div className="settings-card-secondary" onClick={() => setOpenDrawer('location')}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#DCFCE7', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MapPin size={18} />
                </div>
                <div>
                  <strong style={{ fontSize: '0.84rem', color: '#0F172A', fontWeight: 800, display: 'block', marginBottom: '2px' }}>Location & GPS</strong>
                  <span style={{ fontSize: '0.70rem', color: '#64748B', lineHeight: 1.35, display: 'block' }}>
                    Manage location, geofence and presence
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '2px 7px', borderRadius: '5px', background: '#DCFCE7', color: '#15803D', border: '1px solid #BBF7D0' }}>
                    Connected
                  </span>
                </div>
              </div>

              {/* More 2: QR Standees */}
              <div className="settings-card-secondary" onClick={() => onNavigate && onNavigate('qr-generator')}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Printer size={18} />
                </div>
                <div>
                  <strong style={{ fontSize: '0.84rem', color: '#0F172A', fontWeight: 800, display: 'block', marginBottom: '2px' }}>QR Standees</strong>
                  <span style={{ fontSize: '0.70rem', color: '#64748B', lineHeight: 1.35, display: 'block' }}>
                    Generate & manage QR table codes
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '2px 7px', borderRadius: '5px', background: '#FEF3C7', color: '#D97706', border: '1px solid #FDE68A' }}>
                    Ready
                  </span>
                </div>
              </div>

              {/* More 3: Security & Credentials */}
              <div className="settings-card-secondary" onClick={() => setOpenDrawer('security')}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#FEE2E2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Lock size={18} />
                </div>
                <div>
                  <strong style={{ fontSize: '0.84rem', color: '#0F172A', fontWeight: 800, display: 'block', marginBottom: '2px' }}>Security</strong>
                  <span style={{ fontSize: '0.70rem', color: '#64748B', lineHeight: 1.35, display: 'block' }}>
                    Admin login, password and protection
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '2px 7px', borderRadius: '5px', background: '#FEE2E2', color: '#DC2626', border: '1px solid #FECACA' }}>
                    Secure
                  </span>
                </div>
              </div>

              {/* More 4: Reviews & AI */}
              <div className="settings-card-secondary" onClick={() => onNavigate && onNavigate('review')}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#F3E8FF', color: '#7E22CE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <strong style={{ fontSize: '0.84rem', color: '#0F172A', fontWeight: 800, display: 'block', marginBottom: '2px' }}>Reviews & AI</strong>
                  <span style={{ fontSize: '0.70rem', color: '#64748B', lineHeight: 1.35, display: 'block' }}>
                    Google reviews and AI reply assistant
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '2px 7px', borderRadius: '5px', background: '#F3E8FF', color: '#7E22CE', border: '1px solid #E9D5FF' }}>
                    Connected
                  </span>
                </div>
              </div>

              {/* More 5: Database Tools */}
              <div className="settings-card-secondary" onClick={() => onOptimizeDatabase && onOptimizeDatabase()}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#DCFCE7', color: '#15803D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Upload size={18} />
                </div>
                <div>
                  <strong style={{ fontSize: '0.84rem', color: '#0F172A', fontWeight: 800, display: 'block', marginBottom: '2px' }}>Database Tools</strong>
                  <span style={{ fontSize: '0.70rem', color: '#64748B', lineHeight: 1.35, display: 'block' }}>
                    Database health, cleanup and optimization
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '2px 7px', borderRadius: '5px', background: '#DCFCE7', color: '#15803D', border: '1px solid #BBF7D0' }}>
                    Optimized
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          4. TAB VIEW 2: RESTAURANT
         ======================================================== */}
      {settingsTab === 'restaurant' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: '0 0 2px 0' }}>
              🏪 Restaurant Settings
            </h3>
            <span style={{ fontSize: '0.76rem', color: '#64748B' }}>
              Manage your business profile, branding logo, physical address and customer location geofence.
            </span>
          </div>

          <div className="tab-content-grid-3col">
            {/* Card 1: Business Profile */}
            <div className="settings-card-primary" onClick={() => setOpenDrawer('profile')}>
              <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#FFF4EE', color: '#FF5A1F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Store size={22} />
              </div>
              <div>
                <strong style={{ fontSize: '0.94rem', color: '#0F172A', fontWeight: 800, display: 'block', marginBottom: '4px' }}>Business Profile</strong>
                <span style={{ fontSize: '0.76rem', color: '#64748B', lineHeight: 1.45, display: 'block' }}>
                  Restaurant business name, contact phone number, address, and FSSAI license details.
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '6px' }}>
                <span style={{ fontSize: '0.70rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', background: isProfileConfigured ? '#DCFCE7' : '#FEF3C7', color: isProfileConfigured ? '#15803D' : '#D97706', border: isProfileConfigured ? '1px solid #BBF7D0' : '1px solid #FDE68A' }}>
                  {isProfileConfigured ? 'Configured' : 'Needs Attention'}
                </span>
                <span style={{ fontSize: '0.78rem', color: '#FF5A1F', fontWeight: 700 }}>Edit Profile →</span>
              </div>
            </div>

            {/* Card 2: Restaurant Logo & Branding */}
            <div className="settings-card-primary" onClick={() => setOpenDrawer('profile')}>
              <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#FFF4EE', color: '#FF5A1F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Upload size={22} />
              </div>
              <div>
                <strong style={{ fontSize: '0.94rem', color: '#0F172A', fontWeight: 800, display: 'block', marginBottom: '4px' }}>Restaurant Logo & Banner</strong>
                <span style={{ fontSize: '0.76rem', color: '#64748B', lineHeight: 1.45, display: 'block' }}>
                  Upload your official restaurant logo icon and high-resolution header banner.
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '6px' }}>
                <span style={{ fontSize: '0.70rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', background: isLogoConfigured ? '#DCFCE7' : '#FEF3C7', color: isLogoConfigured ? '#15803D' : '#D97706', border: isLogoConfigured ? '1px solid #BBF7D0' : '1px solid #FDE68A' }}>
                  {isLogoConfigured ? 'Logo Active' : 'No Logo'}
                </span>
                <span style={{ fontSize: '0.78rem', color: '#FF5A1F', fontWeight: 700 }}>Manage Logo →</span>
              </div>
            </div>

            {/* Card 3: Location & GPS Geofence */}
            <div className="settings-card-primary" onClick={() => setOpenDrawer('location')}>
              <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#DCFCE7', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MapPin size={22} />
              </div>
              <div>
                <strong style={{ fontSize: '0.94rem', color: '#0F172A', fontWeight: 800, display: 'block', marginBottom: '4px' }}>Location & GPS Geofence</strong>
                <span style={{ fontSize: '0.76rem', color: '#64748B', lineHeight: 1.45, display: 'block' }}>
                  Set physical GPS coordinates and customer presence verification radius.
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '6px' }}>
                <span style={{ fontSize: '0.70rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', background: isGpsConfigured ? '#DCFCE7' : '#FEF3C7', color: isGpsConfigured ? '#15803D' : '#D97706', border: isGpsConfigured ? '1px solid #BBF7D0' : '1px solid #FDE68A' }}>
                  {isGpsConfigured ? 'GPS Active' : 'Setup Required'}
                </span>
                <span style={{ fontSize: '0.78rem', color: '#16A34A', fontWeight: 700 }}>Configure GPS →</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          5. TAB VIEW 3: OPERATIONS
         ======================================================== */}
      {settingsTab === 'operations' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: '0 0 2px 0' }}>
              ⚙️ Operations & Devices
            </h3>
            <span style={{ fontSize: '0.76rem', color: '#64748B' }}>
              Manage incoming order siren sounds, notifications, thermal receipt printers, and table standees.
            </span>
          </div>

          <div className="tab-content-grid-3col">
            {/* Card 1: Orders & Devices */}
            <div className="settings-card-primary" onClick={() => setOpenDrawer('devices')}>
              <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#E0F2FE', color: '#0284C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bell size={22} />
              </div>
              <div>
                <strong style={{ fontSize: '0.94rem', color: '#0F172A', fontWeight: 800, display: 'block', marginBottom: '4px' }}>Order Siren & Notifications</strong>
                <span style={{ fontSize: '0.76rem', color: '#64748B', lineHeight: 1.45, display: 'block' }}>
                  Swiggy/Zomato style order alarm, volume adjustment, browser and push alerts.
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '6px' }}>
                <span style={{ fontSize: '0.70rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', background: '#E0F2FE', color: '#0284C7', border: '1px solid #BAE6FD' }}>
                  Alerts Enabled
                </span>
                <span style={{ fontSize: '0.78rem', color: '#0284C7', fontWeight: 700 }}>Device Settings →</span>
              </div>
            </div>

            {/* Card 2: QR Standees & Table Stickers */}
            <div className="settings-card-primary" onClick={() => onNavigate && onNavigate('qr-generator')}>
              <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Printer size={22} />
              </div>
              <div>
                <strong style={{ fontSize: '0.94rem', color: '#0F172A', fontWeight: 800, display: 'block', marginBottom: '4px' }}>QR Standees & Table Stickers</strong>
                <span style={{ fontSize: '0.76rem', color: '#64748B', lineHeight: 1.45, display: 'block' }}>
                  Generate and print high-resolution QR table standees, tent cards, and stickers.
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '6px' }}>
                <span style={{ fontSize: '0.70rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', background: '#FEF3C7', color: '#D97706', border: '1px solid #FDE68A' }}>
                  Ready to Print
                </span>
                <span style={{ fontSize: '0.78rem', color: '#D97706', fontWeight: 700 }}>Open Generator →</span>
              </div>
            </div>

            {/* Card 3: Thermal Receipt Printer */}
            <div className="settings-card-primary" onClick={() => setShowPrinterModal ? setShowPrinterModal(true) : setOpenDrawer('devices')}>
              <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#DCFCE7', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Printer size={22} />
              </div>
              <div>
                <strong style={{ fontSize: '0.94rem', color: '#0F172A', fontWeight: 800, display: 'block', marginBottom: '4px' }}>Thermal POS Printer</strong>
                <span style={{ fontSize: '0.76rem', color: '#64748B', lineHeight: 1.45, display: 'block' }}>
                  Configure 58mm/80mm thermal receipt printer, Bluetooth & USB direct printing.
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '6px' }}>
                <span style={{ fontSize: '0.70rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', background: '#DCFCE7', color: '#16A34A', border: '1px solid #BBF7D0' }}>
                  Connected
                </span>
                <span style={{ fontSize: '0.78rem', color: '#16A34A', fontWeight: 700 }}>Configure Printer →</span>
              </div>
            </div>

            {/* Cinema Card if active */}
            {isCinema && (
              <div className="settings-card-primary" onClick={() => setOpenDrawer('cinema')} style={{ borderColor: '#0284C7', background: '#F0F9FF' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#E0F2FE', color: '#0284C7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem' }}>
                  🎬
                </div>
                <div>
                  <strong style={{ fontSize: '0.94rem', color: '#0F172A', fontWeight: 800, display: 'block', marginBottom: '4px' }}>Cinema Screens & Seats</strong>
                  <span style={{ fontSize: '0.76rem', color: '#64748B', lineHeight: 1.45, display: 'block' }}>
                    Auditorium screens, rows and seats for seat-based QR ordering.
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '6px' }}>
                  <span style={{ fontSize: '0.70rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', background: '#E0F2FE', color: '#0284C7', border: '1px solid #BAE6FD' }}>
                    {cinemaScreens.length} {cinemaScreens.length === 1 ? 'Screen' : 'Screens'}
                  </span>
                  <span style={{ fontSize: '0.78rem', color: '#0284C7', fontWeight: 700 }}>Manage Screens →</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          6. TAB VIEW 4: MENU & BILLING
         ======================================================== */}
      {settingsTab === 'menu-billing' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: '0 0 2px 0' }}>
              🍽️ Menu & Billing Preferences
            </h3>
            <span style={{ fontSize: '0.76rem', color: '#64748B' }}>
              Configure dish badges, 5% GST calculation, currency symbol, and TouchQR subscription plan.
            </span>
          </div>

          <div className="tab-content-grid-3col">
            {/* Card 1: Menu Preferences */}
            <div className="settings-card-primary" onClick={() => setOpenDrawer('menu')}>
              <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#FFF4EE', color: '#FF5A1F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Utensils size={22} />
              </div>
              <div>
                <strong style={{ fontSize: '0.94rem', color: '#0F172A', fontWeight: 800, display: 'block', marginBottom: '4px' }}>Menu Preferences</strong>
                <span style={{ fontSize: '0.76rem', color: '#64748B', lineHeight: 1.45, display: 'block' }}>
                  Vegetarian/Non-veg markers, spice indicators, cuisine classifications, and badge filters.
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '6px' }}>
                <span style={{ fontSize: '0.70rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', background: '#DCFCE7', color: '#15803D', border: '1px solid #BBF7D0' }}>
                  Configured
                </span>
                <span style={{ fontSize: '0.78rem', color: '#FF5A1F', fontWeight: 700 }}>Menu Settings →</span>
              </div>
            </div>

            {/* Card 2: GST & Tax Calculation */}
            <div className="settings-card-primary" onClick={() => setOpenDrawer('menu')}>
              <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#FFF4EE', color: '#FF5A1F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Receipt size={22} />
              </div>
              <div>
                <strong style={{ fontSize: '0.94rem', color: '#0F172A', fontWeight: 800, display: 'block', marginBottom: '4px' }}>5% GST & Tax Billing</strong>
                <span style={{ fontSize: '0.76rem', color: '#64748B', lineHeight: 1.45, display: 'block' }}>
                  Automatic GST tax calculation on checkout bills, CGST/SGST breakdown.
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '6px' }}>
                <span style={{ fontSize: '0.70rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', background: '#DCFCE7', color: '#15803D', border: '1px solid #BBF7D0' }}>
                  5% GST Active
                </span>
                <span style={{ fontSize: '0.78rem', color: '#FF5A1F', fontWeight: 700 }}>Configure Tax →</span>
              </div>
            </div>

            {/* Card 3: Billing & Subscription */}
            <div className="settings-card-primary" onClick={() => setOpenDrawer('subscription')}>
              <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#DCFCE7', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CreditCard size={22} />
              </div>
              <div>
                <strong style={{ fontSize: '0.94rem', color: '#0F172A', fontWeight: 800, display: 'block', marginBottom: '4px' }}>Billing & Subscription</strong>
                <span style={{ fontSize: '0.76rem', color: '#64748B', lineHeight: 1.45, display: 'block' }}>
                  Current active SaaS plan, usage limits, invoice receipts, and plan upgrades.
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '6px' }}>
                <span style={{ fontSize: '0.70rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', background: '#DCFCE7', color: '#16A34A', border: '1px solid #BBF7D0' }}>
                  Active Plan
                </span>
                <span style={{ fontSize: '0.78rem', color: '#16A34A', fontWeight: 700 }}>Manage Billing →</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          7. TAB VIEW 5: SECURITY
         ======================================================== */}
      {settingsTab === 'security' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: '0 0 2px 0' }}>
              🔒 Security & Credentials
            </h3>
            <span style={{ fontSize: '0.76rem', color: '#64748B' }}>
              Update admin username, change password, manage kitchen KDS PIN, and account protection.
            </span>
          </div>

          <div className="tab-content-grid-3col">
            {/* Card 1: Security & Credentials */}
            <div className="settings-card-primary" onClick={() => setOpenDrawer('security')}>
              <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#FEE2E2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Lock size={22} />
              </div>
              <div>
                <strong style={{ fontSize: '0.94rem', color: '#0F172A', fontWeight: 800, display: 'block', marginBottom: '4px' }}>Admin Credentials</strong>
                <span style={{ fontSize: '0.76rem', color: '#64748B', lineHeight: 1.45, display: 'block' }}>
                  Update admin login username and password with encrypted hash protection.
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '6px' }}>
                <span style={{ fontSize: '0.70rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', background: '#FEE2E2', color: '#DC2626', border: '1px solid #FECACA' }}>
                  Secure
                </span>
                <span style={{ fontSize: '0.78rem', color: '#DC2626', fontWeight: 700 }}>Change Password →</span>
              </div>
            </div>

            {/* Card 2: KDS Kitchen PIN */}
            <div className="settings-card-primary" onClick={() => setOpenDrawer('security')}>
              <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldCheck size={22} />
              </div>
              <div>
                <strong style={{ fontSize: '0.94rem', color: '#0F172A', fontWeight: 800, display: 'block', marginBottom: '4px' }}>KDS 4-Digit Kitchen PIN</strong>
                <span style={{ fontSize: '0.76rem', color: '#64748B', lineHeight: 1.45, display: 'block' }}>
                  Lock kitchen display console so only authorized kitchen staff can mark items ready.
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '6px' }}>
                <span style={{ fontSize: '0.70rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', background: '#FEF3C7', color: '#D97706', border: '1px solid #FDE68A' }}>
                  PIN Protected
                </span>
                <span style={{ fontSize: '0.78rem', color: '#D97706', fontWeight: 700 }}>Set PIN →</span>
              </div>
            </div>

            {/* Card 3: Account Protection */}
            <div className="settings-card-primary" onClick={() => setOpenDrawer('security')}>
              <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#DCFCE7', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldCheck size={22} />
              </div>
              <div>
                <strong style={{ fontSize: '0.94rem', color: '#0F172A', fontWeight: 800, display: 'block', marginBottom: '4px' }}>Session & Data Protection</strong>
                <span style={{ fontSize: '0.76rem', color: '#64748B', lineHeight: 1.45, display: 'block' }}>
                  JWT token encrypted session, automated auto-timeout, and security audit log.
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '6px' }}>
                <span style={{ fontSize: '0.70rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', background: '#DCFCE7', color: '#16A34A', border: '1px solid #BBF7D0' }}>
                  Active
                </span>
                <span style={{ fontSize: '0.78rem', color: '#16A34A', fontWeight: 700 }}>View Details →</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          8. TAB VIEW 6: ADVANCED
         ======================================================== */}
      {settingsTab === 'advanced' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: '0 0 2px 0' }}>
              🚀 Advanced Tools & System Health
            </h3>
            <span style={{ fontSize: '0.76rem', color: '#64748B' }}>
              Google Reviews integration, instant AI review assistant, database optimization, and data export.
            </span>
          </div>

          <div className="tab-content-grid-3col">
            {/* Card 1: Reviews & AI Auto-Reply */}
            <div className="settings-card-primary" onClick={() => onNavigate && onNavigate('review')}>
              <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#F3E8FF', color: '#7E22CE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldCheck size={22} />
              </div>
              <div>
                <strong style={{ fontSize: '0.94rem', color: '#0F172A', fontWeight: 800, display: 'block', marginBottom: '4px' }}>Reviews & AI Auto-Reply</strong>
                <span style={{ fontSize: '0.76rem', color: '#64748B', lineHeight: 1.45, display: 'block' }}>
                  Google reviews connection and AI powered smart auto-reply review assistant.
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '6px' }}>
                <span style={{ fontSize: '0.70rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', background: '#F3E8FF', color: '#7E22CE', border: '1px solid #E9D5FF' }}>
                  Connected
                </span>
                <span style={{ fontSize: '0.78rem', color: '#7E22CE', fontWeight: 700 }}>Open Reviews →</span>
              </div>
            </div>

            {/* Card 2: Database Tools */}
            <div className="settings-card-primary" onClick={() => onOptimizeDatabase && onOptimizeDatabase()}>
              <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#DCFCE7', color: '#15803D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Upload size={22} />
              </div>
              <div>
                <strong style={{ fontSize: '0.94rem', color: '#0F172A', fontWeight: 800, display: 'block', marginBottom: '4px' }}>Database Maintenance</strong>
                <span style={{ fontSize: '0.76rem', color: '#64748B', lineHeight: 1.45, display: 'block' }}>
                  Purge temporary logs, compact database tables, and optimize query indexes.
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '6px' }}>
                <span style={{ fontSize: '0.70rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', background: '#DCFCE7', color: '#15803D', border: '1px solid #BBF7D0' }}>
                  Optimized
                </span>
                <span style={{ fontSize: '0.78rem', color: '#15803D', fontWeight: 700 }}>Run Optimizer →</span>
              </div>
            </div>

            {/* Card 3: Data Refresh & Sync */}
            <div className="settings-card-primary" onClick={() => onRefreshInfo && onRefreshInfo()}>
              <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#E0F2FE', color: '#0284C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Zap size={22} />
              </div>
              <div>
                <strong style={{ fontSize: '0.94rem', color: '#0F172A', fontWeight: 800, display: 'block', marginBottom: '4px' }}>System Cache & Sync</strong>
                <span style={{ fontSize: '0.76rem', color: '#64748B', lineHeight: 1.45, display: 'block' }}>
                  Force reload cache, synchronize real-time socket connections, and verify server health.
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '6px' }}>
                <span style={{ fontSize: '0.70rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', background: '#E0F2FE', color: '#0284C7', border: '1px solid #BAE6FD' }}>
                  Realtime
                </span>
                <span style={{ fontSize: '0.78rem', color: '#0284C7', fontWeight: 700 }}>Sync Now →</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Drawer 1: Business Profile */}
      <AdminDrawer
        isOpen={openDrawer === 'profile'}
        onClose={() => setOpenDrawer(null)}
        title="🏪 Business Profile"
        subtitle="Public business identity and contact details"
        footer={(
          <button
            onClick={handleFormSave}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
              color: '#FFFFFF',
              fontWeight: 900,
              fontSize: '0.90rem',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
            }}
          >
            Save Profile Changes
          </button>
        )}
      >
        <form onSubmit={handleFormSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.86rem' }}>
          {/* Logo Upload Box */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px', background: '#F8FAFC', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
            {settingsForm.logo ? (
              <img src={settingsForm.logo} alt="Logo" style={{ width: '64px', height: '64px', borderRadius: '12px', objectFit: 'cover', border: '1px solid #CBD5E1' }} />
            ) : (
              <div style={{ width: '64px', height: '64px', borderRadius: '12px', background: '#0F172A', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.8rem' }}>LOGO</div>
            )}
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0F172A', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Business Logo:
              </label>
              <input type="file" accept="image/*" onChange={handleLogoUpload} disabled={uploadingLogo} style={{ fontSize: '0.78rem' }} />
              {uploadingLogo && <span style={{ fontSize: '0.72rem', color: '#059669', display: 'block', marginTop: '4px', fontWeight: 700 }}>Uploading logo image...</span>}
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0F172A', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Business Name:
            </label>
            <input
              type="text"
              required
              value={settingsForm.name || ''}
              onChange={(e) => setSettingsForm({ ...settingsForm, name: e.target.value })}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.9rem', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0F172A', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Tagline / Slogan:
            </label>
            <input
              type="text"
              placeholder="e.g. Pure Veg Family Restaurant & Bakery"
              value={settingsForm.tagline || ''}
              onChange={(e) => setSettingsForm({ ...settingsForm, tagline: e.target.value })}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.9rem', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            {(() => {
              const allThemes = THEME_LIST;
              const planTier = (restaurantInfo?.plan_tier || 'pro').toLowerCase();
              const rawAllowed = (
                restaurantInfo?.allowed_themes !== undefined && restaurantInfo?.allowed_themes !== null
                  ? String(restaurantInfo.allowed_themes)
                  : (planTier === 'basic' ? 'gold' : planTier === 'pro' ? 'gold,emerald,crimson,navy' : 'ALL')
              ).trim();
              
              const isThemePermitted = (themeKey) => {
                if (!rawAllowed || rawAllowed === 'ALL') return true;
                const allowedList = rawAllowed.split(',').map(s => s.trim().toLowerCase());
                return allowedList.includes(themeKey.toLowerCase());
              };

              const visibleThemes = allThemes.filter(t => isThemePermitted(t.key));

              return (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                    <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>
                      Customer Menu Luxury Brand Theme:
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#059669', background: '#DCFCE7', padding: '2px 8px', borderRadius: '12px' }}>
                        {visibleThemes.length} Theme{visibleThemes.length === 1 ? '' : 's'} Available on {(restaurantInfo?.plan_tier || 'Current').toUpperCase()} Plan
                      </span>
                      {visibleThemes.length < allThemes.length && onOpenBillingModal && (
                        <button
                          type="button"
                          onClick={onOpenBillingModal}
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            color: '#9333EA',
                            background: '#F3E8FF',
                            border: '1px solid #D8B4FE',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            cursor: 'pointer'
                          }}
                        >
                          👑 Unlock All 8 Themes
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                    {visibleThemes.map(t => {
                      const isSelected = (settingsForm.theme_color || visibleThemes[0]?.key || 'gold') === t.key;
                      return (
                        <div
                          key={t.key}
                          onClick={() => {
                            setSettingsForm(prev => ({ ...prev, theme_color: t.key }));
                            document.documentElement.setAttribute('data-theme', t.key);
                          }}
                          style={{
                            padding: '12px 14px',
                            borderRadius: '12px',
                            border: isSelected ? `2px solid ${t.accent}` : '1px solid #E2E8F0',
                            background: isSelected ? `${t.color}10` : '#FFFFFF',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '10px',
                            transition: 'all 0.2s ease',
                            boxShadow: isSelected ? `0 4px 12px ${t.color}25` : '0 1px 2px rgba(0,0,0,0.03)'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                            <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: t.color, border: `2px solid ${t.accent}`, flexShrink: 0, boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: '0.84rem', fontWeight: 800, color: isSelected ? t.color : '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</div>
                              <div style={{ fontSize: '0.7rem', color: '#64748B' }}>{t.desc}</div>
                            </div>
                          </div>
                          {isSelected && (
                            <span style={{ fontSize: '0.70rem', fontWeight: 900, color: '#FFFFFF', background: t.color, border: `1px solid ${t.accent}`, padding: '2px 6px', borderRadius: '6px', flexShrink: 0 }}>
                              ✓ ACTIVE
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Live Customer Menu Preview Box */}
                  {(() => {
                    const activeKey = settingsForm.theme_color || visibleThemes[0]?.key || 'gold';
                    const activeThemeObj = visibleThemes.find(t => t.key === activeKey) || visibleThemes[0] || allThemes[0];
                    return (
                      <div style={{ marginTop: '12px', padding: '14px 16px', borderRadius: '14px', background: activeThemeObj.color, color: '#FFFFFF', border: `2px solid ${activeThemeObj.accent}`, boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <div style={{ fontSize: '0.70rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: activeThemeObj.accent }}>
                            🎨 Live Customer Menu Header Preview
                          </div>
                          <span style={{ fontSize: '0.68rem', fontWeight: 800, color: activeThemeObj.color, background: activeThemeObj.accent, padding: '2px 8px', borderRadius: '10px' }}>
                            {activeThemeObj.name}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {settingsForm.logo ? (
                            <img src={settingsForm.logo} alt="Logo" style={{ width: '38px', height: '38px', borderRadius: '10px', objectFit: 'cover', border: `1.5px solid ${activeThemeObj.accent}` }} />
                          ) : (
                            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.8rem', border: `1.5px solid ${activeThemeObj.accent}` }}>
                              🍽️
                            </div>
                          )}
                          <div>
                            <div style={{ fontSize: '0.96rem', fontWeight: 900, color: '#FFFFFF' }}>{settingsForm.name || 'Your Business Name'}</div>
                            <div style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.85)' }}>{settingsForm.tagline || 'Scan QR Code • Digital Luxury Menu'}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </>
              );
            })()}
          </div>

          <div>
            <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0F172A', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Owner Full Name (Optional):
            </label>
            <input
              type="text"
              placeholder="e.g. Raman Kumar"
              value={settingsForm.owner_name || ''}
              onChange={(e) => setSettingsForm({ ...settingsForm, owner_name: e.target.value })}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.9rem', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0F172A', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Owner Email Address (Optional):
            </label>
            <input
              type="email"
              placeholder="e.g. owner@example.com"
              value={settingsForm.owner_email || ''}
              onChange={(e) => setSettingsForm({ ...settingsForm, owner_email: e.target.value })}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.9rem', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0F172A', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Contact Phone:
            </label>
            <input
              type="text"
              value={settingsForm.phone || ''}
              onChange={(e) => setSettingsForm({ ...settingsForm, phone: e.target.value })}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.9rem', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0F172A', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              FSSAI License Number:
            </label>
            <input
              type="text"
              placeholder="e.g. 12345678901234"
              value={settingsForm.fssai_lic_no || ''}
              onChange={(e) => setSettingsForm({ ...settingsForm, fssai_lic_no: e.target.value })}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.9rem', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0F172A', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Opening Hours:
            </label>
            <input
              type="text"
              placeholder="e.g. 10:00 AM - 11:00 PM Daily"
              value={settingsForm.openingHours || ''}
              onChange={(e) => setSettingsForm({ ...settingsForm, openingHours: e.target.value })}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.9rem', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0F172A', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Google Maps Location Link:
            </label>
            <input
              type="url"
              placeholder="https://maps.google.com/..."
              value={settingsForm.google_maps_url || ''}
              onChange={(e) => setSettingsForm({ ...settingsForm, google_maps_url: e.target.value })}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.9rem', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0F172A', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Google Review Page Link:
            </label>
            <input
              type="url"
              placeholder="https://g.page/r/..."
              value={settingsForm.google_review_url || ''}
              onChange={(e) => setSettingsForm({ ...settingsForm, google_review_url: e.target.value })}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.9rem', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0F172A', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Address:
            </label>
            <textarea
              rows={2}
              value={settingsForm.address || ''}
              onChange={(e) => setSettingsForm({ ...settingsForm, address: e.target.value })}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.9rem', boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
          </div>

          {/* Custom Menu Domain (CNAME) - Only displayed if custom_domain_enabled on plan */}
          {(() => {
            const isCustomDomainPlanAllowed = Boolean(
              settingsForm?.custom_domain_enabled === 1 ||
              settingsForm?.custom_domain_enabled === true ||
              settingsForm?.custom_domain_enabled === '1' ||
              restaurantInfo?.custom_domain_enabled === 1 ||
              restaurantInfo?.custom_domain_enabled === true ||
              restaurantInfo?.custom_domain_enabled === '1' ||
              restaurantInfo?.permissions?.custom_domain_enabled === true
            );

            if (!isCustomDomainPlanAllowed) return null;

            return (
              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  🌐 Custom Menu Domain (CNAME):
                  <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: '#DCFCE7', color: '#15803D', fontWeight: 800 }}>
                    INCLUDED IN PLAN
                  </span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. menu.yourrestaurant.com"
                  value={settingsForm.custom_domain || ''}
                  onChange={(e) => setSettingsForm({ ...settingsForm, custom_domain: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.9rem', boxSizing: 'border-box' }}
                />
                <div style={{ fontSize: '0.70rem', color: '#64748B', marginTop: '4px' }}>
                  Point CNAME record in GoDaddy to: <strong style={{ color: '#059669' }}>cname.vercel-dns.com</strong>
                </div>
              </div>
            );
          })()}
        </form>
      </AdminDrawer>

      {/* Drawer 2: Orders & Devices */}
      <AdminDrawer
        isOpen={openDrawer === 'devices'}
        onClose={() => setOpenDrawer(null)}
        title="🔔 Orders & Devices"
        subtitle="Manage live order siren ringtones and thermal printer settings"
        footer={(
          <button
            onClick={handleFormSave}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
              color: '#FFFFFF',
              fontWeight: 900,
              fontSize: '0.90rem',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
            }}
          >
            Save Device Settings
          </button>
        )}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Card 1: Siren Audio Alert Box */}
          <div style={{ padding: '16px 18px', background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>
                  🔊
                </div>
                <div>
                  <strong style={{ fontSize: '0.92rem', color: '#0F172A', fontWeight: 800, display: 'block' }}>Live Order Siren Ringtone</strong>
                  <span style={{ fontSize: '0.72rem', color: '#64748B' }}>Swiggy/Zomato style order alert sound</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settingsForm.order_alarm_enabled !== false}
                onChange={(e) => setSettingsForm({ ...settingsForm, order_alarm_enabled: e.target.checked })}
                style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: '#059669' }}
              />
            </div>
            <p style={{ fontSize: '0.76rem', color: '#64748B', margin: '0 0 12px 0', lineHeight: 1.45, paddingLeft: '46px' }}>
              Plays a loud ringing alarm automatically whenever a new customer table order arrives.
            </p>
            <div style={{ display: 'flex', gap: '10px', paddingLeft: '46px' }}>
              <button
                type="button"
                onClick={testAlarmSound}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: '10px',
                  background: '#FFFBEB',
                  color: '#B45309',
                  border: '1px solid #FDE68A',
                  fontWeight: 800,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
              >
                <Volume2 size={15} /> Test Siren Sound
              </button>
              <button
                type="button"
                onClick={requestPushPermission}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: '10px',
                  background: '#F1F5F9',
                  color: '#334155',
                  border: '1px solid #CBD5E1',
                  fontWeight: 800,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
              >
                🔔 Push Notifications
              </button>
            </div>
          </div>

          {/* Card 2: Kitchen Display System (KDS) Screen Toggle */}
          {(() => {
            const isKdsPlanAllowed = Boolean(
              settingsForm?.kds_enabled === 1 ||
              settingsForm?.kds_enabled === true ||
              settingsForm?.kds_enabled === '1' ||
              restaurantInfo?.kds_enabled === 1 ||
              restaurantInfo?.kds_enabled === true ||
              restaurantInfo?.kds_enabled === '1' ||
              restaurantInfo?.permissions?.kds_enabled === true
            );

            return (
              <div style={{ padding: '16px 18px', background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#EDE9FE', color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>
                      🍳
                    </div>
                    <div>
                      <strong style={{ fontSize: '0.92rem', color: '#0F172A', fontWeight: 800, display: 'block' }}>Kitchen Display System (KDS)</strong>
                      <span style={{ fontSize: '0.72rem', color: '#64748B' }}>Dedicated kitchen tablet screen for chef prep</span>
                    </div>
                  </div>
                  {isKdsPlanAllowed ? (
                    <input
                      type="checkbox"
                      checked={settingsForm.kds_screen_enabled !== false && settingsForm.kds_screen_enabled !== 0}
                      onChange={(e) => setSettingsForm({ ...settingsForm, kds_screen_enabled: e.target.checked ? 1 : 0 })}
                      style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: '#059669' }}
                    />
                  ) : (
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#B45309', background: '#FEF3C7', border: '1px solid #F59E0B', padding: '3px 10px', borderRadius: '20px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      🔒 Enterprise Feature
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '0.76rem', color: '#64748B', margin: 0, lineHeight: 1.45, paddingLeft: '46px' }}>
                  {isKdsPlanAllowed 
                    ? 'Enables the fullscreen Kitchen Display Screen tab for chef order preparation and instant completed alerts.' 
                    : 'Kitchen Display screen access is restricted to the Enterprise Plan tier. Contact SuperAdmin to upgrade.'}
                </p>
              </div>
            );
          })()}

          {/* Card 3: Printer Setup Box */}
          <div style={{ padding: '16px 18px', background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#E0F2FE', color: '#0284C7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>
                  🖨️
                </div>
                <div>
                  <strong style={{ fontSize: '0.92rem', color: '#0F172A', fontWeight: 800, display: 'block' }}>Thermal Receipt Printer & Routing</strong>
                  <span style={{ fontSize: '0.72rem', color: '#64748B' }}>58mm / 80mm ESC/POS, Bluetooth, USB & RawBT</span>
                </div>
              </div>
              {(() => {
                const isDualAllowed = Boolean(
                  settingsForm?.dual_printer_enabled === 1 ||
                  settingsForm?.dual_printer_enabled === true ||
                  settingsForm?.dual_printer_enabled === '1'
                );
                return (
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: '20px',
                    fontSize: '0.70rem',
                    fontWeight: 900,
                    background: isDualAllowed ? '#DCFCE7' : '#F1F5F9',
                    color: isDualAllowed ? '#15803D' : '#64748B',
                    border: `1px solid ${isDualAllowed ? '#86EFAC' : '#CBD5E1'}`
                  }}>
                    {isDualAllowed ? '⚡ DUAL PRINTER READY (VIP ULTRA)' : '🔒 SINGLE PRINTER MODE'}
                  </span>
                );
              })()}
            </div>
            <p style={{ fontSize: '0.76rem', color: '#64748B', margin: '0', lineHeight: 1.45, paddingLeft: '46px' }}>
              Configure Kitchen Order Ticket (KOT) and Counter Customer Bill thermal printing.
            </p>

            <div style={{ paddingLeft: '46px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {(() => {
                const isDualAllowed = Boolean(
                  settingsForm?.dual_printer_enabled === 1 ||
                  settingsForm?.dual_printer_enabled === true ||
                  settingsForm?.dual_printer_enabled === '1'
                );

                return (
                  <>
                    <div>
                      <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0F172A', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Printer Routing Mode:
                      </label>

                      <select
                        value={isDualAllowed ? (settingsForm.printer_mode || 'single') : 'single'}
                        onChange={(e) => {
                          if (!isDualAllowed) return;
                          setSettingsForm({ ...settingsForm, printer_mode: e.target.value });
                        }}
                        disabled={!isDualAllowed}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.88rem', fontWeight: 700, boxSizing: 'border-box' }}
                      >
                        <option value="single">🟢 Single Printer (Same Printer for KOT & Customer Bill)</option>
                        {isDualAllowed && (
                          <option value="dual">⚡ Dual Separate Printers (Kitchen KOT + Counter Bill)</option>
                        )}
                      </select>
                    </div>

                    {/* Single Mode Card */}
                    {(!isDualAllowed || settingsForm.printer_mode !== 'dual') && (
                      <div style={{ padding: '14px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <strong style={{ fontSize: '0.84rem', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          🖨️ Main Receipt Printer (KOT & Billing)
                        </strong>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          <div>
                            <label style={{ fontSize: '0.70rem', fontWeight: 800, color: '#64748B', display: 'block', marginBottom: '3px' }}>
                              PAPER WIDTH:
                            </label>
                            <select
                              value={settingsForm.printer_paper_width || '80mm'}
                              onChange={(e) => setSettingsForm({ ...settingsForm, printer_paper_width: e.target.value })}
                              style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.82rem', fontWeight: 700, boxSizing: 'border-box' }}
                            >
                              <option value="80mm">80mm (Standard 3-Inch)</option>
                              <option value="58mm">58mm (Compact 2-Inch)</option>
                            </select>
                          </div>
                          <div>
                            <label style={{ fontSize: '0.70rem', fontWeight: 800, color: '#64748B', display: 'block', marginBottom: '3px' }}>
                              CONNECTION:
                            </label>
                            <select
                              value={settingsForm.connection_type || 'browser_dialog'}
                              onChange={(e) => setSettingsForm({ ...settingsForm, connection_type: e.target.value })}
                              style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.82rem', fontWeight: 700, boxSizing: 'border-box' }}
                            >
                              <option value="browser_dialog">Default OS / Browser Dialog</option>
                              <option value="rawbt">Android RawBT Direct App</option>
                            </select>
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: '#334155', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={settingsForm.auto_print_kot === 1 || settingsForm.auto_print_kot === true}
                              onChange={(e) => setSettingsForm({ ...settingsForm, auto_print_kot: e.target.checked ? 1 : 0 })}
                            />
                            <span>Auto-prompt KOT print on new live orders</span>
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: '#334155', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={settingsForm.auto_print_bill === 1 || settingsForm.auto_print_bill === true}
                              onChange={(e) => setSettingsForm({ ...settingsForm, auto_print_bill: e.target.checked ? 1 : 0 })}
                            />
                            <span>Auto-prompt Bill print on table settlement</span>
                          </label>
                        </div>
                      </div>
                    )}

                    {/* Dual Mode Cards */}
                    {isDualAllowed && settingsForm.printer_mode === 'dual' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {/* Kitchen Printer Card */}
                        <div style={{ padding: '14px', background: '#FEF3C7', borderRadius: '12px', border: '1px solid #FCD34D', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong style={{ fontSize: '0.86rem', color: '#92400E', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              🍳 KITCHEN PRINTER (KOT Receipts Only)
                            </strong>
                            <span style={{ fontSize: '0.70rem', background: '#F59E0B', color: '#FFF', padding: '2px 8px', borderRadius: '6px', fontWeight: 800 }}>KITCHEN</span>
                          </div>
                          <div>
                            <label style={{ fontSize: '0.70rem', fontWeight: 800, color: '#78350F', display: 'block', marginBottom: '2px' }}>
                              PRINTER NAME / TARGET:
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Kitchen_Thermal_KOT or 192.168.1.200"
                              value={settingsForm.kot_printer_target || ''}
                              onChange={(e) => setSettingsForm({ ...settingsForm, kot_printer_target: e.target.value })}
                              style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #FDE68A', fontSize: '0.84rem', boxSizing: 'border-box' }}
                            />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', color: '#78350F', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={settingsForm.auto_print_kot === 1 || settingsForm.auto_print_kot === true}
                                onChange={(e) => setSettingsForm({ ...settingsForm, auto_print_kot: e.target.checked ? 1 : 0 })}
                              />
                              <span>Auto-print KOT on new round</span>
                            </label>
                          </div>
                        </div>

                        {/* Counter Billing Printer Card */}
                        <div style={{ padding: '14px', background: '#E0F2FE', borderRadius: '12px', border: '1px solid #BAE6FD', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong style={{ fontSize: '0.86rem', color: '#0369A1', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              🧾 COUNTER BILLING PRINTER (Customer Invoices Only)
                            </strong>
                            <span style={{ fontSize: '0.70rem', background: '#0284C7', color: '#FFF', padding: '2px 8px', borderRadius: '6px', fontWeight: 800 }}>COUNTER</span>
                          </div>
                          <div>
                            <label style={{ fontSize: '0.70rem', fontWeight: 800, color: '#075985', display: 'block', marginBottom: '2px' }}>
                              PRINTER NAME / TARGET:
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Counter_Bill_Thermal or 192.168.1.201"
                              value={settingsForm.bill_printer_target || ''}
                              onChange={(e) => setSettingsForm({ ...settingsForm, bill_printer_target: e.target.value })}
                              style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #BAE6FD', fontSize: '0.84rem', boxSizing: 'border-box' }}
                            />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', color: '#075985', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={settingsForm.auto_print_bill === 1 || settingsForm.auto_print_bill === true}
                                onChange={(e) => setSettingsForm({ ...settingsForm, auto_print_bill: e.target.checked ? 1 : 0 })}
                              />
                              <span>Auto-print Bill on settlement</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}

              <button
                onClick={() => { setOpenDrawer(null); setShowPrinterModal(true); }}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: '#F1F5F9',
                  color: '#334155',
                  border: '1px solid #CBD5E1',
                  fontWeight: 800,
                  fontSize: '0.80rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Printer size={15} /> Open Printer Pairing Guide & Test Suite
              </button>
            </div>
          </div>
        </div>
      </AdminDrawer>

      {/* Drawer 3: Menu Settings */}
      <AdminDrawer
        isOpen={openDrawer === 'menu'}
        onClose={() => setOpenDrawer(null)}
        title="🍽 Menu & GST Settings"
        subtitle="Configure cuisine type, tax rate, and dish badge visibility"
        footer={(
          <button
            onClick={handleFormSave}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
              color: '#FFFFFF',
              fontWeight: 900,
              fontSize: '0.90rem',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
            }}
          >
            Save Menu & Tax Settings
          </button>
        )}
      >
        <form onSubmit={handleFormSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Card 1: Business Profile */}
          {(() => {
            const resolvedProfile = resolveBusinessProfile(settingsForm);
            const currentBusinessType = settingsForm.business_type || resolvedProfile.business_type;
            const currentFoodType = settingsForm.food_type || resolvedProfile.food_type;
            const currentServiceModel = settingsForm.service_model || resolvedProfile.service_model;

            const isLegacyBiz = settingsForm.business_type == null;
            const isLegacyFood = settingsForm.food_type == null;

            // Canonical category badge & service mode derivation
            const serviceModelMeta = SERVICE_MODEL_METADATA[currentServiceModel] || SERVICE_MODEL_METADATA.dine_in;
            const bannerBadgeText = resolveBannerBadge(settingsForm);

            const serviceModeDescription = currentServiceModel === 'hotel'
              ? '🏨 In-Room Guest Dining'
              : currentServiceModel === 'cinema'
              ? '🎬 Cinema Seat Ordering'
              : '🍽️ Table QR Ordering';

            return (
              <div style={{ padding: '16px 18px', background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#DCFCE7', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>
                    🏢
                  </div>
                  <div>
                    <strong style={{ fontSize: '0.92rem', color: '#0F172A', fontWeight: 800, display: 'block' }}>Business Profile</strong>
                    <span style={{ fontSize: '0.72rem', color: '#64748B' }}>Configure business venue type, dietary profile and ordering mode</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingLeft: '46px' }}>
                  {/* Control A: Business Type */}
                  <div style={{ background: '#F8FAFC', padding: '12px 14px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <label htmlFor="admin-business-type" style={{ fontSize: '0.80rem', fontWeight: 800, color: '#1E293B' }}>
                        Business Type
                      </label>
                      {isLegacyBiz && (
                        <span style={{ fontSize: '0.66rem', fontWeight: 700, color: '#64748B', background: '#E2E8F0', padding: '2px 6px', borderRadius: '8px' }}>
                          Using legacy setting
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.68rem', color: '#64748B', display: 'block', marginBottom: '8px' }}>
                      Select the type of business or venue that operates this TouchQR account.
                    </span>
                    <select
                      id="admin-business-type"
                      value={currentBusinessType || 'restaurant'}
                      onChange={(e) => {
                        const newBiz = e.target.value;
                        const safeResto = (currentFoodType === 'pure_veg' ? 'pure_veg' : currentFoodType === 'veg_nonveg' ? 'veg_nonveg' : (newBiz === 'bakery_confectionery' ? 'bakery' : 'pure_veg'));
                        const autoService = resolveServiceModelForBusinessType(newBiz);
                        setSettingsForm({
                          ...settingsForm,
                          business_type: newBiz,
                          service_model: autoService,
                          resto_type: safeResto
                        });
                      }}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.84rem', fontWeight: 700, background: '#FFFFFF', color: '#0F172A' }}
                    >
                      {BUSINESS_TYPES.map(type => (
                        <option key={type} value={type}>
                          {BUSINESS_TYPE_METADATA[type]?.icon || '🏢'} {BUSINESS_TYPE_METADATA[type]?.label || type}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Control B: Food Type */}
                  <div style={{ background: '#F8FAFC', padding: '12px 14px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <label htmlFor="admin-food-type" style={{ fontSize: '0.80rem', fontWeight: 800, color: '#1E293B' }}>
                        Food Dietary Type
                      </label>
                      {isLegacyFood && (
                        <span style={{ fontSize: '0.66rem', fontWeight: 700, color: '#64748B', background: '#E2E8F0', padding: '2px 6px', borderRadius: '8px' }}>
                          Using legacy setting
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.68rem', color: '#64748B', display: 'block', marginBottom: '8px' }}>
                      Tell customers what dietary profile applies to this menu.
                    </span>
                    <select
                      id="admin-food-type"
                      value={currentFoodType || 'pure_veg'}
                      onChange={(e) => {
                        const newFood = e.target.value;
                        const safeResto = (newFood === 'pure_veg' ? 'pure_veg' : newFood === 'veg_nonveg' ? 'veg_nonveg' : (currentBusinessType === 'bakery_confectionery' ? 'bakery' : 'pure_veg'));
                        setSettingsForm({
                          ...settingsForm,
                          food_type: newFood,
                          resto_type: safeResto
                        });
                      }}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.84rem', fontWeight: 700, background: '#FFFFFF', color: '#0F172A' }}
                    >
                      {FOOD_TYPES.map(type => (
                        <option key={type} value={type}>
                          {FOOD_TYPE_METADATA[type]?.icon || '🥗'} {FOOD_TYPE_METADATA[type]?.label || type}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Premium Summary Card: Business Profile Preview */}
                  <div style={{
                    padding: '14px 16px',
                    background: 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)',
                    borderRadius: '12px',
                    border: '1px solid #E2E8F0',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <span style={{ fontSize: '0.70rem', fontWeight: 900, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        ✨ Live Profile Preview
                      </span>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 900,
                        background: currentServiceModel === 'hotel' ? '#EFF6FF' : currentServiceModel === 'cinema' ? '#FDF2F8' : '#F0FDF4',
                        color: currentServiceModel === 'hotel' ? '#1D4ED8' : currentServiceModel === 'cinema' ? '#BE185D' : '#15803D',
                        border: `1px solid ${currentServiceModel === 'hotel' ? '#BFDBFE' : currentServiceModel === 'cinema' ? '#FBCFE8' : '#BBF7D0'}`,
                        padding: '3px 9px',
                        borderRadius: '20px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        {serviceModelMeta.emoji} {currentServiceModel === 'hotel' ? 'HOTEL' : currentServiceModel === 'cinema' ? 'CINEMA' : 'DINE-IN'}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
                      <div style={{ background: '#FFFFFF', padding: '8px 10px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                        <span style={{ fontSize: '0.64rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>Business</span>
                        <strong style={{ fontSize: '0.78rem', color: '#0F172A', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                          {BUSINESS_TYPE_METADATA[currentBusinessType]?.icon || '🏢'} {BUSINESS_TYPE_METADATA[currentBusinessType]?.label?.replace(/\s*\(.*\)/, '') || currentBusinessType}
                        </strong>
                      </div>

                      <div style={{ background: '#FFFFFF', padding: '8px 10px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                        <span style={{ fontSize: '0.64rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>Food Dietary</span>
                        <strong style={{ fontSize: '0.78rem', color: '#0F172A', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                          {FOOD_TYPE_METADATA[currentFoodType]?.icon || '🟢'} {FOOD_TYPE_METADATA[currentFoodType]?.label || currentFoodType}
                        </strong>
                      </div>

                      <div style={{ background: '#FFFFFF', padding: '8px 10px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                        <span style={{ fontSize: '0.64rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>Service Mode</span>
                        <strong style={{ fontSize: '0.78rem', color: '#0F172A', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                          {serviceModeDescription}
                        </strong>
                      </div>

                      <div style={{ background: '#FFFFFF', padding: '8px 10px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                        <span style={{ fontSize: '0.64rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>Menu Badge</span>
                        <strong style={{ fontSize: '0.78rem', color: '#0F172A', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                          🏷️ {bannerBadgeText}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Card 2: Currency Symbol */}
          <div style={{ padding: '16px 18px', background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>
                🪙
              </div>
              <div>
                <strong style={{ fontSize: '0.92rem', color: '#0F172A', fontWeight: 800, display: 'block' }}>Currency & Pricing Symbol</strong>
                <span style={{ fontSize: '0.72rem', color: '#64748B' }}>Shown on customer QR menu and printed receipts</span>
              </div>
            </div>
            <div style={{ paddingLeft: '46px' }}>
              <select
                value={settingsForm.currency_symbol != null ? settingsForm.currency_symbol : '₹'}
                onChange={(e) => setSettingsForm({ ...settingsForm, currency_symbol: e.target.value })}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.88rem', fontWeight: 700, boxSizing: 'border-box', background: '#FFFFFF' }}
              >
                <option value="₹">₹ — Indian Rupee (INR)</option>
                <option value="$">$ — US Dollar (USD)</option>
                <option value="€">€ — Euro (EUR)</option>
                <option value="£">£ — British Pound (GBP)</option>
                <option value="">None — No Currency Symbol</option>
              </select>
            </div>
          </div>

          {/* Card 3: GST Configuration */}
          <div style={{ padding: '16px 18px', background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: settingsForm.gst_enabled ? '12px' : '0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#E0F2FE', color: '#0284C7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>
                  🏷️
                </div>
                <div>
                  <strong style={{ fontSize: '0.92rem', color: '#0F172A', fontWeight: 800, display: 'block' }}>5% GST Tax Billing & Invoicing</strong>
                  <span style={{ fontSize: '0.72rem', color: '#64748B' }}>Adds 5% GST tax automatically on customer orders</span>
                </div>
              </div>

              {(settingsForm.gst_invoice_enabled !== false && settingsForm.gst_invoice_enabled !== 0) ? (
                <button
                  type="button"
                  role="switch"
                  aria-checked={Boolean(settingsForm.gst_enabled)}
                  aria-label="Toggle 5% GST Tax Billing"
                  onClick={() => setSettingsForm({ ...settingsForm, gst_enabled: !settingsForm.gst_enabled })}
                  style={{
                    width: '48px',
                    height: '28px',
                    minWidth: '48px',
                    minHeight: '28px',
                    padding: '2px',
                    borderRadius: '14px',
                    border: 'none',
                    background: settingsForm.gst_enabled ? '#059669' : '#CBD5E1',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'background-color 0.2s ease',
                    display: 'inline-flex',
                    alignItems: 'center',
                    boxSizing: 'border-box'
                  }}
                >
                  <span
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: '#FFFFFF',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      transform: settingsForm.gst_enabled ? 'translateX(20px)' : 'translateX(0px)',
                      transition: 'transform 0.2s ease',
                      display: 'block'
                    }}
                  />
                </button>
              ) : (
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#B45309', background: '#FEF3C7', border: '1px solid #F59E0B', padding: '3px 10px', borderRadius: '20px' }}>
                  🔒 Pro Feature
                </span>
              )}
            </div>

            {settingsForm.gst_enabled && (
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #F1F5F9', paddingLeft: '46px' }}>
                <label htmlFor="admin-gstin-number" style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0F172A', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  GSTIN Number:
                </label>
                <input
                  id="admin-gstin-number"
                  type="text"
                  placeholder="e.g. 10AAAAA0000A1Z5"
                  value={settingsForm.gstin_number || ''}
                  onChange={(e) => setSettingsForm({ ...settingsForm, gstin_number: e.target.value.toUpperCase() })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.86rem', fontWeight: 700, boxSizing: 'border-box', background: '#FFFFFF', color: '#0F172A' }}
                />
                <span style={{ fontSize: '0.70rem', color: '#64748B', marginTop: '4px', display: 'block' }}>Printed on all customer receipt printouts and tax reports.</span>
              </div>
            )}
          </div>

          {/* Card 4: Dish Filter Visibility Toggles */}
          <div style={{ padding: '16px 18px', background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#EDE9FE', color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>
                👁️
              </div>
              <div>
                <strong style={{ fontSize: '0.92rem', color: '#0F172A', fontWeight: 800, display: 'block' }}>Customer Menu Badges & Filters</strong>
                <span style={{ fontSize: '0.72rem', color: '#64748B' }}>Toggle badge visibility pills in the customer QR menu</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '46px' }}>
              {/* Filter 1 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #F1F5F9' }}>
                <div>
                  <strong style={{ fontSize: '0.84rem', color: '#1E293B', display: 'block' }}>⭐ "Must Try" Badge Filter</strong>
                  <span style={{ fontSize: '0.70rem', color: '#64748B' }}>Highlights chef special recommended items</span>
                </div>
                <input
                  type="checkbox"
                  checked={settingsForm.filters_visibility?.must_try !== false}
                  onChange={(e) => setSettingsForm({
                    ...settingsForm,
                    filters_visibility: { ...settingsForm.filters_visibility, must_try: e.target.checked }
                  })}
                  style={{ width: '18px', height: '18px', accentColor: '#059669', cursor: 'pointer' }}
                />
              </div>

              {/* Filter 2 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #F1F5F9' }}>
                <div>
                  <strong style={{ fontSize: '0.84rem', color: '#1E293B', display: 'block' }}>✨ "Today Special" Badge Filter</strong>
                  <span style={{ fontSize: '0.70rem', color: '#64748B' }}>Highlights daily limited-time special dishes</span>
                </div>
                <input
                  type="checkbox"
                  checked={settingsForm.filters_visibility?.special !== false}
                  onChange={(e) => setSettingsForm({
                    ...settingsForm,
                    filters_visibility: { ...settingsForm.filters_visibility, special: e.target.checked }
                  })}
                  style={{ width: '18px', height: '18px', accentColor: '#059669', cursor: 'pointer' }}
                />
              </div>

              {/* Filter 3 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #F1F5F9' }}>
                <div>
                  <strong style={{ fontSize: '0.84rem', color: '#1E293B', display: 'block' }}>🍱 "Combos" Navigation Tab</strong>
                  <span style={{ fontSize: '0.70rem', color: '#64748B' }}>Displays dedicated combos category tab</span>
                </div>
                <input
                  type="checkbox"
                  checked={settingsForm.filters_visibility?.combo !== false}
                  onChange={(e) => setSettingsForm({
                    ...settingsForm,
                    filters_visibility: { ...settingsForm.filters_visibility, combo: e.target.checked }
                  })}
                  style={{ width: '18px', height: '18px', accentColor: '#059669', cursor: 'pointer' }}
                />
              </div>
            </div>
          </div>
        </form>
      </AdminDrawer>

      {/* Drawer 4: Location & GPS Geofence */}
      <AdminDrawer
        isOpen={openDrawer === 'location'}
        onClose={() => setOpenDrawer(null)}
        title="📍 Location & GPS Geofence"
        subtitle="Set coordinates to prevent fake orders from outside your restaurant"
        footer={(
          <button
            onClick={handleFormSave}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
              color: '#FFFFFF',
              fontWeight: 900,
              fontSize: '0.90rem',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
            }}
          >
            Save Location & Geofence
          </button>
        )}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Card 1: GPS Capture & Map Tool */}
          <div style={{ padding: '16px 18px', background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#FFE4E6', color: '#E11D48', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>
                📍
              </div>
              <div>
                <strong style={{ fontSize: '0.92rem', color: '#0F172A', fontWeight: 800, display: 'block' }}>GPS Coordinate Pinpoint</strong>
                <span style={{ fontSize: '0.72rem', color: '#64748B' }}>Auto-detect or pin your exact restaurant entrance</span>
              </div>
            </div>

            <p style={{ fontSize: '0.76rem', color: '#64748B', margin: '0 0 12px 0', lineHeight: 1.45, paddingLeft: '46px' }}>
              Customers must be physically present inside this radius to place live table orders.
            </p>

            {/* Informational Presence Verification Mode Banner */}
            <div style={{ margin: '0 0 14px 46px', padding: '10px 14px', background: '#F0FDF4', borderRadius: '10px', border: '1px solid #BBF7D0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={16} color="#166534" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: '0.76rem', color: '#166534', fontWeight: 700 }}>
                Table Presence Verification: <strong>GPS + Staff Fallback</strong> (Active automatically with Direct QR Ordering)
              </span>
            </div>

            <div style={{ display: 'flex', gap: '10px', paddingLeft: '46px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleDetectGps}
                disabled={gpsLoading}
                style={{
                  flex: '1 1 140px',
                  padding: '11px 14px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 6px rgba(217, 119, 6, 0.25)',
                  transition: 'all 0.15s ease'
                }}
              >
                <MapPin size={15} />
                {gpsLoading ? 'Detecting GPS...' : gpsSuccessMsg ? '✓ GPS Captured' : '🎯 Auto Detect GPS'}
              </button>

              <button
                type="button"
                onClick={() => setShowMapModal(true)}
                style={{
                  flex: '1 1 140px',
                  padding: '11px 14px',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#0F172A',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 6px rgba(15, 23, 42, 0.25)',
                  transition: 'all 0.15s ease'
                }}
              >
                <Map size={15} />
                🗺️ Interactive Map
              </button>
            </div>

            {gpsSuccessMsg && (
              <div style={{ marginTop: '12px', marginLeft: '46px', background: '#DCFCE7', color: '#15803D', padding: '10px 14px', borderRadius: '10px', fontSize: '0.80rem', fontWeight: 800, border: '1px solid #86EFAC' }}>
                {gpsSuccessMsg}
              </div>
            )}

            {gpsErrorState && (
              <div style={{ marginTop: '12px', marginLeft: '46px', background: '#FEF2F2', color: '#DC2626', padding: '12px 14px', borderRadius: '10px', fontSize: '0.80rem', fontWeight: 700, border: '1px solid #FECACA', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <strong style={{ fontSize: '0.86rem' }}>{gpsErrorState.title}</strong>
                <div style={{ lineHeight: 1.4 }}>{gpsErrorState.msg}</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                  <button
                    type="button"
                    onClick={handleDetectGps}
                    style={{ padding: '6px 12px', borderRadius: '8px', background: '#DC2626', color: '#FFF', border: 'none', fontWeight: 800, fontSize: '0.74rem', cursor: 'pointer' }}
                  >
                    Try Again
                  </button>
                  {gpsErrorState.isDenied && (
                    <button
                      type="button"
                      onClick={() => alert('📱 How to Allow Location Access:\n\n1. Tap the 🔒 lock or ⓘ info icon in your browser address bar\n2. Tap "Site Settings" or "Permissions"\n3. Change "Location" from Blocked to Allow\n4. Refresh the page and click Detect Current Location again.')}
                      style={{ padding: '6px 12px', borderRadius: '8px', background: '#F1F5F9', color: '#334155', border: '1px solid #CBD5E1', fontWeight: 800, fontSize: '0.74rem', cursor: 'pointer' }}
                    >
                      How to Allow
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Card 2: Current GPS Coordinates */}
          <div style={{ padding: '16px 18px', background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#DCFCE7', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>
                🌐
              </div>
              <div>
                <strong style={{ fontSize: '0.92rem', color: '#0F172A', fontWeight: 800, display: 'block' }}>Entrance Coordinates</strong>
                <span style={{ fontSize: '0.72rem', color: '#64748B' }}>Sub-meter precision latitude and longitude</span>
              </div>
            </div>

            <div style={{ paddingLeft: '46px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0F172A', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Latitude:
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 26.0602"
                    value={settingsForm.latitude || ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, latitude: parseFloat(e.target.value) })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.88rem', fontWeight: 700, boxSizing: 'border-box', background: '#FFFFFF' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0F172A', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Longitude:
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 85.1634"
                    value={settingsForm.longitude || ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, longitude: parseFloat(e.target.value) })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.88rem', fontWeight: 700, boxSizing: 'border-box', background: '#FFFFFF' }}
                  />
                </div>
              </div>

              {settingsForm.latitude && settingsForm.longitude && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2px' }}>
                  <a
                    href={`https://www.google.com/maps?q=${settingsForm.latitude},${settingsForm.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: '0.74rem', color: '#0284C7', fontWeight: 800, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    Verify on Google Maps ↗
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Card 3: Geofence Ordering Radius */}
          <div style={{ padding: '16px 18px', background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>
                🎯
              </div>
              <div>
                <strong style={{ fontSize: '0.92rem', color: '#0F172A', fontWeight: 800, display: 'block' }}>Max Ordering Distance Boundary</strong>
                <span style={{ fontSize: '0.72rem', color: '#64748B' }}>Geofence restriction radius in meters</span>
              </div>
            </div>

            <div style={{ paddingLeft: '46px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ position: 'relative' }}>
                <input
                  type="number"
                  min="20"
                  max="5000"
                  value={settingsForm.max_distance_meters || 100}
                  onChange={(e) => setSettingsForm({ ...settingsForm, max_distance_meters: parseInt(e.target.value) || 100 })}
                  style={{ width: '100%', padding: '10px 80px 10px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.9rem', fontWeight: 800, boxSizing: 'border-box' }}
                />
                <span style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.76rem', fontWeight: 800, color: '#64748B' }}>
                  meters
                </span>
              </div>

              {/* Quick Preset Pills */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[
                  { label: '50m (Dining Hall)', val: 50 },
                  { label: '100m (Standard)', val: 100 },
                  { label: '250m (Premises)', val: 250 },
                  { label: '500m (Zone)', val: 500 },
                ].map(p => {
                  const isActive = (settingsForm.max_distance_meters || 100) === p.val;
                  return (
                    <button
                      key={p.val}
                      type="button"
                      onClick={() => setSettingsForm({ ...settingsForm, max_distance_meters: p.val })}
                      style={{
                        padding: '5px 10px',
                        borderRadius: '8px',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        border: isActive ? '1.5px solid #059669' : '1px solid #E2E8F0',
                        background: isActive ? '#DCFCE7' : '#F8FAFC',
                        color: isActive ? '#15803D' : '#475569',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <LocationPickerModal
            isOpen={showMapModal}
            onClose={() => setShowMapModal(false)}
            initialLat={Number(settingsForm.latitude) || 26.6500}
            initialLng={Number(settingsForm.longitude) || 86.5800}
            initialRadius={Number(settingsForm.max_distance_meters) || 100}
            initialAddress={settingsForm.address || ''}
            onSave={(loc) => {
              setSettingsForm(prev => ({
                ...prev,
                latitude: loc.latitude,
                longitude: loc.longitude,
                max_distance_meters: loc.max_distance_meters,
                location_initialized: true
              }));
              setGpsSuccessMsg(`✓ Location & Geofence updated via interactive map!`);
              setTimeout(() => setGpsSuccessMsg(''), 5000);
            }}
          />
        </div>
      </AdminDrawer>

      {/* Drawer 5: Subscription & Billing */}
      <AdminDrawer
        isOpen={openDrawer === 'subscription'}
        onClose={() => setOpenDrawer(null)}
        title="💳 Subscription & Billing"
        subtitle="Manage plan tier, auto-renew mandate, and payment records"
      >
        {(() => {
          const activePlanKey = (subData?.plan_tier || restaurantInfo?.plan_tier || settingsForm?.plan_tier || 'pro').toLowerCase();
          const activePlanPrice = subData?.plan_price || restaurantInfo?.plan_price || 999;
          const isComplimentary = subData?.mandate_status === 'admin_granted' || 
                                  restaurantInfo?.subscription_type === 'ADMIN_GRANTED' || 
                                  subData?.subscription_type === 'ADMIN_GRANTED';

          const rawExpiryDate = subData?.current_period_end || 
                                subData?.subscription?.current_period_end || 
                                subData?.subscription?.next_billing_at || 
                                subData?.plan_expires_at || 
                                subData?.trial_ends_at || 
                                subData?.access_until || 
                                restaurantInfo?.access_until || 
                                restaurantInfo?.plan_expires_at || 
                                restaurantInfo?.trial_ends_at;

          const formatBillingDate = (dateVal) => {
            if (!dateVal) return null;
            try {
              const d = new Date(dateVal);
              if (isNaN(d.getTime())) return null;
              return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
            } catch {
              return null;
            }
          };

          const formattedDate = formatBillingDate(rawExpiryDate);
          const isLifetime = isComplimentary || (rawExpiryDate && new Date(rawExpiryDate).getFullYear() > 2030);

          const autoRenewActive = !isComplimentary && (subData?.auto_renew === 1 || (subData?.auto_renew === undefined && subData?.mandate_status === 'active'));
          const isCancelRequested = Boolean(subData?.cancel_requested_at || subData?.auto_renew === 0 || subData?.mandate_status === 'cancelled');

          let renewalText = 'N/A';
          if (isLifetime) {
            renewalText = '♾️ Lifetime Access';
          } else if (formattedDate) {
            if (autoRenewActive) {
              renewalText = `Renews on ${formattedDate}`;
            } else if (isCancelRequested) {
              renewalText = `Active until ${formattedDate}`;
            } else {
              renewalText = formattedDate;
            }
          }

          const currentStatus = (subData?.status || restaurantInfo?.subscription_status || 'active').toLowerCase();
          const getStatusBadge = () => {
            if (isComplimentary) {
              return { text: '🎁 Lifetime Access', bg: '#F3E8FF', color: '#7E22CE', border: '#D8B4FE' };
            }
            if (currentStatus === 'trialing') {
              return { text: '🎁 Free Trial Active', bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' };
            }
            if (currentStatus === 'payment_failed') {
              return { text: '🔴 Payment Failed', bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' };
            }
            if (currentStatus === 'cancelled' || isCancelRequested) {
              return { text: '🟠 Auto-Renew Off', bg: '#FFF7ED', color: '#C2410C', border: '#FFEDD5' };
            }
            if (currentStatus === 'expired') {
              return { text: '🔴 Subscription Expired', bg: '#FEE2E2', color: '#991B1B', border: '#FCA5A5' };
            }
            if (currentStatus === 'pending') {
              return { text: '🟡 Processing', bg: '#FEF9C3', color: '#A16207', border: '#FEF08A' };
            }
            return { text: '🟢 Subscription Active', bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' };
          };

          const fallbackPlans = [
            {
              key: 'basic',
              name: 'Basic Starter Plan',
              price: 499,
              badge: '⚡ BASIC',
              description: 'Essential digital menu & QR ordering for small food joints & cafes',
              max_tables: 5,
              max_dishes: 50,
              max_categories: 10,
              kds_enabled: false,
              custom_domain_enabled: false,
              gst_invoice_enabled: true,
              dual_printer_enabled: false,
              whatsapp_enabled: false,
              direct_ordering_enabled: false
            },
            {
              key: 'pro',
              name: 'Pro Luxury Plan',
              price: 999,
              badge: '👑 PRO (MOST POPULAR)',
              description: 'Full-featured ordering, WhatsApp direct orders & live analytics',
              max_tables: 20,
              max_dishes: 200,
              max_categories: 30,
              kds_enabled: false,
              custom_domain_enabled: true,
              gst_invoice_enabled: true,
              dual_printer_enabled: false,
              whatsapp_enabled: true,
              direct_ordering_enabled: false
            },
            {
              key: 'enterprise',
              name: 'Enterprise VIP Plan',
              price: 1999,
              badge: '🚀 ENTERPRISE VIP',
              description: 'High-volume dining, Kitchen Display System (KDS) & dual printers',
              max_tables: 9999,
              max_dishes: 9999,
              max_categories: 9999,
              kds_enabled: true,
              custom_domain_enabled: true,
              gst_invoice_enabled: true,
              dual_printer_enabled: true,
              whatsapp_enabled: true,
              direct_ordering_enabled: true
            },
            {
              key: 'vip_ultra_plan',
              name: 'VIP Ultra Unlimited Plan',
              price: 2999,
              badge: '💎 VIP ULTRA',
              description: 'Unlimited physical spaces, KDS, custom domains & multi-counter printers',
              max_tables: 9999,
              max_dishes: 9999,
              max_categories: 9999,
              kds_enabled: true,
              custom_domain_enabled: true,
              gst_invoice_enabled: true,
              dual_printer_enabled: true,
              whatsapp_enabled: true,
              direct_ordering_enabled: true
            }
          ];

          const displayPlans = (availablePlans && availablePlans.length > 0) ? availablePlans : fallbackPlans;

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.85rem' }}>
              
              {/* Action Notification Alert */}
              {billingActionMsg && (
                <div style={{
                  padding: '12px 14px',
                  borderRadius: '12px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  background: billingActionMsg.type === 'error' ? '#FEE2E2' : '#ECFDF5',
                  color: billingActionMsg.type === 'error' ? '#DC2626' : '#047857',
                  border: `1px solid ${billingActionMsg.type === 'error' ? '#FECACA' : '#A7F3D0'}`
                }}>
                  <span>{billingActionMsg.text}</span>
                  <button
                    onClick={() => setBillingActionMsg(null)}
                    aria-label="Dismiss notification"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              {/* Scheduled Plan Change Banner */}
              {subData?.scheduled_plan_key && (
                <div style={{
                  padding: '12px 14px',
                  borderRadius: '12px',
                  background: '#FFFBEB',
                  border: '1.5px solid #FCD34D',
                  color: '#92400E',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  <Clock size={18} color="#D97706" style={{ flexShrink: 0 }} />
                  <div>
                    <strong>Scheduled Plan Change:</strong> Switching to <strong>{(subData.scheduled_plan_key).toUpperCase()}</strong> on {subData.plan_change_effective_at ? new Date(subData.plan_change_effective_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'next billing cycle'}.
                  </div>
                </div>
              )}

              {/* Sub Tab Navigation */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', background: '#F1F5F9', padding: '4px', borderRadius: '12px' }}>
                <button
                  onClick={() => setSubTab('overview')}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: 'none',
                    background: subTab === 'overview' ? '#FFFFFF' : 'transparent',
                    color: subTab === 'overview' ? '#0F172A' : '#64748B',
                    fontWeight: 800,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    boxShadow: subTab === 'overview' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px'
                  }}
                >
                  <CreditCard size={14} />
                  Overview
                </button>
                <button
                  onClick={() => setSubTab('plans')}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: 'none',
                    background: subTab === 'plans' ? '#FFFFFF' : 'transparent',
                    color: subTab === 'plans' ? '#0F172A' : '#64748B',
                    fontWeight: 800,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    boxShadow: subTab === 'plans' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px'
                  }}
                >
                  <Crown size={14} />
                  Plans
                </button>
                <button
                  onClick={() => setSubTab('history')}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: 'none',
                    background: subTab === 'history' ? '#FFFFFF' : 'transparent',
                    color: subTab === 'history' ? '#0F172A' : '#64748B',
                    fontWeight: 800,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    boxShadow: subTab === 'history' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px'
                  }}
                >
                  <History size={14} />
                  History
                </button>
              </div>

              {/* TAB 1: OVERVIEW */}
              {subTab === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  
                  {/* Status Banner For Warning / Expiry */}
                  {currentStatus === 'expired' && (
                    <div style={{ padding: '14px', borderRadius: '14px', background: '#FEF2F2', border: '1.5px solid #FECACA', color: '#991B1B' }}>
                      <strong style={{ fontSize: '0.90rem', display: 'block', marginBottom: '4px' }}>🔴 Subscription Expired</strong>
                      <p style={{ margin: '0 0 10px', fontSize: '0.80rem', lineHeight: 1.4 }}>
                        Your subscription has expired. Renew to continue using your restaurant dashboard.
                      </p>
                      <button
                        onClick={() => { setOpenDrawer(null); onOpenBillingModal(); }}
                        style={{
                          width: '100%', padding: '10px', borderRadius: '10px', border: 'none',
                          background: '#DC2626', color: '#FFF', fontWeight: 800, fontSize: '0.82rem',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                        }}
                      >
                        <RefreshCw size={14} />
                        Renew Subscription
                      </button>
                    </div>
                  )}

                  {currentStatus === 'payment_failed' && (
                    <div style={{ padding: '14px', borderRadius: '14px', background: '#FEF2F2', border: '1.5px solid #FECACA', color: '#991B1B' }}>
                      <strong style={{ fontSize: '0.90rem', display: 'block', marginBottom: '4px' }}>🔴 Payment Failed</strong>
                      <p style={{ margin: '0 0 10px', fontSize: '0.80rem', lineHeight: 1.4 }}>
                        Your payment could not be completed.{formattedDate ? ` Your access is still active until ${formattedDate}.` : ''}
                      </p>
                      <button
                        onClick={() => { setOpenDrawer(null); onOpenBillingModal(); }}
                        style={{
                          width: '100%', padding: '10px', borderRadius: '10px', border: 'none',
                          background: '#DC2626', color: '#FFF', fontWeight: 800, fontSize: '0.82rem',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                        }}
                      >
                        <RefreshCw size={14} />
                        Retry Payment
                      </button>
                    </div>
                  )}

                  {/* Clean Plan Card */}
                  <div style={{ background: '#FFFFFF', padding: '18px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                    
                    {/* Plan Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '14px', borderBottom: '1px solid #F1F5F9' }}>
                      <div>
                        <span style={{ fontSize: '0.70rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Current Plan</span>
                        <h3 style={{ margin: '2px 0 0', fontSize: '1.2rem', fontWeight: 900, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {activePlanKey === 'enterprise' ? '🚀' : activePlanKey === 'basic' ? '⚡' : '👑'} {activePlanKey.toUpperCase()}
                        </h3>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#059669' }}>
                          {isComplimentary ? 'FREE' : `₹${activePlanPrice}`}
                        </span>
                        {!isComplimentary && <span style={{ fontSize: '0.72rem', color: '#64748B', display: 'block' }}>/ month</span>}
                      </div>
                    </div>

                    {/* Status & Subscription Details */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '11px', paddingTop: '14px' }}>
                      
                      {/* Subscription Status */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#64748B', fontWeight: 600 }}>Status</span>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '20px',
                          fontSize: '0.74rem',
                          fontWeight: 800,
                          background: getStatusBadge().bg,
                          color: getStatusBadge().color,
                          border: `1px solid ${getStatusBadge().border}`
                        }}>
                          {getStatusBadge().text}
                        </span>
                      </div>

                      {/* Trial End or Next Renewal Date */}
                      {currentStatus === 'trialing' && formattedDate && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: '#64748B', fontWeight: 600 }}>Trial Ends</span>
                          <strong style={{ color: '#0F172A', fontWeight: 800 }}>{formattedDate}</strong>
                        </div>
                      )}

                      {currentStatus === 'trialing' && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: '#64748B', fontWeight: 600 }}>First Payment</span>
                          <strong style={{ color: '#059669', fontWeight: 800 }}>₹{activePlanPrice} / month</strong>
                        </div>
                      )}

                      {currentStatus !== 'trialing' && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: '#64748B', fontWeight: 600 }}>
                            {autoRenewActive ? 'Next Renewal' : isCancelRequested ? 'Access Until' : 'Billing Date'}
                          </span>
                          <strong style={{ color: '#0F172A', fontWeight: 800 }}>{renewalText}</strong>
                        </div>
                      )}

                      {/* Auto-Renew Status */}
                      {!isComplimentary && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: '#64748B', fontWeight: 600 }}>Auto-Renew</span>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '12px',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            background: autoRenewActive ? '#ECFDF5' : '#FFF7ED',
                            color: autoRenewActive ? '#047857' : '#C2410C',
                            border: `1px solid ${autoRenewActive ? '#A7F3D0' : '#FFEDD5'}`
                          }}>
                            {autoRenewActive ? '🟢 Auto-Renew ON' : '🟠 Auto-Renew OFF'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Primary & Secondary Actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    
                    {/* Primary Plan Action */}
                    {currentStatus !== 'expired' && currentStatus !== 'payment_failed' && (
                      <button
                        onClick={() => setSubTab('plans')}
                        style={{
                          width: '100%',
                          padding: '12px',
                          borderRadius: '12px',
                          border: 'none',
                          background: '#0F172A',
                          color: '#FFFFFF',
                          fontWeight: 900,
                          fontSize: '0.88rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px'
                        }}
                      >
                        <Crown size={16} />
                        Change Plan
                      </button>
                    )}

                    {/* Reactivate Auto-Renew if Cancelled */}
                    {!isComplimentary && isCancelRequested && currentStatus !== 'expired' && (
                      <button
                        onClick={() => { setOpenDrawer(null); onOpenBillingModal(); }}
                        style={{
                          width: '100%',
                          padding: '11px',
                          borderRadius: '12px',
                          border: '1px solid #86EFAC',
                          background: '#ECFDF5',
                          color: '#047857',
                          fontWeight: 800,
                          fontSize: '0.84rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px'
                        }}
                      >
                        <RefreshCw size={16} />
                        Reactivate Auto-Renew
                      </button>
                    )}

                    {/* Turn Off Auto-Renew if Active */}
                    {!isComplimentary && autoRenewActive && (
                      <button
                        onClick={() => setShowCancelModal(true)}
                        style={{
                          width: '100%',
                          padding: '11px',
                          borderRadius: '12px',
                          border: '1px solid #FECACA',
                          background: '#FEF2F2',
                          color: '#DC2626',
                          fontWeight: 800,
                          fontSize: '0.84rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px'
                        }}
                      >
                        <X size={16} />
                        Turn Off Auto-Renew
                      </button>
                    )}

                    {/* Secondary: View History */}
                    <button
                      onClick={() => setSubTab('history')}
                      style={{
                        width: '100%',
                        padding: '11px',
                        borderRadius: '12px',
                        border: '1px solid #CBD5E1',
                        background: '#FFFFFF',
                        color: '#0F172A',
                        fontWeight: 800,
                        fontSize: '0.84rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                      }}
                    >
                      <History size={16} />
                      View Payment History
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: PLANS COMPARISON */}
              {subTab === 'plans' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <span style={{ fontSize: '0.76rem', color: '#64748B', fontWeight: 600 }}>
                    Select a plan to upgrade or downgrade. Changes to active paid subscriptions schedule seamlessly at your next billing cycle.
                  </span>

                  {displayPlans.map(p => {
                    const isCurrent = p.key.toLowerCase() === activePlanKey;
                    const isScheduled = subData?.scheduled_plan_key?.toLowerCase() === p.key.toLowerCase();
                    const isUpgrade = Number(p.price) > Number(activePlanPrice);

                    return (
                      <div
                        key={p.key}
                        style={{
                          background: '#FFFFFF',
                          borderRadius: '14px',
                          border: isCurrent ? '2px solid #059669' : isScheduled ? '2px solid #D97706' : '1px solid #E2E8F0',
                          padding: '16px',
                          position: 'relative',
                          boxShadow: isCurrent ? '0 4px 14px rgba(5, 150, 105, 0.08)' : '0 2px 6px rgba(0,0,0,0.02)'
                        }}
                      >
                        {isCurrent && (
                          <span style={{
                            position: 'absolute', top: '12px', right: '12px',
                            background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0',
                            padding: '2px 8px', borderRadius: '10px', fontSize: '0.68rem', fontWeight: 900
                          }}>
                            ✓ CURRENT PLAN
                          </span>
                        )}

                        {isScheduled && (
                          <span style={{
                            position: 'absolute', top: '12px', right: '12px',
                            background: '#FFFBEB', color: '#D97706', border: '1px solid #FDE68A',
                            padding: '2px 8px', borderRadius: '10px', fontSize: '0.68rem', fontWeight: 900
                          }}>
                            🕒 SCHEDULED NEXT CYCLE
                          </span>
                        )}

                        <div>
                          <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#0F172A' }}>{p.name}</h4>
                          <div style={{ margin: '4px 0 10px', fontSize: '1.2rem', fontWeight: 900, color: '#059669' }}>
                            ₹{p.price} <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>/ {p.billing_interval || 'month'}</span>
                          </div>
                          <p style={{ margin: '0 0 12px', fontSize: '0.76rem', color: '#64748B', lineHeight: 1.4 }}>{p.description}</p>
                        </div>

                        {/* Entitlement Chips */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '0.74rem', marginBottom: '14px' }}>
                          <div style={{ background: '#F8FAFC', padding: '6px 8px', borderRadius: '8px', color: '#334155' }}>
                            🍽️ Spaces: <strong>{p.max_tables >= 9999 ? 'Unlimited' : p.max_tables}</strong>
                          </div>
                          <div style={{ background: '#F8FAFC', padding: '6px 8px', borderRadius: '8px', color: '#334155' }}>
                            🍛 Dishes: <strong>{p.max_dishes >= 9999 ? 'Unlimited' : p.max_dishes}</strong>
                          </div>
                          <div style={{ background: '#F8FAFC', padding: '6px 8px', borderRadius: '8px', color: '#334155' }}>
                            🍳 KDS: <strong>{p.kds_enabled ? '✅ Yes' : '❌ No'}</strong>
                          </div>
                          <div style={{ background: '#F8FAFC', padding: '6px 8px', borderRadius: '8px', color: '#334155' }}>
                            🌐 Domain: <strong>{p.custom_domain_enabled ? '✅ Yes' : '❌ No'}</strong>
                          </div>
                          <div style={{ background: '#F8FAFC', padding: '6px 8px', borderRadius: '8px', color: '#334155' }}>
                            🧾 GST: <strong>{p.gst_invoice_enabled ? '✅ Yes' : '❌ No'}</strong>
                          </div>
                          <div style={{ background: '#F8FAFC', padding: '6px 8px', borderRadius: '8px', color: '#334155' }}>
                            🖨️ Printer: <strong>{p.dual_printer_enabled ? '✅ Dual' : 'Single'}</strong>
                          </div>
                        </div>

                        {/* Plan Action Button */}
                        {isCurrent ? (
                          <button
                            disabled
                            style={{
                              width: '100%',
                              padding: '10px',
                              borderRadius: '10px',
                              border: '1px solid #CBD5E1',
                              background: '#F1F5F9',
                              color: '#94A3B8',
                              fontWeight: 800,
                              fontSize: '0.82rem',
                              cursor: 'not-allowed'
                            }}
                          >
                            ✓ Current Plan Active
                          </button>
                        ) : isScheduled ? (
                          <button
                            disabled
                            style={{
                              width: '100%',
                              padding: '10px',
                              borderRadius: '10px',
                              border: '1px solid #FCD34D',
                              background: '#FFFBEB',
                              color: '#D97706',
                              fontWeight: 800,
                              fontSize: '0.82rem',
                              cursor: 'not-allowed'
                            }}
                          >
                            🕒 Activation Scheduled
                          </button>
                        ) : (
                          <button
                            onClick={() => setPlanToChange(p)}
                            style={{
                              width: '100%',
                              padding: '10px',
                              borderRadius: '10px',
                              border: 'none',
                              background: isUpgrade ? '#059669' : '#0F172A',
                              color: '#FFFFFF',
                              fontWeight: 900,
                              fontSize: '0.82rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px'
                            }}
                          >
                            {isUpgrade ? <Zap size={14} /> : <ArrowDownRight size={14} />}
                            {isUpgrade ? `Upgrade to ${p.name}` : `Downgrade to ${p.name}`}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* TAB 3: PAYMENT HISTORY */}
              {subTab === 'history' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 600 }}>Billing & Transaction Records</span>
                    <button
                      onClick={loadPaymentHistoryData}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#059669',
                        fontWeight: 800,
                        fontSize: '0.74rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <RefreshCw size={12} />
                      Refresh
                    </button>
                  </div>

                  {paymentHistory.loading ? (
                    <div style={{ padding: '30px', textAlign: 'center', color: '#64748B', fontSize: '0.82rem' }}>
                      ⏳ Loading payment history...
                    </div>
                  ) : paymentHistory.error ? (
                    <div style={{ padding: '20px', textAlign: 'center', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '12px', color: '#DC2626', fontSize: '0.82rem' }}>
                      <p style={{ margin: '0 0 10px' }}>⚠️ Unable to load payment history.</p>
                      <button
                        onClick={loadPaymentHistoryData}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '8px',
                          border: 'none',
                          background: '#DC2626',
                          color: '#FFF',
                          fontWeight: 800,
                          fontSize: '0.76rem',
                          cursor: 'pointer'
                        }}
                      >
                        Retry
                      </button>
                    </div>
                  ) : paymentHistory.data.length === 0 ? (
                    <div style={{ padding: '30px', textAlign: 'center', background: '#F8FAFC', borderRadius: '12px', border: '1px dashed #CBD5E1', color: '#64748B', fontSize: '0.82rem' }}>
                      No payment history yet. Transactions will appear here once billing begins.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {paymentHistory.data.map((pay, idx) => {
                        const isSuccess = (pay.status || '').toUpperCase() === 'SUCCESS';
                        return (
                          <div
                            key={pay.id || idx}
                            style={{
                              background: '#FFFFFF',
                              padding: '12px 14px',
                              borderRadius: '12px',
                              border: '1px solid #E2E8F0',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: '8px'
                            }}
                          >
                            <div>
                              <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0F172A' }}>
                                ₹{pay.amount} <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>{pay.currency || 'INR'}</span>
                              </div>
                              <span style={{ fontSize: '0.72rem', color: '#64748B', display: 'block', marginTop: '2px' }}>
                                {pay.paid_at ? new Date(pay.paid_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : (pay.created_at ? new Date(pay.created_at).toLocaleDateString('en-IN') : 'N/A')}
                              </span>
                              <span style={{ fontSize: '0.68rem', color: '#94A3B8', display: 'block', marginTop: '1px' }}>
                                ID: {pay.gateway_payment_id || pay.id || 'N/A'} • {pay.gateway || 'cashfree'}
                              </span>
                            </div>

                            <div style={{ textAlign: 'right' }}>
                              <span style={{
                                padding: '3px 8px',
                                borderRadius: '10px',
                                fontSize: '0.70rem',
                                fontWeight: 900,
                                background: isSuccess ? '#ECFDF5' : '#FEF2F2',
                                color: isSuccess ? '#047857' : '#DC2626',
                                border: `1px solid ${isSuccess ? '#A7F3D0' : '#FECACA'}`
                              }}>
                                {isSuccess ? '✅ SUCCESS' : '❌ FAILED'}
                              </span>
                              <span style={{ fontSize: '0.70rem', color: '#64748B', display: 'block', marginTop: '4px', textTransform: 'capitalize' }}>
                                {pay.payment_type || 'recurring'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </AdminDrawer>

      {/* Drawer 6: Admin Security */}
      <AdminDrawer
        isOpen={openDrawer === 'security'}
        onClose={() => setOpenDrawer(null)}
        title="🔐 Admin Master Credentials"
        subtitle="Update owner username and login password"
        footer={(
          <button
            onClick={handleSecuritySave}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '12px',
              border: 'none',
              background: '#DC2626',
              color: '#FFFFFF',
              fontWeight: 900,
              fontSize: '0.90rem',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(220, 38, 38, 0.25)'
            }}
          >
            Update Security Credentials
          </button>
        )}
      >
        <form onSubmit={handleSecuritySave} style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.84rem' }}>
          {credMsg?.text && (
            <div style={{
              padding: '10px 14px', borderRadius: '10px', fontSize: '0.82rem', fontWeight: 800,
              background: credMsg.type === 'error' ? '#FEE2E2' : '#DCFCE7',
              color: credMsg.type === 'error' ? '#DC2626' : '#15803D',
              border: `1px solid ${credMsg.type === 'error' ? '#FECACA' : '#86EFAC'}`
            }}>
              {credMsg.text}
            </div>
          )}

          <div>
            <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0F172A', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Current Password (Required):
            </label>
            <input
              type="password"
              required
              value={credForm.currentPassword || ''}
              onChange={(e) => setCredForm({ ...credForm, currentPassword: e.target.value })}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.9rem', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0F172A', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              New Owner Username:
            </label>
            <input
              type="text"
              placeholder="Leave blank to keep unchanged"
              value={credForm.newUsername || ''}
              onChange={(e) => setCredForm({ ...credForm, newUsername: e.target.value })}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.9rem', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0F172A', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              New Password:
            </label>
            <input
              type="password"
              placeholder="Leave blank to keep unchanged"
              value={credForm.newPassword || ''}
              onChange={(e) => setCredForm({ ...credForm, newPassword: e.target.value })}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.9rem', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0F172A', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Confirm New Password:
            </label>
            <input
              type="password"
              placeholder="Re-enter new password"
              value={credForm.confirmPassword || ''}
              onChange={(e) => setCredForm({ ...credForm, confirmPassword: e.target.value })}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.9rem', boxSizing: 'border-box' }}
            />
          </div>

          {/* 🍳 KDS 4-Digit PIN Security Management */}
          <div style={{ margin: '14px 0 0 0', borderTop: '1px solid #E2E8F0', paddingTop: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <strong style={{ fontSize: '0.84rem', color: '#0F172A', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                🍳 Kitchen Display (KDS) PIN
              </strong>
              <span style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                padding: '3px 8px',
                borderRadius: '6px',
                background: restaurantInfo?.kds_pin_configured ? '#DCFCE7' : '#FEE2E2',
                color: restaurantInfo?.kds_pin_configured ? '#16A34A' : '#DC2626'
              }}>
                {restaurantInfo?.kds_pin_configured ? '🟢 PIN Active' : '🔴 Locked (No PIN)'}
              </span>
            </div>
            <p style={{ fontSize: '0.76rem', color: '#64748B', margin: '0 0 12px 0', lineHeight: 1.4 }}>
              Set a simple 4-digit PIN for your kitchen screen tablet (e.g. 1234). Kitchen cooks unlock live orders without full admin access. Updating this PIN automatically logs out existing kitchen screens.
            </p>

            {kdsPinMsg?.text && (
              <div style={{
                padding: '10px 14px', borderRadius: '10px', fontSize: '0.82rem', fontWeight: 800, marginBottom: '12px',
                background: kdsPinMsg.type === 'error' ? '#FEE2E2' : '#DCFCE7',
                color: kdsPinMsg.type === 'error' ? '#DC2626' : '#15803D',
                border: `1px solid ${kdsPinMsg.type === 'error' ? '#FECACA' : '#86EFAC'}`
              }}>
                {kdsPinMsg.text}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                type="password"
                maxLength={4}
                placeholder="4-digit PIN"
                value={kdsPinInput}
                onChange={(e) => setKdsPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                style={{
                  width: '130px', padding: '10px 14px', borderRadius: '10px', border: '1px solid #CBD5E1',
                  fontSize: '1.1rem', fontWeight: 800, textAlign: 'center', letterSpacing: '4px', boxSizing: 'border-box'
                }}
              />
              <button
                type="button"
                disabled={savingKdsPin || kdsPinInput.length !== 4}
                onClick={handleSaveKdsPin}
                style={{
                  flex: 1, padding: '11px 16px', borderRadius: '10px', border: 'none',
                  background: kdsPinInput.length === 4 ? '#2563EB' : '#94A3B8',
                  color: '#FFFFFF', fontWeight: 800, fontSize: '0.82rem',
                  cursor: kdsPinInput.length === 4 && !savingKdsPin ? 'pointer' : 'not-allowed'
                }}
              >
                {savingKdsPin ? 'Saving...' : (restaurantInfo?.kds_pin_configured ? 'Update KDS PIN' : 'Set KDS PIN')}
              </button>
            </div>
          </div>
        </form>
      </AdminDrawer>

      {/* Drawer 7: Dedicated Cinema Management Drawer */}
      {isCinema && (
        <AdminDrawer
          isOpen={openDrawer === 'cinema'}
          onClose={() => {
            setOpenDrawer(null);
            setSelectedScreenForSeats(null);
          }}
          title="🎬 Cinema Management"
          subtitle="Configure auditorium screens, rows and seats for seat-based QR ordering"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Header Action Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <strong style={{ fontSize: '0.98rem', color: '#0F172A', fontWeight: 900, display: 'block' }}>
                  Auditorium Screens & Seats
                </strong>
                <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>
                  Manage screen layouts and generate unique cryptographic seat QR codes
                </span>
              </div>

              {!selectedScreenForSeats && (
                <button
                  type="button"
                  onClick={handleOpenAddScreen}
                  className="adm-btn adm-btn-primary adm-btn-sm"
                  style={{ fontWeight: 800 }}
                >
                  <Plus size={15} /> Add Screen
                </button>
              )}
            </div>

            {/* Feedback Message Banner */}
            {cinemaMsg && (
              <div style={{
                padding: '10px 14px',
                borderRadius: '10px',
                fontSize: '0.82rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                background: cinemaMsg.type === 'success' ? '#F0FDF4' : '#FEF2F2',
                border: `1px solid ${cinemaMsg.type === 'success' ? '#BBF7D0' : '#FECACA'}`,
                color: cinemaMsg.type === 'success' ? '#166534' : '#991B1B'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {cinemaMsg.type === 'success' ? <Check size={16} /> : <AlertTriangle size={16} />}
                  <span>{cinemaMsg.text}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setCinemaMsg(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: '2px' }}
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Loading State */}
            {loadingCinema && (
              <div style={{ padding: '16px', textAlign: 'center', color: '#64748B', fontSize: '0.82rem', fontWeight: 700 }}>
                ⏳ Loading configured auditorium screens & seats...
              </div>
            )}

            {/* VIEW A: SCREENS LIST (Default View) */}
            {!selectedScreenForSeats && !loadingCinema && (
              <div>
                {cinemaScreens.length === 0 ? (
                  <div style={{
                    padding: '28px 20px',
                    background: '#F8FAFC',
                    borderRadius: '12px',
                    border: '1.5px dashed #CBD5E1',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '10px'
                  }}>
                    <div style={{ fontSize: '2.2rem' }}>🎬</div>
                    <strong style={{ fontSize: '1rem', color: '#0F172A' }}>No Cinema Screens Configured</strong>
                    <p style={{ fontSize: '0.80rem', color: '#64748B', margin: 0, maxWidth: '360px' }}>
                      Create your first auditorium screen and add rows/seats to enable seat QR ordering.
                    </p>
                    <button
                      type="button"
                      onClick={handleOpenAddScreen}
                      className="adm-btn adm-btn-primary"
                      style={{ marginTop: '8px', fontWeight: 800, padding: '10px 18px' }}
                    >
                      <Plus size={16} /> Add Screen
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {cinemaScreens.map(screen => {
                      const screenSeats = cinemaSeats.filter(st => String(st.screen_id) === String(screen.id) && st.active !== false);
                      const seatCount = screenSeats.length;
                      return (
                        <div
                          key={screen.id}
                          style={{
                            padding: '14px 16px',
                            background: '#FFFFFF',
                            borderRadius: '12px',
                            border: '1px solid #E2E8F0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '10px',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                              width: '38px',
                              height: '38px',
                              borderRadius: '10px',
                              background: screen.active !== false ? '#F1F5F9' : '#FEE2E2',
                              color: screen.active !== false ? '#0F172A' : '#EF4444',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 900,
                              fontSize: '0.92rem'
                            }}>
                              S{screen.screen_number}
                            </div>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <strong style={{ fontSize: '0.94rem', color: '#0F172A', fontWeight: 800 }}>
                                  {screen.name || `Screen ${screen.screen_number}`}
                                </strong>
                                <span style={{
                                  fontSize: '0.7rem',
                                  fontWeight: 800,
                                  padding: '1px 6px',
                                  borderRadius: '10px',
                                  background: screen.active !== false ? '#DCFCE7' : '#F3F4F6',
                                  color: screen.active !== false ? '#15803D' : '#6B7280'
                                }}>
                                  {screen.active !== false ? 'Active' : 'Inactive'}
                                </span>
                              </div>
                              <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>
                                {seatCount} {seatCount === 1 ? 'Seat' : 'Seats'} Configured
                              </span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedScreenForSeats(screen);
                                setBulkSeatForm({ row_label: 'A', seat_start: 1, seat_end: 20 });
                                setCinemaMsg(null);
                              }}
                              className="adm-btn adm-btn-primary adm-btn-sm"
                              style={{ fontWeight: 800, padding: '6px 12px', fontSize: '0.78rem' }}
                            >
                              💺 Manage Seats
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditScreen(screen)}
                              className="adm-btn adm-btn-secondary adm-btn-sm"
                              style={{ padding: '6px 10px', fontSize: '0.78rem' }}
                              title="Edit Screen"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteScreen(screen)}
                              className="adm-btn adm-btn-danger adm-btn-sm"
                              style={{ padding: '6px 10px', fontSize: '0.78rem' }}
                              title="Delete Screen"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* VIEW B: SEAT MANAGEMENT FOR SELECTED SCREEN */}
            {selectedScreenForSeats && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Top Bar with Back Button */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', borderBottom: '1px solid #E2E8F0', paddingBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setSelectedScreenForSeats(null)}
                      className="adm-btn adm-btn-secondary adm-btn-sm"
                      style={{ fontWeight: 800 }}
                    >
                      ← Back to Screens
                    </button>
                    <div>
                      <strong style={{ fontSize: '0.95rem', color: '#0F172A' }}>
                        Screen {selectedScreenForSeats.screen_number}: {selectedScreenForSeats.name}
                      </strong>
                      <span style={{ fontSize: '0.72rem', color: '#64748B', display: 'block' }}>
                        Configure seat layout and manage row ranges
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bulk Add Row / Seats Form */}
                <div style={{ padding: '14px 16px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #CBD5E1', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <strong style={{ fontSize: '0.84rem', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    ➕ Add / Configure Seats by Row
                  </strong>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '4px' }}>
                        ROW LETTER:
                      </label>
                      <input
                        type="text"
                        maxLength={2}
                        placeholder="e.g. A"
                        value={bulkSeatForm.row_label}
                        onChange={(e) => setBulkSeatForm({ ...bulkSeatForm, row_label: e.target.value.toUpperCase() })}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontWeight: 800, fontSize: '0.86rem', textTransform: 'uppercase' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '4px' }}>
                        START SEAT:
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={bulkSeatForm.seat_start}
                        onChange={(e) => setBulkSeatForm({ ...bulkSeatForm, seat_start: parseInt(e.target.value, 10) || 1 })}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontWeight: 800, fontSize: '0.86rem' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '4px' }}>
                        END SEAT:
                      </label>
                      <input
                        type="number"
                        min={bulkSeatForm.seat_start || 1}
                        max={100}
                        value={bulkSeatForm.seat_end}
                        onChange={(e) => setBulkSeatForm({ ...bulkSeatForm, seat_end: parseInt(e.target.value, 10) || 1 })}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontWeight: 800, fontSize: '0.86rem' }}
                      />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                      <button
                        type="button"
                        onClick={handleBatchCreateSeats}
                        disabled={savingSeats}
                        className="adm-btn adm-btn-primary"
                        style={{ width: '100%', padding: '8px 14px', fontWeight: 800, fontSize: '0.82rem' }}
                      >
                        {savingSeats ? 'Creating...' : '+ Create Seats'}
                      </button>
                    </div>
                  </div>

                  {bulkSeatForm.row_label && (
                    <div style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>
                      Preview: <strong>Row {bulkSeatForm.row_label.toUpperCase()}</strong> • Seats {bulkSeatForm.seat_start}–{bulkSeatForm.seat_end} ({Math.max(0, bulkSeatForm.seat_end - bulkSeatForm.seat_start + 1)} seats)
                    </div>
                  )}
                </div>

                {/* Configured Seats Grid Grouped by Row */}
                <div>
                  <strong style={{ fontSize: '0.82rem', color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                    Configured Seats for Screen {selectedScreenForSeats.screen_number}:
                  </strong>

                  {(() => {
                    const screenSeats = cinemaSeats.filter(st => String(st.screen_id) === String(selectedScreenForSeats.id) && st.active !== false);
                    if (screenSeats.length === 0) {
                      return (
                        <div style={{ padding: '18px', background: '#F8FAFC', borderRadius: '10px', border: '1px dashed #CBD5E1', textAlign: 'center', fontSize: '0.8rem', color: '#64748B' }}>
                          No seats configured yet for this screen. Use the builder above to add your first row of seats.
                        </div>
                      );
                    }

                    // Group by row_label
                    const rowMap = {};
                    screenSeats.forEach(st => {
                      const r = st.row_label || 'A';
                      if (!rowMap[r]) rowMap[r] = [];
                      rowMap[r].push(st);
                    });

                    const sortedRows = Object.keys(rowMap).sort();

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {sortedRows.map(rowLetter => {
                          const rowSeats = rowMap[rowLetter].sort((a, b) => Number(a.seat_number) - Number(b.seat_number));
                          return (
                            <div
                              key={rowLetter}
                              style={{
                                padding: '10px 14px',
                                background: '#FFFFFF',
                                borderRadius: '10px',
                                border: '1px solid #E2E8F0',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                flexWrap: 'wrap'
                              }}
                            >
                              <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '6px',
                                background: '#0A2315',
                                color: '#D4AF37',
                                fontWeight: 900,
                                fontSize: '0.88rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}>
                                {rowLetter}
                              </div>

                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', flex: 1 }}>
                                {rowSeats.map(seat => (
                                  <span
                                    key={seat.id}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      padding: '3px 8px',
                                      borderRadius: '6px',
                                      background: '#F1F5F9',
                                      border: '1px solid #CBD5E1',
                                      fontSize: '0.74rem',
                                      fontWeight: 800,
                                      color: '#0F172A'
                                    }}
                                  >
                                    <span>{seat.row_label}{seat.seat_number}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteSeat(seat)}
                                      title={`Delete Seat ${seat.seat_code}`}
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#94A3B8',
                                        cursor: 'pointer',
                                        padding: 0,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        marginLeft: '2px'
                                      }}
                                      onMouseEnter={(e) => { e.currentTarget.style.color = '#EF4444'; }}
                                      onMouseLeave={(e) => { e.currentTarget.style.color = '#94A3B8'; }}
                                    >
                                      <X size={12} />
                                    </button>
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* ADD / EDIT SCREEN MODAL */}
            {showScreenModal && (
              <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 99999,
                padding: '16px'
              }}>
                <div style={{
                  background: '#FFFFFF',
                  borderRadius: '16px',
                  width: '100%',
                  maxWidth: '420px',
                  padding: '24px',
                  boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <strong style={{ fontSize: '1.05rem', color: '#0F172A' }}>
                      {editingScreen ? '✏️ Edit Cinema Screen' : '🎬 Add Cinema Screen'}
                    </strong>
                    <button
                      type="button"
                      onClick={() => setShowScreenModal(false)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <form onSubmit={handleSaveScreen} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '0.76rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '4px' }}>
                        SCREEN NUMBER:
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={99}
                        disabled={Boolean(editingScreen)}
                        value={screenForm.screen_number}
                        onChange={(e) => setScreenForm({ ...screenForm, screen_number: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: '1px solid #CBD5E1',
                          fontWeight: 800,
                          background: editingScreen ? '#F1F5F9' : '#FFFFFF'
                        }}
                        placeholder="e.g. 1"
                      />
                      {editingScreen && (
                        <span style={{ fontSize: '0.7rem', color: '#64748B', marginTop: '2px', display: 'block' }}>
                          Screen number cannot be changed after creation.
                        </span>
                      )}
                    </div>

                    <div>
                      <label style={{ fontSize: '0.76rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '4px' }}>
                        SCREEN NAME:
                      </label>
                      <input
                        type="text"
                        maxLength={100}
                        value={screenForm.name}
                        onChange={(e) => setScreenForm({ ...screenForm, name: e.target.value })}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontWeight: 800 }}
                        placeholder="e.g. Audi 1 - Dolby Atmos"
                      />
                    </div>

                    {editingScreen && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                        <input
                          type="checkbox"
                          id="screenActiveCheckbox"
                          checked={screenForm.active}
                          onChange={(e) => setScreenForm({ ...screenForm, active: e.target.checked })}
                        />
                        <label htmlFor="screenActiveCheckbox" style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0F172A', cursor: 'pointer' }}>
                          Screen is active and accepting QR orders
                        </label>
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setShowScreenModal(false)}
                        className="adm-btn adm-btn-secondary"
                        style={{ fontWeight: 800 }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={savingScreen}
                        className="adm-btn adm-btn-primary"
                        style={{ fontWeight: 800 }}
                      >
                        {savingScreen ? 'Saving...' : (editingScreen ? 'Save Changes' : 'Create Screen')}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        </AdminDrawer>
      )}

      {/* Modal: Confirm Cancel Auto-Renew */}
      {showCancelModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 11000,
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: '20px', maxWidth: '440px', width: '100%',
            padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.25)', animation: 'fadeIn 0.2s ease-out'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#FEF2F2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#0F172A' }}>Turn off automatic renewal?</h3>
                <span style={{ fontSize: '0.78rem', color: '#64748B' }}>Your current period remains active</span>
              </div>
            </div>

            <p style={{ fontSize: '0.84rem', color: '#475569', lineHeight: 1.5, margin: '0 0 20px' }}>
              Your current subscription will remain active until the end of your paid billing cycle. After this date, automatic renewal will not occur, and your restaurant will transition to inactive unless renewed.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                disabled={actionLoading}
                onClick={() => setShowCancelModal(false)}
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  color: '#475569',
                  fontWeight: 800,
                  fontSize: '0.84rem',
                  cursor: 'pointer'
                }}
              >
                Keep Auto-Renew
              </button>
              <button
                disabled={actionLoading}
                onClick={handleCancelAutoRenew}
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#DC2626',
                  color: '#FFFFFF',
                  fontWeight: 900,
                  fontSize: '0.84rem',
                  cursor: actionLoading ? 'not-allowed' : 'pointer',
                  opacity: actionLoading ? 0.7 : 1
                }}
              >
                {actionLoading ? 'Cancelling...' : 'Turn Off Auto-Renew'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirm Plan Change (Upgrade / Downgrade) */}
      {planToChange && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 11000,
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: '20px', maxWidth: '460px', width: '100%',
            padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.25)', animation: 'fadeIn 0.2s ease-out'
          }}>
            {(() => {
              const currentPlanPrice = subData?.plan_price || restaurantInfo?.plan_price || 999;
              const isUpgrade = Number(planToChange.price) > Number(currentPlanPrice);
              const isTrial = (subData?.status || restaurantInfo?.subscription_status) === 'trialing';
              const rawDate = subData?.current_period_end || subData?.trial_ends_at || restaurantInfo?.access_until;
              const formattedDate = rawDate ? new Date(rawDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null;

              return (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                    <div style={{
                      width: '42px', height: '42px', borderRadius: '50%',
                      background: isUpgrade ? '#ECFDF5' : '#FFFBEB',
                      color: isUpgrade ? '#059669' : '#D97706',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      {isUpgrade ? <Zap size={22} /> : <ArrowDownRight size={22} />}
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#0F172A' }}>
                        Confirm {isUpgrade ? 'Upgrade' : 'Downgrade'}
                      </h3>
                      <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
                        Switching to {planToChange.name} (₹{planToChange.price}/mo)
                      </span>
                    </div>
                  </div>

                  <div style={{ background: '#F8FAFC', padding: '14px', borderRadius: '12px', border: '1px solid #E2E8F0', marginBottom: '14px', fontSize: '0.82rem', color: '#334155', lineHeight: 1.5 }}>
                    {isTrial ? (
                      <div>
                        🚀 <strong>Immediate Trial Switch:</strong> Your trial continues unchanged until <strong>{formattedDate || 'trial end'}</strong>. Your new plan price of ₹{planToChange.price}/month will apply starting on your first billing cycle.
                      </div>
                    ) : (
                      <div>
                        🕒 <strong>Scheduled Plan Change:</strong> Your current plan continues until <strong>{formattedDate || 'your next billing date'}</strong>. <strong>{planToChange.name}</strong> (₹{planToChange.price}/month) will activate from your next billing cycle.
                      </div>
                    )}
                  </div>

                  {!isUpgrade && (
                    <div style={{
                      background: '#FFFBEB',
                      border: '1px solid #FCD34D',
                      borderRadius: '12px',
                      padding: '12px 14px',
                      marginBottom: '18px',
                      fontSize: '0.78rem',
                      color: '#92400E',
                      lineHeight: 1.4
                    }}>
                      ⚠️ <strong>Data Safety:</strong> Lower limits will apply to future space and menu additions. Your existing tables, cabins, VIP lounges, dishes, categories, and custom domain configuration remain <strong>100% preserved</strong>.
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <button
                      disabled={actionLoading}
                      onClick={() => setPlanToChange(null)}
                      style={{
                        padding: '12px',
                        borderRadius: '10px',
                        border: '1px solid #CBD5E1',
                        background: '#FFFFFF',
                        color: '#475569',
                        fontWeight: 800,
                        fontSize: '0.84rem',
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      disabled={actionLoading}
                      onClick={handleConfirmPlanChange}
                      style={{
                        padding: '12px',
                        borderRadius: '10px',
                        border: 'none',
                        background: isUpgrade ? '#059669' : '#0F172A',
                        color: '#FFFFFF',
                        fontWeight: 900,
                        fontSize: '0.84rem',
                        cursor: actionLoading ? 'not-allowed' : 'pointer',
                        opacity: actionLoading ? 0.7 : 1
                      }}
                    >
                      {actionLoading ? 'Processing...' : `Confirm ${isUpgrade ? 'Upgrade' : 'Downgrade'}`}
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
