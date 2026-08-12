import React, { useState, useEffect } from 'react';
import { fetchCategories, fetchDishes, toggleDishAvailability, toggleCategoryActive, deleteDish, deleteCategory, fetchRestaurantInfo, updateDishPrice, fetchAnnouncements, fetchAdminOrders, updateOrderStatus, uploadImage, fetchServiceRequests, resolveServiceRequest, fetchAdminAnalytics, fetchAdminCombos, createCombo, updateCombo, deleteCombo, toggleComboAvailability, optimizeDatabase } from '../../api/client';
import { getPlanDetails } from '../../config/plans';
import DishFormModal from './DishFormModal';
import CategoryFormModal from './CategoryFormModal';
import ComboFormModal from './ComboFormModal';
import { Plus, Edit, Trash2, Eye, EyeOff, LogOut, ArrowLeft, Layers, Utensils, QrCode, Printer, Settings, Star, CheckCircle, Lock, ExternalLink, Megaphone, MessageSquare, Palette, Sparkles, Clock, CheckCircle2, XCircle, Upload, X, BarChart2, TrendingUp, Download, Award, MapPin, RefreshCw, CreditCard } from 'lucide-react';

import PaymentModal from '../PaymentModal';

import './styles/Admin.css';
import AdminHeader from './components/AdminHeader';
import AdminBottomNavigation from './components/AdminBottomNavigation';
import AdminDesktopNavigation from './components/AdminDesktopNavigation';
import OrdersView from './views/OrdersView';
import AnalyticsView from './views/AnalyticsView';
import MenuView from './views/MenuView';
import SetupView from './views/SetupView';
import QrGeneratorView from './views/QrGeneratorView';
import ReviewView from './views/ReviewView';

export default function AdminDashboard({ token, username, onLogout, onReturnToMenu }) {
  const getInitialAdminState = (key, fallback) => {
    try {
      const saved = localStorage.getItem(`admin_cache_${key}`);
      return saved ? JSON.parse(saved) : fallback;
    } catch {
      return fallback;
    }
  };

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [activeTab, setActiveTab] = useState('dishes'); // 'dishes', 'categories', 'qr-generator', 'settings'
  const [categories, setCategories] = useState(() => getInitialAdminState('categories', []));
  const [dishes, setDishes] = useState(() => getInitialAdminState('dishes', []));
  const [announcements, setAnnouncements] = useState([]);
  const [dismissedNotice, setDismissedNotice] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCatFilter, setSelectedCatFilter] = useState('all');
  const [editingPriceId, setEditingPriceId] = useState(null);
  const [quickPriceVal, setQuickPriceVal] = useState({ price: '', price_half: '' });

  // QR Code Generator State
  const [tableNumber, setTableNumber] = useState('1');
  const [qrGenerated, setQrGenerated] = useState(false);

  // Live Orders (KOT) & Analytics State
  const [orders, setOrders] = useState(() => getInitialAdminState('orders', []));
  const [serviceRequests, setServiceRequests] = useState([]);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [billOrderModal, setBillOrderModal] = useState(null);
  const [kotFilter, setKotFilter] = useState('all');
  const [prevPendingCount, setPrevPendingCount] = useState(0);
  const [restaurantInfo, setRestaurantInfo] = useState(() => getInitialAdminState('info', null));

  const [combos, setCombos] = useState(() => getInitialAdminState('combos', []));
  const [comboModalData, setComboModalData] = useState(null);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [masterSupportPhone, setMasterSupportPhone] = useState('919876543210');
  const [showOnboardingGuide, setShowOnboardingGuide] = useState(true);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showPrinterModal, setShowPrinterModal] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const [billingModal, setBillingModal] = useState(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);

  // Settings Accordion Folders State
  const [openSettingsSections, setOpenSettingsSections] = useState({
    profile: true,
    permissions: false,
    billing: false,
    security: false
  });

  const toggleSettingsSection = (sectionKey) => {
    setOpenSettingsSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data && data.support_whatsapp) {
          setMasterSupportPhone(data.support_whatsapp);
        }
      })
      .catch(() => {});
  }, []);

  const getDaysRemaining = (expiryStr) => {
    if (!expiryStr) return null;
    const expiry = new Date(expiryStr);
    const now = new Date();
    const diffTime = expiry - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const daysLeft = getDaysRemaining(restaurantInfo?.plan_expires_at);
  const isExpired = (daysLeft !== null && daysLeft <= 0) || (restaurantInfo?.active === false || restaurantInfo?.active === 0);

  useEffect(() => {
    // 🔔 1. Auto-Prompt Browser Push Notification Permission
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        setPermissionsGranted(true);
      } else if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            setPermissionsGranted(true);
          }
        }).catch(e => console.warn('Auto Notification permission error:', e));
      }
    }

    // 📍 2. Auto-Prompt GPS Geolocation Permission & Auto-Save Coordinates to DB
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          console.log('📍 Auto GPS location granted:', lat, lng);
          setSettingsForm(prev => ({ ...prev, latitude: lat, longitude: lng }));
          if (token) {
            updateTenantSettings(token, { latitude: lat, longitude: lng }).catch(e => console.warn('Auto GPS save error:', e));
          }
        },
        (err) => console.warn('Auto GPS location skipped:', err),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }

    // 🔊 3. Unlock Web Audio Context on first tap/click anywhere
    const unlockAudioOnTouch = () => {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          if (ctx.state === 'suspended') {
            ctx.resume();
          }
        }
      } catch (e) {}
      window.removeEventListener('click', unlockAudioOnTouch);
      window.removeEventListener('touchstart', unlockAudioOnTouch);
    };

    window.addEventListener('click', unlockAudioOnTouch);
    window.addEventListener('touchstart', unlockAudioOnTouch);

    return () => {
      window.removeEventListener('click', unlockAudioOnTouch);
      window.removeEventListener('touchstart', unlockAudioOnTouch);
    };
  }, [token]);

  const requestAudioPermission = () => {
    try {
      playKitchenChime();
      setPermissionsGranted(true);
      setToastMessage('🔊 Order Siren Alarm Active & Ringtone Sound Unlocked!');
      setTimeout(() => setToastMessage(''), 4000);
    } catch (e) {
      console.warn('Audio test error:', e);
    }
  };

  const requestNotificationPermission = async () => {
    try {
      if ('Notification' in window) {
        const res = await Notification.requestPermission();
        if (res === 'granted') {
          setToastMessage('🔔 Push Notifications Granted! You will receive live order popups.');
        } else {
          setToastMessage('⚠️ Notifications Blocked. Please allow notifications in browser permissions.');
        }
      } else {
        setToastMessage('⚠️ Push notifications not supported on this browser.');
      }
      setTimeout(() => setToastMessage(''), 4000);
    } catch (e) {
      console.warn('Notification error:', e);
    }
  };

  const requestGpsPermission = () => {
    if (!('geolocation' in navigator)) {
      setToastMessage('⚠️ GPS Geolocation not supported on this device.');
      setTimeout(() => setToastMessage(''), 4000);
      return;
    }
    setToastMessage('📍 Detecting GPS Location...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setSettingsForm(prev => ({ ...prev, latitude: lat, longitude: lng }));
        if (token) {
          updateTenantSettings(token, { latitude: lat, longitude: lng }).then(() => {
            setToastMessage(`✨ GPS Coordinates Captured & Auto-Saved! (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
            setTimeout(() => setToastMessage(''), 5000);
          }).catch(() => {
            setToastMessage(`📍 GPS Coordinates Captured! (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
            setTimeout(() => setToastMessage(''), 5000);
          });
        }
      },
      (err) => {
        setToastMessage('⚠️ GPS Access Denied. Please enable Location in browser settings.');
        setTimeout(() => setToastMessage(''), 5000);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const requestDevicePermissions = async () => {
    requestAudioPermission();
    requestNotificationPermission();
    requestGpsPermission();
  };

  const playKitchenChime = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      // 🚨 Super Loud Zomato/Swiggy Style 6-Cycle Emergency Order Siren Ringtone 🚨
      const pulses = [
        { freq1: 1050, freq2: 1550, start: 0.0 },
        { freq1: 1250, freq2: 1750, start: 0.35 },
        { freq1: 1050, freq2: 1550, start: 0.70 },
        { freq1: 1400, freq2: 1950, start: 1.05 },
        { freq1: 1250, freq2: 1750, start: 1.40 },
        { freq1: 1550, freq2: 2100, start: 1.75 }
      ];

      pulses.forEach(p => {
        const t = ctx.currentTime + p.start;

        // Sharp Piercing Siren Tone 1 (Sawtooth)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(p.freq1, t);
        osc1.frequency.linearRampToValueAtTime(p.freq2, t + 0.14);
        gain1.gain.setValueAtTime(0.8, t);
        gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(t);
        osc1.stop(t + 0.28);

        // High Alarm Resonance Tone 2 (Square)
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(p.freq2, t + 0.12);
        osc2.frequency.linearRampToValueAtTime(p.freq1, t + 0.26);
        gain2.gain.setValueAtTime(0.7, t + 0.12);
        gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.30);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(t + 0.12);
        osc2.stop(t + 0.30);
      });
    } catch (e) {
      console.warn('Loud Kitchen Alarm error:', e);
    }
  };

  const triggerBackgroundNotification = (count) => {
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        const notif = new Notification('🛎️ NEW LIVE ORDER RECEIVED!', {
          body: `You have ${count} new pending order(s)! Click to view order details & print KOT.`,
          icon: '/favicon.svg',
          badge: '/favicon.svg',
          tag: 'new-order',
          requireInteraction: true, // Keeps notification active on screen until clicked
          vibrate: [300, 100, 300, 100, 300]
        });
        notif.onclick = () => {
          window.focus();
          notif.close();
        };
      }
      if ('vibrate' in navigator) {
        navigator.vibrate([300, 100, 300, 100, 300]);
      }
    } catch (e) {
      console.warn('Background notification error:', e);
    }
  };

  const loadOrders = async () => {
    try {
      const [data, reqsData, analytics] = await Promise.all([
        fetchAdminOrders(token).catch(() => []),
        fetchServiceRequests(token).catch(() => []),
        fetchAdminAnalytics(token).catch(() => null)
      ]);
      const safeData = Array.isArray(data) ? data : [];
      const safeReqs = Array.isArray(reqsData) ? reqsData : [];

      const pendingCount = safeData.filter(o => o.status === 'pending').length + safeReqs.length;
      if (pendingCount > prevPendingCount) {
        playKitchenChime();
        triggerBackgroundNotification(pendingCount);
      }
      setPrevPendingCount(pendingCount);
      setOrders(safeData);
      try {
        localStorage.setItem('admin_cache_orders', JSON.stringify(safeData));
      } catch (e) {}
      setServiceRequests(safeReqs);
      if (analytics) setAnalyticsData(analytics);
    } catch (err) {
      console.error('Failed to load orders & requests:', err);
    }
  };

  const handleDownloadSalesReport = () => {
    if (!orders || orders.length === 0) {
      alert('No sales data available to export');
      return;
    }

    const getDateParts = (dateStr) => {
      if (!dateStr) return { date: 'N/A', time: 'N/A' };
      const str = String(dateStr).trim();
      let d = new Date(str);
      if (isNaN(d.getTime())) {
        d = new Date(str.replace(' ', 'T'));
      }
      if (!isNaN(d.getTime())) {
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        let hours = d.getHours();
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        const formattedHours = String(hours).padStart(2, '0');
        return { date: `${day}/${month}/${year}`, time: `${formattedHours}:${minutes} ${ampm}` };
      }
      const parts = str.split(' ');
      if (parts.length >= 2) return { date: parts[0], time: parts[1] };
      return { date: str, time: 'N/A' };
    };

    const headers = ['Order ID', 'Date', 'Time', 'Table No', 'Total Amount (Rs)', 'Status', 'Items Ordered'];
    const rows = orders.map(o => {
      const itemsList = typeof o.items === 'string' ? JSON.parse(o.items) : (Array.isArray(o.items) ? o.items : []);
      const itemSummary = itemsList.map(i => `${i.name}${i.portion ? ' (' + i.portion + ')' : ''} x${i.quantity}`).join('; ');
      const { date, time } = getDateParts(o.created_at);
      return [
        o.id,
        `"'${date}"`,
        `"'${time}"`,
        `"Table ${o.table_number || '1'}"`,
        o.total_amount,
        `"${o.status ? o.status.toUpperCase() : 'PENDING'}"`,
        `"${itemSummary.replace(/"/g, '""')}"`
      ].join(',');
    });

    const csvData = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Sales_Report_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleResolveServiceRequest = async (id) => {
    try {
      await resolveServiceRequest(id, token);
      setServiceRequests(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      alert(err.message || 'Failed to resolve request');
    }
  };

  const parseDateRobust = (dateStr) => {
    if (!dateStr) return new Date();
    let str = String(dateStr).trim();
    if (!str.includes('Z') && !str.includes('+') && !str.includes('T')) {
      str = str.replace(' ', 'T') + 'Z';
    } else if (!str.includes('Z') && !str.includes('+')) {
      str = str + 'Z';
    }
    let d = new Date(str);
    if (isNaN(d.getTime())) d = new Date(dateStr);
    return d;
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '';
    try {
      let d = parseDateRobust(dateStr);
      if (!isNaN(d.getTime())) {
        const datePart = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        const timePart = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
        return `${datePart} • ${timePart}`;
      }
    } catch (e) {}
    return String(dateStr);
  };

  const getSeatedTimeInfo = (dateStr) => {
    if (!dateStr) return { timeStr: '', agoStr: '' };
    try {
      let d = parseDateRobust(dateStr);
      if (!isNaN(d.getTime())) {
        const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
        const now = new Date();
        const diffMs = Math.max(0, now.getTime() - d.getTime());
        const diffMins = Math.floor(diffMs / 60000);

        let agoStr = 'Just now';
        if (diffMins >= 1 && diffMins < 60) agoStr = `${diffMins}m ago`;
        else if (diffMins >= 60) {
          const hrs = Math.floor(diffMins / 60);
          const mins = diffMins % 60;
          agoStr = `${hrs}h ${mins}m ago`;
        }
        return { timeStr, agoStr };
      }
    } catch (e) {}
    return { timeStr: String(dateStr), agoStr: '' };
  };

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      await updateOrderStatus(orderId, newStatus, token);
      if (newStatus === 'rejected' || newStatus === 'cancelled') {
        setOrders(prev => prev.filter(o => o.id !== orderId));
      } else {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      }
    } catch (err) {
      alert(err.message || 'Failed to update order status');
    }
  };

  // ⚡ RawBT Direct Thermal Printer ESC/POS Generator
  const generateRawBTText = (order, type = 'kot', restoInfo = {}) => {
    let text = '';
    if (type === 'kot') {
      text += "================================" + "\n";
      text += "    KITCHEN ORDER TICKET        " + "\n";
      text += `    TABLE #${order.table_number || '1'}           ` + "\n";
      text += "================================" + "\n";
      text += `Order ID: #${order.id}\n`;
      text += `Customer: ${order.customer_name || 'Dine-In Guest'}\n`;
      text += `Time: ${new Date(order.created_at || Date.now()).toLocaleTimeString('en-IN')}\n`;
      text += "--------------------------------" + "\n";
      text += "QTY  ITEM NAME            AMOUNT" + "\n";
      text += "--------------------------------" + "\n";
      (order.items || []).forEach(i => {
        const name = (i.name + (i.portion ? ` (${i.portion})` : '')).padEnd(20).substring(0, 20);
        const qty = String(i.quantity).padEnd(4);
        const amt = `₹${i.price * i.quantity}`.padStart(7);
        text += `${qty}${name}${amt}\n`;
      });
      text += "================================" + "\n";
      text += `TOTAL BILL: ₹${order.total_amount}\n`;
      text += "================================" + "\n";
      text += "  *** READY FOR KITCHEN ***\n\n\n";
    } else {
      const isGst = restoInfo?.gst_enabled;
      const gstin = restoInfo?.gstin_number || '';
      const fssai = restoInfo?.fssai_lic_no || '';

      text += "================================" + "\n";
      text += `   ${(restoInfo?.name || 'RAMAN SWEET BAKERY').toUpperCase()}\n`;
      if (restoInfo?.address) text += `   ${restoInfo.address}\n`;
      if (restoInfo?.phone) text += `   Ph: ${restoInfo.phone}\n`;
      if (fssai) text += `   FSSAI Lic: ${fssai}\n`;
      if (gstin) text += `   GSTIN: ${gstin}\n`;
      text += `   --- ${isGst ? 'TAX INVOICE' : 'FINAL BILL'} ---\n`;
      text += "================================" + "\n";
      text += `Bill No: INV-${order.id}\n`;
      text += `Table: TABLE #${order.table_number || '1'}\n`;
      text += `Date: ${new Date(order.created_at || Date.now()).toLocaleString('en-IN')}\n`;
      text += `Customer: ${order.customer_name || 'Dine-In Guest'}\n`;
      text += "--------------------------------" + "\n";
      text += "QTY  ITEM NAME            AMOUNT" + "\n";
      text += "--------------------------------" + "\n";
      (order.items || []).forEach(i => {
        const name = (i.name + (i.portion ? ` (${i.portion})` : '')).padEnd(20).substring(0, 20);
        const qty = String(i.quantity).padEnd(4);
        const amt = `₹${i.price * i.quantity}`.padStart(7);
        text += `${qty}${name}${amt}\n`;
      });
      text += "--------------------------------" + "\n";
      text += `Grand Total: ₹${order.total_amount}\n`;
      text += "================================" + "\n";
      text += "   Thank you! Visit Again 🙏\n\n\n";
    }
    return text;
  };

  // 🖨️ Silent Thermal Printer Engine (Zero-Popup Hidden Iframe / RawBT Printer)
  const silentIframePrint = (htmlContent, order = null, type = 'kot') => {
    return new Promise((resolve, reject) => {
      try {
        const isAndroid = /Android/i.test(navigator.userAgent);
        if (isAndroid && order) {
          try {
            const rawText = generateRawBTText(order, type, restaurantInfo);
            const b64Data = btoa(unescape(encodeURIComponent(rawText)));
            window.location.href = `intent:base64,${b64Data}#Intent;scheme=rawbt;package=ru.a2o.rawbtprinter;end;`;
            resolve(true);
            return;
          } catch (e) {
            console.warn('RawBT intent fallback to iframe print:', e);
          }
        }

        let iframe = document.getElementById('khana-silent-printer-frame');
        if (!iframe) {
          iframe = document.createElement('iframe');
          iframe.id = 'khana-silent-printer-frame';
          iframe.style.position = 'fixed';
          iframe.style.right = '0';
          iframe.style.bottom = '0';
          iframe.style.width = '0px';
          iframe.style.height = '0px';
          iframe.style.border = '0';
          iframe.style.visibility = 'hidden';
          document.body.appendChild(iframe);
        }

        const iframeDoc = iframe.contentWindow || iframe.contentDocument;
        const targetDoc = iframeDoc.document || iframeDoc;

        targetDoc.open();
        targetDoc.write(htmlContent);
        targetDoc.close();

        setTimeout(() => {
          try {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            resolve(true);
          } catch (err) {
            reject(err);
          }
        }, 250);
      } catch (err) {
        reject(err);
      }
    });
  };

  const [printingOrderId, setPrintingOrderId] = useState(null);
  const [printingType, setPrintingType] = useState(null);
  const [printToast, setPrintToast] = useState(null);

  const showPrintToast = (type, message, order = null, printType = null, paymentMode = 'CASH') => {
    setPrintToast({ type, message, order, printType, paymentMode });
    if (type === 'success') {
      setTimeout(() => {
        setPrintToast(prev => (prev?.message === message ? null : prev));
      }, 3500);
    }
  };

  const getKOTHTML = (order) => {
    let itemsHtml = '';
    (order.items || []).forEach(i => {
      const portionText = i.portion ? ` (${i.portion})` : '';
      itemsHtml += `
        <tr>
          <td style="padding:6px 0;font-weight:bold;font-size:14px;border-bottom:1px dashed #E5E7EB;">${i.quantity}x ${i.name}${portionText}</td>
          <td style="text-align:right;font-weight:bold;font-size:14px;border-bottom:1px dashed #E5E7EB;">₹${i.price * i.quantity}</td>
        </tr>
      `;
    });
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>KOT Ticket - Table ${order.table_number || '1'}</title>
          <style>
            @media print {
              body { margin: 0; padding: 0; width: 100%; }
            }
            body { font-family: 'Courier New', Courier, monospace; padding: 14px; width: 280px; margin: 0 auto; background: #FFF; color: #000; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 10px; }
            .header h2 { margin: 0; font-size: 20px; font-weight: 900; }
            .header h3 { margin: 4px 0 0 0; font-size: 16px; background: #000; color: #FFF; display: inline-block; padding: 2px 8px; }
            .meta { border-bottom: 1px dashed #000; padding-bottom: 8px; margin-bottom: 10px; font-size: 13px; line-height: 1.4; }
            table { width: 100%; font-size: 14px; border-collapse: collapse; margin-bottom: 10px; }
            .total { border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 8px 0; font-weight: 900; font-size: 18px; display: flex; justify-content: space-between; }
            .footer { text-align: center; font-size: 11px; margin-top: 12px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>KITCHEN ORDER TICKET</h2>
            <h3>TABLE #${order.table_number || '1'}</h3>
          </div>
          <div class="meta">
            <div><strong>KOT Order ID:</strong> #${order.id}</div>
            <div><strong>Customer:</strong> ${order.customer_name || 'Dine-In Guest'}</div>
            <div><strong>Date & Time:</strong> ${formatDateTime(order.created_at)}</div>
          </div>
          <table>
            <thead>
              <tr style="border-bottom:1px solid #000;text-align:left;font-size:12px;">
                <th>ITEM & QTY</th>
                <th style="text-align:right;">AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          <div class="total">
            <span>TOTAL BILL:</span>
            <span>₹${order.total_amount}</span>
          </div>
          <div class="footer">
            *** READY FOR KITCHEN PREPARATION ***
          </div>
        </body>
      </html>
    `;
  };

  const getBillHTML = (order, paymentMode = 'CASH') => {
    const isGst = restaurantInfo?.gst_enabled;
    const gstin = restaurantInfo?.gstin_number || '';
    const fssai = restaurantInfo?.fssai_lic_no || '';
    const currency = (restaurantInfo?.currency_symbol !== undefined && restaurantInfo?.currency_symbol !== null) ? restaurantInfo.currency_symbol : '₹';

    let subtotal = 0;
    let itemsHtml = '';
    (order.items || []).forEach(i => {
      const portionText = i.portion ? ` (${i.portion})` : '';
      const lineTotal = Number(i.price) * Number(i.quantity);
      subtotal += lineTotal;
      itemsHtml += `
        <tr>
          <td style="padding:4px 0;font-weight:bold;font-size:13px;border-bottom:1px dashed #DDD;">${i.quantity}x ${i.name}${portionText}</td>
          <td style="text-align:right;font-weight:bold;font-size:13px;border-bottom:1px dashed #DDD;">${currency}${lineTotal}</td>
        </tr>
      `;
    });

    let cgst = 0;
    let sgst = 0;
    let grandTotal = subtotal;

    if (isGst) {
      cgst = Math.round(subtotal * 0.025 * 100) / 100;
      sgst = Math.round(subtotal * 0.025 * 100) / 100;
      grandTotal = Math.round((subtotal + cgst + sgst) * 100) / 100;
    }

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Tax Invoice / Customer Bill - Order #${order.id}</title>
          <style>
            @media print {
              body { margin: 0; padding: 0; width: 100%; }
            }
            body { font-family: 'Courier New', Courier, monospace; padding: 14px; width: 290px; margin: 0 auto; background: #FFF; color: #000; }
            .header { text-align: center; border-bottom: 2px double #000; padding-bottom: 8px; margin-bottom: 10px; }
            .header h2 { margin: 0; font-size: 18px; font-weight: 900; }
            .header p { margin: 2px 0; font-size: 11px; }
            .badge { background: #000; color: #FFF; font-weight: 900; font-size: 12px; padding: 2px 8px; display: inline-block; margin-top: 4px; }
            .meta { border-bottom: 1px dashed #000; padding-bottom: 8px; margin-bottom: 10px; font-size: 12px; line-height: 1.5; }
            table { width: 100%; font-size: 13px; border-collapse: collapse; margin-bottom: 10px; }
            .totals { border-top: 1px solid #000; border-bottom: 2px solid #000; padding: 6px 0; font-size: 13px; line-height: 1.5; }
            .grand-total { font-weight: 900; font-size: 17px; display: flex; justify-content: space-between; margin-top: 4px; border-top: 1px dashed #000; padding-top: 4px; }
            .footer { text-align: center; font-size: 11px; margin-top: 14px; border-top: 1px dashed #000; padding-top: 8px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>${restaurantInfo?.name || 'RAMAN SWEET BAKERY'}</h2>
            <p>${restaurantInfo?.address || ''}</p>
            <p>Ph: ${restaurantInfo?.phone || ''}</p>
            ${fssai ? `<p>FSSAI Lic No: ${fssai}</p>` : ''}
            ${gstin ? `<p><strong>GSTIN:</strong> ${gstin}</p>` : ''}
            <div class="badge">${isGst ? 'TAX INVOICE' : 'FINAL BILL'}</div>
          </div>
          <div class="meta">
            <div><strong>Bill No:</strong> INV-${order.id}</div>
            <div><strong>Table:</strong> TABLE #${order.table_number || '1'}</div>
            <div><strong>Date & Time:</strong> ${formatDateTime(order.created_at)}</div>
            <div><strong>Customer:</strong> ${order.customer_name || 'Dine-In Guest'}</div>
            <div><strong>Payment Mode:</strong> <span style="background:#000;color:#FFF;padding:1px 6px;">${paymentMode}</span></div>
          </div>
          <table>
            <thead>
              <tr style="border-bottom:1px solid #000;text-align:left;font-size:12px;">
                <th>ITEM & QTY</th>
                <th style="text-align:right;">AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="totals">
            <div style="display:flex;justify-content:space-between;">
              <span>Subtotal:</span>
              <span>${currency}${subtotal}</span>
            </div>
            ${isGst ? `
              <div style="display:flex;justify-content:space-between;font-size:11px;color:#333;">
                <span>CGST @ 2.5%:</span>
                <span>${currency}${cgst}</span>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:11px;color:#333;">
                <span>SGST @ 2.5%:</span>
                <span>${currency}${sgst}</span>
              </div>
            ` : ''}
            <div class="grand-total">
              <span>GRAND TOTAL:</span>
              <span>${currency}${grandTotal}</span>
            </div>
          </div>

          <div class="footer">
            <p style="margin:0;font-weight:bold;">Thank you for dining with us!</p>
            <p style="margin:2px 0 0 0;">Please Visit Again 🙏</p>
          </div>
        </body>
      </html>
    `;
  };

  const handleDirectBluetoothPrint = (order, printType = 'kot') => {
    if (printType === 'kot') {
      handlePrintKOT(order);
    } else {
      setBillOrderModal(order);
    }
  };

  const handlePrintKOT = async (order) => {
    if (!order || (printingOrderId === order.id && printingType === 'kot')) return;
    setPrintingOrderId(order.id);
    setPrintingType('kot');

    try {
      const htmlContent = getKOTHTML(order);
      await silentIframePrint(htmlContent);
      setPrintingOrderId(null);
      setPrintingType(null);
      showPrintToast('success', '✓ KOT printed', order, 'kot');
    } catch (err) {
      console.error('KOT printing error:', err);
      setPrintingOrderId(null);
      setPrintingType(null);
      showPrintToast('error', '⚠ Printer unavailable', order, 'kot');
    }
  };

  const handlePrintCustomerBill = async (order, paymentMode = 'CASH') => {
    if (!order || (printingOrderId === order.id && printingType === 'bill')) return;
    setPrintingOrderId(order.id);
    setPrintingType('bill');

    try {
      const htmlContent = getBillHTML(order, paymentMode);
      await silentIframePrint(htmlContent);
      setPrintingOrderId(null);
      setPrintingType(null);
      showPrintToast('success', '✓ Bill printed', order, 'bill', paymentMode);
    } catch (err) {
      console.error('Bill printing error:', err);
      setPrintingOrderId(null);
      setPrintingType(null);
      showPrintToast('error', '⚠ Printer unavailable', order, 'bill', paymentMode);
    }
  };

  const handlePreviewPrint = (order, type = 'kot', paymentMode = 'CASH') => {
    const printWindow = window.open('', '_blank', 'width=400,height=700');
    if (!printWindow) {
      alert('Please allow popups to open the print preview.');
      return;
    }
    const htmlContent = type === 'kot' ? getKOTHTML(order) : getBillHTML(order, paymentMode);
    printWindow.document.write(`
      ${htmlContent}
      <script>
        window.onload = function() {
          window.print();
        };
      </script>
    `);
    printWindow.document.close();
  };

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 2000);
    return () => clearInterval(interval);
  }, [token]);

  // Settings State
  const [settingsForm, setSettingsForm] = useState({
    name: '',
    tagline: '',
    phone: '',
    address: '',
    openingHours: '',
    google_review_url: '',
    google_maps_url: '',
    currency_symbol: '₹',
    fssai_lic_no: '',
    resto_type: 'pure_veg',
    custom_domain: '',
    filters_visibility: {
      must_try: true,
      combo: true,
      special: true,
      under100: true
    }
  });
  const [settingsSavedMsg, setSettingsSavedMsg] = useState(false);

  // Credential Change State
  const [credForm, setCredForm] = useState({ currentPassword: '', newUsername: '', newPassword: '', confirmPassword: '' });
  const [credMsg, setCredMsg] = useState({ text: '', type: '' }); // type: 'success' | 'error'

  // Modals
  const [dishModalData, setDishModalData] = useState(null); // null (closed), 'new', or dish object
  const [catModalData, setCatModalData] = useState(null);
  const [comboLimitModalInfo, setComboLimitModalInfo] = useState(null);

  const handleOpenCreateCombo = () => {
    const currentCount = (combos || []).length;
    const planKey = (settingsForm.plan_tier || (info && info.plan_tier) || 'pro').toLowerCase();
    const maxCombos = (restaurantInfo?.max_combos !== undefined && restaurantInfo?.max_combos !== null) 
      ? Number(restaurantInfo.max_combos) 
      : ((info?.max_combos !== undefined && info?.max_combos !== null) 
          ? Number(info.max_combos) 
          : (planInfo?.max_combos !== undefined ? planInfo.max_combos : (planKey === 'basic' ? 3 : planKey === 'pro' ? 10 : 9999)));

    if (currentCount >= maxCombos) {
      setComboLimitModalInfo({
        currentCount,
        maxCombos,
        planTier: planKey.toUpperCase()
      });
      return;
    }
    setComboModalData('new');
  };

  const handleAddTable = async () => {
    const currentCount = Number(settingsForm.total_tables) || 0;
    const newCount = currentCount + 1;
    const updatedForm = { ...settingsForm, total_tables: newCount };
    setSettingsForm(updatedForm);
    setToastMessage(`Table ${newCount} added successfully! Saving...`);

    try {
      await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updatedForm)
      });
      loadData();
    } catch (err) {
      console.error('Failed to add table:', err);
    }
  };

  const handleDeleteTable = async (tableNumToDelete) => {
    const currentCount = Number(settingsForm.total_tables) || 0;
    if (currentCount <= 0) {
      alert('No tables to delete!');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete Table ${tableNumToDelete}?`)) return;

    const newCount = currentCount - 1;
    const updatedForm = { ...settingsForm, total_tables: newCount };
    setSettingsForm(updatedForm);
    setToastMessage(`Table ${tableNumToDelete} deleted! Saving...`);

    try {
      await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updatedForm)
      });
      loadData();
    } catch (err) {
      console.error('Failed to delete table:', err);
    }
  };

  const loadData = async (silent = false) => {
    if (!silent && dishes.length === 0) {
      setLoading(true);
    }
    try {
      const [catData, dishData, infoData, comboData, subStatusData] = await Promise.all([
        fetchCategories({ adminView: true, token }),
        fetchDishes({ adminView: true, token }),
        fetchRestaurantInfo(token),
        fetchAdminCombos(token).catch(() => []),
        fetch('/api/admin/subscription-status', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null).catch(() => null)
      ]);
      const safeCats = Array.isArray(catData) ? catData : [];
      const safeDishes = Array.isArray(dishData) ? dishData : [];
      const safeCombos = Array.isArray(comboData) ? comboData : [];

      setCategories(safeCats);
      setDishes(safeDishes);
      setRestaurantInfo(infoData);
      setCombos(safeCombos);

      try {
        localStorage.setItem('admin_cache_categories', JSON.stringify(safeCats));
        localStorage.setItem('admin_cache_dishes', JSON.stringify(safeDishes));
        if (infoData) localStorage.setItem('admin_cache_info', JSON.stringify(infoData));
        localStorage.setItem('admin_cache_combos', JSON.stringify(safeCombos));
      } catch (e) {}

      if (subStatusData) setSubscriptionStatus(subStatusData);
      if (infoData) {
        const defaultVis = { must_try: true, combo: true, special: true, under100: true };
        setSettingsForm({
          name: infoData.name || '',
          tagline: infoData.tagline || '',
          logo: infoData.logo || '',
          phone: infoData.phone || '',
          address: infoData.address || '',
          openingHours: infoData.openingHours || '',
          google_review_url: infoData.google_review_url || '',
          google_maps_url: infoData.google_maps_url || '',
          currency_symbol: (infoData.currency_symbol !== null && infoData.currency_symbol !== undefined) ? infoData.currency_symbol : '₹',
          fssai_lic_no: infoData.fssai_lic_no || '',
          resto_type: infoData.resto_type || 'pure_veg',
          latitude: infoData.latitude !== undefined && infoData.latitude !== null ? infoData.latitude : 26.6500,
          longitude: infoData.longitude !== undefined && infoData.longitude !== null ? infoData.longitude : 84.9167,
          max_distance_meters: infoData.max_distance_meters || 100,
          gst_enabled: infoData.gst_enabled !== undefined ? infoData.gst_enabled : false,
          gstin_number: infoData.gstin_number || '',
          total_tables: infoData.total_tables !== undefined && infoData.total_tables !== null ? Number(infoData.total_tables) : 0,
          order_retention_days: infoData.order_retention_days || 7,
          custom_domain: infoData.custom_domain || '',
          filters_visibility: { ...defaultVis, ...infoData.filters_visibility }
        });
      }
    } catch (err) {
      console.error('Error loading admin dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    fetchAnnouncements().then(data => {
      if (Array.isArray(data)) setAnnouncements(data);
    }).catch(() => {});
  }, []);

  const handleToggleDish = async (id, currentVal) => {
    try {
      await toggleDishAvailability(id, !currentVal, token);
      setDishes(dishes.map(d => d.id === id ? { ...d, available: !currentVal } : d));
    } catch (err) {
      alert('Failed to update dish availability');
    }
  };

  const handleToggleBadge = async (dish, targetBadge) => {
    const isTarget = dish.badge === targetBadge;
    const newBadge = isTarget ? '' : targetBadge;
    try {
      const res = await fetch(`/api/admin/dishes/${dish.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...dish,
          badge: newBadge
        })
      });
      if (!res.ok) throw new Error('Failed');
      setDishes(dishes.map(d => d.id === dish.id ? { ...d, badge: newBadge } : d));
    } catch (err) {
      alert(`Failed to update ${targetBadge} badge`);
    }
  };

  const handleDeleteDish = async (id) => {
    try {
      await deleteDish(id, token);
      setDishes(dishes.filter(d => d.id !== id));
    } catch (err) {
      alert('Failed to delete dish');
    }
  };

  const handleDeleteCategory = async (id) => {
    if (!window.confirm('Deleting a category will delete all dishes inside it! Continue?')) return;
    try {
      await deleteCategory(id, token);
      loadData();
    } catch (err) {
      alert('Failed to delete category');
    }
  };

  const isCatActive = (activeVal) => {
    return activeVal === true || activeVal === 1 || activeVal === '1' || activeVal === 'true' || activeVal === undefined;
  };

  const handleToggleCategory = async (catId, currentActive) => {
    try {
      const nextActive = !currentActive;
      await toggleCategoryActive(catId, nextActive, token);
      setCategories(categories.map(c => c.id === catId ? { ...c, active: nextActive } : c));
    } catch (err) {
      alert(err.message || 'Failed to update category status');
    }
  };

  const ensureTableCreated = async (numStr) => {
    const num = parseInt(numStr, 10);
    if (isNaN(num) || num <= 0) return;
    const currentCount = (settingsForm.total_tables !== undefined && settingsForm.total_tables !== null) ? Number(settingsForm.total_tables) : 0;
    if (num > currentCount) {
      const updatedForm = { ...settingsForm, total_tables: num };
      setSettingsForm(updatedForm);
      setToastMessage(`✨ Table ${num} automatically created!`);

      try {
        await fetch('/api/admin/settings', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(updatedForm)
        });
        loadData();
      } catch (err) {
        console.error('Failed to auto-create table:', err);
      }
    }
  };

  const handlePrintQR = (overrideNum) => {
    const activeTableNum = overrideNum || tableNumber || '1';
    ensureTableCreated(activeTableNum);

    const liveOrigin = window.location.origin;
    const targetUrl = `${liveOrigin}/${settingsForm.slug || 'raman-sweet-bakery'}?table=${activeTableNum}`;
    const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(targetUrl)}`;
    const currentName = settingsForm.name || 'Digital Menu';
    const currentTagline = settingsForm.tagline || 'Scan QR Code for Digital Menu';

    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) {
      alert('Please allow popups for this site to print the QR Standee.');
      return;
    }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Table Standee QR - Table ${tableNumber || '1'}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800;900&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap');
            body {
              margin: 0;
              padding: 40px;
              background-color: #FFFFFF;
              font-family: 'Plus Jakarta Sans', sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
            }
            .standee-card {
              width: 350px;
              padding: 32px 24px;
              border: 3px double #C5A059;
              border-radius: 24px;
              background: linear-gradient(180deg, #FFFFFF 0%, #FAF8F5 100%);
              text-align: center;
              box-shadow: 0 10px 30px rgba(10, 35, 21, 0.1);
              position: relative;
            }
            .table-badge {
              display: inline-block;
              background: #0A2315;
              color: #DFBA67;
              padding: 6px 22px;
              border-radius: 9999px;
              font-size: 1.05rem;
              font-weight: 800;
              border: 1.5px solid #C5A059;
              letter-spacing: 1px;
              margin-bottom: 16px;
            }
            .logo-title {
              font-family: 'Playfair Display', serif;
              font-size: 1.35rem;
              font-weight: 900;
              color: #0A2315;
              margin: 0 0 6px 0;
              line-height: 1.2;
            }
            .subtitle {
              font-size: 0.78rem;
              font-weight: 800;
              color: #15803D;
              letter-spacing: 0.5px;
              margin-bottom: 16px;
              line-height: 1.3;
            }
            .qr-box {
              background: #FFFFFF;
              padding: 16px;
              border-radius: 16px;
              border: 1px solid #E5E7EB;
              display: inline-block;
              box-shadow: 0 4px 12px rgba(0,0,0,0.06);
              margin-bottom: 16px;
            }
            .qr-box img {
              width: 200px;
              height: 200px;
              display: block;
            }
            .instruction-en {
              font-size: 0.88rem;
              font-weight: 800;
              color: #0A2315;
              margin-bottom: 4px;
            }
            .instruction-hi {
              font-size: 0.82rem;
              font-weight: 700;
              color: #666157;
              margin-bottom: 16px;
            }
            .footer-info {
              font-size: 0.72rem;
              font-weight: 700;
              color: #B88E3E;
              border-top: 1px dashed rgba(197, 160, 89, 0.4);
              padding-top: 12px;
            }
            @media print {
              body { padding: 0; background: none; }
              .standee-card { box-shadow: none; page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="standee-card">
            <div class="table-badge">TABLE NO. ${tableNumber || '1'}</div>
            <h1 class="logo-title">${currentName}</h1>
            <div class="subtitle">${currentTagline}</div>

            <div class="qr-box">
              <img src="${qrImgUrl}" alt="Table ${tableNumber || '1'} QR Code" />
            </div>

            <div class="instruction-en">📱 SCAN FOR DIGITAL MENU & ORDER</div>
            <div class="instruction-hi">स्कैन करें और डिजिटल मेन्यू देखें</div>

            <div class="footer-info">
              ${settingsForm.address || ''}${settingsForm.phone ? ' • Phone: ' + settingsForm.phone : ''}
              ${!settingsForm.watermark_removal_enabled ? '<div style="margin-top: 4px; font-size: 0.65rem; color: #15803D; font-weight: 800;">⚡ Powered by TouchQR</div>' : ''}
            </div>
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handlePrintAllQRs = () => {
    const totalCount = Number(settingsForm.total_tables) || 0;
    if (totalCount === 0) {
      alert('No tables added yet! Click "+ Add New Table" to create dining table QRs.');
      return;
    }
    const liveOrigin = window.location.origin;
    const currentName = settingsForm.name || 'Digital Menu';
    const currentTagline = settingsForm.tagline || 'Scan QR Code for Digital Menu';

    const printWindow = window.open('', '_blank', 'width=950,height=900');
    if (!printWindow) {
      alert('Please allow popups for this site to print all Table QR Standees.');
      return;
    }

    let cardsHtml = '';
    for (let tNum = 1; tNum <= totalCount; tNum++) {
      const targetUrl = `${liveOrigin}/${settingsForm.slug || 'raman-sweet-bakery'}?table=${tNum}`;
      const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(targetUrl)}`;
      cardsHtml += `
        <div class="standee-card">
          <div class="table-badge">TABLE NO. ${tNum}</div>
          <h2 class="logo-title">${currentName}</h2>
          <div class="subtitle">${currentTagline}</div>
          <div class="qr-box">
            <img src="${qrImgUrl}" alt="Table ${tNum} QR Code" />
          </div>
          <div class="instruction-en">📱 SCAN FOR DIGITAL MENU & ORDER</div>
          <div class="instruction-hi">स्कैन करें और डिजिटल मेन्यू देखें</div>
          <div class="footer-info">
            ${settingsForm.address || ''}${settingsForm.phone ? ' • Phone: ' + settingsForm.phone : ''}
            ${!settingsForm.watermark_removal_enabled ? '<div style="margin-top: 4px; font-size: 0.65rem; color: #15803D; font-weight: 800;">⚡ Powered by TouchQR</div>' : ''}
          </div>
        </div>
      `;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>All Table QR Standees - ${currentName}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800;900&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap');
            body {
              margin: 0;
              padding: 30px;
              background-color: #FFFFFF;
              font-family: 'Plus Jakarta Sans', sans-serif;
              display: flex;
              flex-wrap: wrap;
              gap: 24px;
              justify-content: center;
            }
            .standee-card {
              width: 320px;
              padding: 28px 20px;
              border: 3px double #C5A059;
              border-radius: 20px;
              background: linear-gradient(180deg, #FFFFFF 0%, #FAF8F5 100%);
              text-align: center;
              box-shadow: 0 6px 20px rgba(10, 35, 21, 0.08);
              page-break-inside: avoid;
              margin-bottom: 20px;
            }
            .table-badge {
              display: inline-block;
              background: #0A2315;
              color: #DFBA67;
              padding: 5px 18px;
              border-radius: 9999px;
              font-size: 0.95rem;
              font-weight: 800;
              border: 1.5px solid #C5A059;
              letter-spacing: 1px;
              margin-bottom: 12px;
            }
            .logo-title {
              font-family: 'Playfair Display', serif;
              font-size: 1.25rem;
              font-weight: 900;
              color: #0A2315;
              margin: 0 0 4px 0;
            }
            .subtitle {
              font-size: 0.75rem;
              font-weight: 800;
              color: #15803D;
              margin-bottom: 14px;
            }
            .qr-box {
              background: #FFFFFF;
              padding: 12px;
              border-radius: 14px;
              border: 1px solid #E5E7EB;
              display: inline-block;
              margin-bottom: 12px;
            }
            .qr-box img {
              width: 180px;
              height: 180px;
              display: block;
            }
            .instruction-en { font-size: 0.82rem; font-weight: 800; color: #0A2315; margin-bottom: 2px; }
            .instruction-hi { font-size: 0.78rem; font-weight: 700; color: #666157; margin-bottom: 12px; }
            .footer-info { font-size: 0.7rem; font-weight: 700; color: #B88E3E; border-top: 1px dashed rgba(197, 160, 89, 0.4); padding-top: 10px; }
            @media print {
              body { padding: 0; background: none; }
              .standee-card { box-shadow: none; page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          ${cardsHtml}
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 600);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleSaveDish = async (dishData) => {
    const isEdit = Boolean(dishModalData?.id);
    const url = isEdit ? `/api/admin/dishes/${dishModalData.id}` : '/api/admin/dishes';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(dishData)
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to save dish');
    }

    setDishModalData(null);
    loadData();
  };

  const handleSaveCategory = async (catData) => {
    const isEdit = Boolean(catModalData?.id);
    const url = isEdit ? `/api/admin/categories/${catModalData.id}` : '/api/admin/categories';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(catData)
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to save category');
    }

    setCatModalData(null);
    loadData();
  };

  const handleSaveSettings = async () => {
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(settingsForm)
      });

      if (!res.ok) {
        throw new Error('Failed to update restaurant settings');
      }

      setSettingsSavedMsg(true);
      await loadData();
      setTimeout(() => setSettingsSavedMsg(false), 3000);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleChangeCredentials = async () => {
    setCredMsg({ text: '', type: '' });

    if (!credForm.currentPassword) {
      setCredMsg({ text: 'Current password is required', type: 'error' });
      return;
    }
    if (!credForm.newUsername && !credForm.newPassword) {
      setCredMsg({ text: 'Enter a new username or new password', type: 'error' });
      return;
    }
    if (credForm.newPassword && credForm.newPassword !== credForm.confirmPassword) {
      setCredMsg({ text: 'New passwords do not match', type: 'error' });
      return;
    }
    if (credForm.newPassword && credForm.newPassword.length < 4) {
      setCredMsg({ text: 'Password must be at least 4 characters', type: 'error' });
      return;
    }

    try {
      const res = await fetch('/api/admin/change-credentials', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword: credForm.currentPassword,
          newUsername: credForm.newUsername || undefined,
          newPassword: credForm.newPassword || undefined
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setCredMsg({ text: data.error || 'Failed to update', type: 'error' });
        return;
      }

      // Update token in localStorage if returned
      if (data.token) {
        localStorage.setItem('admin_token', data.token);
        localStorage.setItem('admin_username', data.username);
      }

      setCredMsg({ text: '✅ Credentials updated! Use new login next time.', type: 'success' });
      setCredForm({ currentPassword: '', newUsername: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setCredMsg({ text: 'Network error, please try again', type: 'error' });
    }
  };
  const handleQuickPriceSave = async (dishId) => {
    try {
      const pFull = Number(quickPriceVal.price);
      const pHalf = quickPriceVal.price_half ? Number(quickPriceVal.price_half) : null;
      await updateDishPrice(dishId, pFull, pHalf, token);
      setDishes(dishes.map(d => d.id === dishId ? { ...d, price: pFull, price_half: pHalf } : d));
      setEditingPriceId(null);
    } catch (err) {
      alert('Failed to update price');
    }
  };

  const safeDishes = Array.isArray(dishes) ? dishes : [];
  const safeCategories = Array.isArray(categories) ? categories : [];

  const filteredDishes = safeDishes.filter(d => {
    if (!d) return false;
    const nameStr = (d.name || '').toLowerCase();
    const searchStr = (search || '').toLowerCase();
    const matchesSearch = nameStr.includes(searchStr) || 
      (d.name_hi && String(d.name_hi).toLowerCase().includes(searchStr));
    const matchesCategory = selectedCatFilter === 'all' || String(d.category_id) === String(selectedCatFilter);
    return matchesSearch && matchesCategory;
  });

  // Compute Live Table Grid (1 to total_tables)
  const totalTablesCount = Number(settingsForm.total_tables) || 0;
  const tableGrid = [];

  for (let tNum = 1; tNum <= totalTablesCount; tNum++) {
    const activeOrder = orders.find(o => String(o.table_number) === String(tNum) && o.status !== 'completed' && o.status !== 'cancelled');
    const serviceRequest = serviceRequests.find(sr => String(sr.table_number) === String(tNum));

    let status = 'available';
    if (serviceRequest) {
      status = 'service_needed';
    } else if (activeOrder) {
      status = 'occupied';
    }

    tableGrid.push({
      tableNumber: tNum,
      status,
      activeOrder,
      serviceRequest
    });
  }

  const availableTablesCount = tableGrid.filter(t => t.status === 'available').length;
  const occupiedTablesCount = tableGrid.filter(t => t.status === 'occupied').length;
  const serviceNeededCount = tableGrid.filter(t => t.status === 'service_needed').length;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-app)', paddingBottom: '70px' }}>
      <style>{`
        @media (max-width: 768px) {
          .admin-desktop-nav { display: none !important; }
          .admin-mobile-nav { display: flex !important; }
        }
        @media (min-width: 769px) {
          .admin-desktop-nav { display: block !important; }
          .admin-mobile-nav { display: none !important; }
        }
      `}</style>


      {/* 📢 Global System Announcement Banner */}
      {announcements.length > 0 && !dismissedNotice && (
        <div style={{
          background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)',
          color: '#E0E7FF',
          padding: '10px 16px',
          fontSize: '0.82rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          borderBottom: '1px solid #6366F1'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Megaphone size={16} color="#FBBF24" />
            <span><strong>Notice from SaaS Master:</strong> {announcements[0].message}</span>
          </div>
          <button
            onClick={() => setDismissedNotice(true)}
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              border: 'none',
              color: '#FFFFFF',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px',
              borderRadius: '50%',
              transition: 'all 0.2s ease'
            }}
            title="Dismiss Notice"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* 🔔📍 Live Order Siren & GPS Location Unlock Banner */}
      {!permissionsGranted && (
        <div style={{
          background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
          color: '#FFFFFF',
          padding: '12px 16px',
          borderBottom: '2px solid #38BDF8',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '240px' }}>
            <span style={{ fontSize: '1.5rem' }}>🔔📍</span>
            <div>
              <strong style={{ fontSize: '0.88rem', color: '#38BDF8', display: 'block' }}>
                Auto-Save GPS Location & Enable Live Order Siren Alarm
              </strong>
              <span style={{ fontSize: '0.76rem', color: '#94A3B8', fontWeight: 600 }}>
                Automatic order ringtone & customer distance verification require browser permissions.
              </span>
            </div>
          </div>
          <button
            onClick={() => requestDevicePermissions()}
            style={{
              background: 'linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%)',
              color: '#FFFFFF',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '9999px',
              fontWeight: 900,
              fontSize: '0.8rem',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(14,165,233,0.35)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            ⚡ Enable Location & Loud Ringtone
          </button>
        </div>
      )}

      {/* ⏳ Trial Expiry Warning Banner (3 Days Remaining) */}
      {daysLeft !== null && daysLeft <= 3 && daysLeft > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)',
          borderBottom: '2px solid #F59E0B',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
          color: '#78350F'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>⏳</span>
            <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>
              Your 14-Day Free Pro Trial expires in <strong style={{ color: '#B45309', fontSize: '0.88rem' }}>{daysLeft} day{daysLeft > 1 ? 's' : ''}</strong>! Renew now to prevent menu interruption.
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setShowPaymentModal(true)}
              style={{
                background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', color: '#FFFFFF', padding: '6px 14px', borderRadius: '10px',
                border: 'none', fontWeight: 900, fontSize: '0.78rem', cursor: 'pointer', boxShadow: '0 2px 8px rgba(16,185,129,0.4)', whiteSpace: 'nowrap'
              }}
            >
              💳 Pay & Renew Instant
            </button>
            <a
              href={`https://wa.me/${(masterSupportPhone || '919876543210').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hello Super Admin, I want to renew/upgrade my restaurant subscription plan for '${restaurantInfo?.name || 'my restaurant'}'.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: '#B45309', color: '#FFFFFF', padding: '6px 14px', borderRadius: '10px',
                textDecoration: 'none', fontWeight: 900, fontSize: '0.78rem', boxShadow: '0 2px 8px rgba(180,83,9,0.3)', whiteSpace: 'nowrap'
              }}
            >
              💬 WhatsApp Support
            </a>
          </div>
        </div>
      )}

      {/* 🔒 SUBSCRIPTION EXPIRED / TRIAL LOCKED OVERLAY */}
      {isExpired && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          background: 'rgba(10, 15, 25, 0.96)', backdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div style={{
            background: '#111827', border: '2px solid #DFBA67', borderRadius: '24px',
            padding: '36px 24px', maxWidth: '500px', width: '100%', textAlign: 'center', color: '#FFFFFF',
            boxShadow: '0 25px 60px rgba(0,0,0,0.8)'
          }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '14px' }}>🔒</div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#DFBA67', margin: '0 0 8px 0' }}>
              Subscription Plan Expired!
            </h2>
            <p style={{ color: '#9CA3AF', fontSize: '0.88rem', lineHeight: 1.5, margin: '0 0 24px 0' }}>
              The 14-day free trial or subscription plan for <strong>'{restaurantInfo?.name || 'your restaurant'}'</strong> has ended.
              Renew your plan to reactivate your Digital Menu & QR Orders.
            </p>

            {/* Plan Upgrade Options */}
            <div style={{
              background: 'rgba(223,186,103,0.08)', border: '1px solid rgba(223,186,103,0.25)',
              borderRadius: '16px', padding: '16px', marginBottom: '24px', textAlign: 'left'
            }}>
              <div style={{ color: '#DFBA67', fontWeight: 800, fontSize: '0.85rem', marginBottom: '10px' }}>
                💳 Select Renewal Plan & Contact Super Admin:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.82rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '6px' }}>
                  <span>⚡ <strong>Basic Plan:</strong> Digital Menu & QR</span>
                  <strong style={{ color: '#DFBA67' }}>₹499/mo</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '6px' }}>
                  <span>👑 <strong>Pro Plan:</strong> WhatsApp + Reviews</span>
                  <strong style={{ color: '#DFBA67' }}>₹999/mo</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>🚀 <strong>Enterprise Plan:</strong> KOT + Table Orders</span>
                  <strong style={{ color: '#DFBA67' }}>₹1,999/mo</strong>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                onClick={() => setShowPaymentModal(true)}
                style={{
                  width: '100%', padding: '14px', borderRadius: '14px', border: 'none',
                  background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', color: '#FFFFFF',
                  fontWeight: 900, fontSize: '0.95rem', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  boxShadow: '0 4px 16px rgba(16,185,129,0.4)'
                }}
              >
                💳 Pay & Reactivate Instant (UPI / Gateway)
              </button>

              <a
                href={`https://wa.me/${(masterSupportPhone || '919876543210').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hello Super Admin, my restaurant subscription for '${restaurantInfo?.name || username}' has expired. Please renew my plan.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  width: '100%', padding: '12px', borderRadius: '14px', border: 'none',
                  background: 'linear-gradient(135deg, #15803D, #22C55E)', color: '#FFFFFF',
                  fontWeight: 800, fontSize: '0.86rem', textDecoration: 'none',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                }}
              >
                💬 Contact Super Admin on WhatsApp
              </a>

              <button
                onClick={onLogout}
                style={{
                  width: '100%', padding: '12px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.2)',
                  background: 'rgba(255,255,255,0.05)', color: '#9CA3AF', fontWeight: 700, fontSize: '0.84rem', cursor: 'pointer'
                }}
              >
                ← Exit / Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modern Single POS Header Shell */}
      <div className="adm-dashboard-container">
        <AdminHeader
          restaurantInfo={restaurantInfo}
          username={username}
          onLogout={onLogout}
          onReturnToMenu={onReturnToMenu}
          onOpenHelp={() => setShowHelpModal(true)}
          supportPhone={masterSupportPhone}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          pendingOrdersCount={orders.filter(o => o.status === 'pending').length}
        />

        <main className="adm-main-canvas">
          <div className="adm-content-body">
            {/* ORDERS VIEW */}
            {['orders', 'floor-map', 'service-requests'].includes(activeTab) && (
              <OrdersView
                orders={orders}
                activeSubTab={activeTab}
                setActiveSubTab={setActiveTab}
                kotFilter={kotFilter}
                setKotFilter={setKotFilter}
                onUpdateStatus={handleUpdateStatus}
                onOpenBillModal={setBillOrderModal}
                onPrintBill={(order) => handlePrintCustomerBill(order, 'CASH')}
                serviceRequests={serviceRequests}
                onResolveServiceRequest={handleResolveServiceRequest}
                restaurantInfo={restaurantInfo}
                onPrintQR={handlePrintQR}
                onDirectPrint={handleDirectBluetoothPrint}
                onPreviewPrint={handlePreviewPrint}
                printingOrderId={printingOrderId}
                printingType={printingType}
                currencySymbol={settingsForm.currency_symbol !== undefined && settingsForm.currency_symbol !== null ? settingsForm.currency_symbol : '₹'}
              />
            )}

            {/* ANALYTICS VIEW */}
            {activeTab === 'analytics' && (
              <AnalyticsView
                analyticsData={analyticsData}
                onDownloadCSV={handleDownloadSalesReport}
                currencySymbol={settingsForm.currency_symbol !== undefined && settingsForm.currency_symbol !== null ? settingsForm.currency_symbol : '₹'}
              />
            )}

            {/* MENU VIEW */}
            {['dishes', 'categories', 'combos'].includes(activeTab) && (
              <MenuView
                dishes={safeDishes}
                categories={safeCategories}
                combos={combos}
                activeSubTab={activeTab}
                setActiveSubTab={setActiveTab}
                search={search}
                setSearch={setSearch}
                selectedCatFilter={selectedCatFilter}
                setSelectedCatFilter={setSelectedCatFilter}
                onToggleAvailability={handleToggleDish}
                onOpenAddDish={() => setDishModalData('new')}
                onOpenEditDish={(dish) => setDishModalData(dish)}
                onDeleteDish={handleDeleteDish}
                onUpdateQuickPrice={handleQuickPriceSave}
                onToggleCategoryActive={handleToggleCategory}
                onDeleteCategory={handleDeleteCategory}
                onOpenAddCategory={() => setCatModalData('new')}
                onOpenEditCategory={(cat) => setCatModalData(cat)}
                onOpenAddCombo={() => setComboModalData('new')}
                onOpenEditCombo={(combo) => setComboModalData(combo)}
                onDeleteCombo={deleteCombo}
                onToggleComboAvailability={toggleComboAvailability}
                onToggleBadge={handleToggleBadge}
                currencySymbol={settingsForm.currency_symbol !== undefined && settingsForm.currency_symbol !== null ? settingsForm.currency_symbol : '₹'}
              />
            )}

            {/* QR GENERATOR VIEW */}
            {activeTab === 'qr-generator' && (
              <QrGeneratorView
                tableNumber={tableNumber}
                setTableNumber={setTableNumber}
                totalTablesCount={totalTablesCount}
                onAddTable={handleAddTable}
                onDeleteTable={() => handleDeleteTable()}
                onPrintQR={handlePrintQR}
                onPrintAllQRs={handlePrintAllQRs}
                settingsForm={settingsForm}
                onReturnToMenu={onReturnToMenu}
              />
            )}

            {/* REVIEWS & FEEDBACK VIEW */}
            {activeTab === 'review' && (
              <ReviewView
                settingsForm={settingsForm}
                setSettingsForm={setSettingsForm}
                handleSaveSettings={handleSaveSettings}
              />
            )}

            {/* SETUP VIEW */}
            {activeTab === 'settings' && (
              <SetupView
                restaurantInfo={restaurantInfo}
                settingsForm={settingsForm}
                setSettingsForm={setSettingsForm}
                handleSaveSettings={handleSaveSettings}
                credForm={credForm}
                setCredForm={setCredForm}
                handleChangeCredentials={handleChangeCredentials}
                credMsg={credMsg}
                token={token}
                uploadImage={uploadImage}
                setShowPrinterModal={setShowPrinterModal}
                setShowHelpModal={setShowHelpModal}
                onOpenBillingModal={() => setShowPaymentModal(true)}
                supportPhone={masterSupportPhone}
                onOptimizeDatabase={async () => {
                  try {
                    await optimizeDatabase(token, 90);
                    alert('⚡ Database optimized successfully!');
                  } catch (e) {
                    alert('Optimization failed: ' + (e.message || 'Server error'));
                  }
                }}
                onNavigate={(tab) => setActiveTab(tab)}
              />
            )}
          </div>
        </main>

        <AdminBottomNavigation
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          pendingOrdersCount={orders.filter(o => o.status === 'pending').length}
        />
      </div>

      {/* Dish & Category Form Modals */}
      {dishModalData && (
        <DishFormModal
          dish={dishModalData === 'new' ? null : dishModalData}
          categories={categories}
          token={token}
          onSave={handleSaveDish}
          onClose={() => setDishModalData(null)}
        />
      )}

      {catModalData && (
        <CategoryFormModal
          category={catModalData === 'new' ? null : catModalData}
          token={token}
          onSave={handleSaveCategory}
          onClose={() => setCatModalData(null)}
        />
      )}

      {comboModalData && (
        <ComboFormModal
          combo={comboModalData === 'new' ? null : comboModalData}
          dishes={dishes}
          token={token}
          onSave={async (data) => {
            if (comboModalData === 'new') {
              await createCombo(data, token);
            } else {
              await updateCombo(comboModalData.id, data, token);
            }
            const updated = await fetchAdminCombos(token).catch(() => []);
            setCombos(Array.isArray(updated) ? updated : []);
            setComboModalData(null);
          }}
          onClose={() => setComboModalData(null)}
        />
      )}

      {/* 🔒 SaaS Plan Combo Limit Exceeded Modal */}
      {comboLimitModalInfo && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10050,
          background: 'rgba(10, 35, 21, 0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }} onClick={() => setComboLimitModalInfo(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#111827', border: '2px solid #F59E0B', borderRadius: '24px',
            padding: '32px 24px', maxWidth: '440px', width: '100%',
            color: '#FFFFFF', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', textAlign: 'center'
          }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '12px' }}>🔒</div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#F59E0B', margin: '0 0 8px 0' }}>
              Combo Limit Reached!
            </h2>
            <p style={{ color: '#9CA3AF', fontSize: '0.88rem', lineHeight: 1.6, margin: '0 0 20px 0' }}>
              Your <strong style={{ color: '#FFD700' }}>{comboLimitModalInfo.planTier}</strong> plan allows a maximum of <strong style={{ color: '#FFFFFF' }}>{comboLimitModalInfo.maxCombos} combos</strong>. You currently have {comboLimitModalInfo.currentCount} active combos.
            </p>
            <div style={{
              background: 'rgba(255,255,255,0.05)', borderRadius: '14px', padding: '14px',
              border: '1px solid rgba(255,215,0,0.2)', marginBottom: '20px', textAlign: 'left'
            }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#FFD700', marginBottom: '6px' }}>👑 Upgrade your SaaS Plan to unlock:</div>
              <div style={{ fontSize: '0.78rem', color: '#D1D5DB', lineHeight: 1.5 }}>
                • <strong>Pro Plan:</strong> Up to 10 Combos & Thalis<br/>
                • <strong>Enterprise Plan:</strong> Unlimited Combos & Direct Table Ordering
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setComboLimitModalInfo(null)} style={{
                flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.2)',
                background: 'transparent', color: '#CCCCCC', fontWeight: 700, cursor: 'pointer'
              }}>Close</button>
              <button onClick={() => {
                alert('Please contact SaaS Master Super Admin to upgrade your subscription plan!');
                setComboLimitModalInfo(null);
              }} style={{
                flex: 1, padding: '12px', borderRadius: '12px', border: 'none',
                background: 'linear-gradient(135deg, #FFD700, #F59E0B)', color: '#0A0A0A',
                fontWeight: 900, cursor: 'pointer', boxShadow: '0 4px 14px rgba(245,158,11,0.4)'
              }}>🚀 Upgrade Plan</button>
            </div>
          </div>
        </div>
      )}

      {/* 🧾 Select Payment Mode Modal before Printing Bill */}
      {billOrderModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(6px)',
          zIndex: 10020,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '20px',
            maxWidth: '380px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
            textAlign: 'center'
          }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0A2315', marginBottom: '4px' }}>
              🧾 Print Final Customer Bill
            </h3>
            <span style={{ fontSize: '0.78rem', color: '#6B7280', display: 'block', marginBottom: '16px' }}>
              Table #{billOrderModal.table_number || '1'} • Total: ₹{billOrderModal.total_amount}
            </span>

            <p style={{ fontSize: '0.84rem', fontWeight: 800, color: '#374151', marginBottom: '12px' }}>
              Select Payment Method for Receipt:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              {[
                { id: 'CASH', label: '💵 CASH PAYMENT', bg: '#10B981', color: '#FFFFFF' },
                { id: 'UPI / QR', label: '📱 UPI / GPAY / PAYTM', bg: '#2563EB', color: '#FFFFFF' },
                { id: 'CARD', label: '💳 CREDIT / DEBIT CARD', bg: '#7C3AED', color: '#FFFFFF' }
              ].map(m => (
                <button
                  key={m.id}
                  onClick={() => {
                    const orderToPrint = billOrderModal;
                    setBillOrderModal(null);
                    handlePrintCustomerBill(orderToPrint, m.id);
                  }}
                  style={{
                    background: m.bg,
                    color: m.color,
                    border: 'none',
                    padding: '12px',
                    borderRadius: 'var(--radius-pill)',
                    fontWeight: 900,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.15)'
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => setBillOrderModal(null)}
              style={{ background: 'none', border: 'none', color: '#9CA3AF', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* 📖 Interactive System Help & Video Guide Modal */}
      {showHelpModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 11000,
          background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            background: '#111827', border: '2px solid #DFBA67', borderRadius: '24px',
            padding: '24px', maxWidth: '640px', width: '100%', maxHeight: '90vh',
            overflowY: 'auto', color: '#FFFFFF', boxShadow: '0 25px 60px rgba(0,0,0,0.9)',
            position: 'relative'
          }}>
            <button
              onClick={() => setShowHelpModal(false)}
              style={{
                position: 'absolute', top: '16px', right: '16px',
                background: 'rgba(255,255,255,0.12)', border: 'none',
                color: '#FFFFFF', borderRadius: '50%', width: '32px', height: '32px',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              <X size={18} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', borderBottom: '1px solid #1F2937', paddingBottom: '14px' }}>
              <span style={{ fontSize: '2rem' }}>📖</span>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#DFBA67' }}>
                  TouchQR Owner Guide & Help Center
                </h3>
                <span style={{ fontSize: '0.82rem', color: '#9CA3AF' }}>
                  Learn how to manage your digital menu, QR standees, & live orders
                </span>
              </div>
            </div>

            {/* Quick 5 Step System Visual Guide */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

              {/* Guide 1: Categories & Dishes */}
              <div style={{ background: '#1F2937', borderRadius: '16px', padding: '16px', border: '1px solid #374151' }}>
                <div style={{ fontSize: '0.92rem', fontWeight: 900, color: '#FFD700', marginBottom: '6px' }}>
                  📁 1. How to Add Categories & Dishes (व्यंजन कैसे जोड़ें)
                </div>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.82rem', color: '#D1D5DB', lineHeight: 1.6 }}>
                  <li>Click <strong>Menu Tab ➔ Category Manager ➔ "+ Add Category"</strong> (e.g. Starters, Sweets, Beverages).</li>
                  <li>Click <strong>"+ Add New Dish"</strong>: Enter dish name, Full/Half price, upload photo URL, and set veg/non-veg badge.</li>
                  <li>Toggle availability switches anytime to show or hide items live on customer smartphones.</li>
                </ul>
              </div>

              {/* Guide 2: Thali & Combo Deals */}
              <div style={{ background: '#1F2937', borderRadius: '16px', padding: '16px', border: '1px solid #374151' }}>
                <div style={{ fontSize: '0.92rem', fontWeight: 900, color: '#FFD700', marginBottom: '6px' }}>
                  🍱 2. Thali & Combo Builder (थाली और कॉम्बो कैसे बनाएं)
                </div>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.82rem', color: '#D1D5DB', lineHeight: 1.6 }}>
                  <li>Go to <strong>Menu Tab ➔ Combo Deals ➔ "+ Add Combo Deal"</strong>.</li>
                  <li>Enter Combo Title (e.g. Executive Thali), set discounted price, and select included dishes (e.g. Paneer + 2 Roti + Rice).</li>
                </ul>
              </div>

              {/* Guide 3: Table QR Generator & Printing */}
              <div style={{ background: '#1F2937', borderRadius: '16px', padding: '16px', border: '1px solid #374151' }}>
                <div style={{ fontSize: '0.92rem', fontWeight: 900, color: '#FFD700', marginBottom: '6px' }}>
                  🖨️ 3. Table QR Generator & Printing (क्यूआर कोड स्टीकर)
                </div>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.82rem', color: '#D1D5DB', lineHeight: 1.6 }}>
                  <li>Go to <strong>Setup Tab ➔ QR Generator</strong>.</li>
                  <li>Click <strong>"+ Add New Table"</strong> to add tables (Table 1, Table 2, Table 3...).</li>
                  <li>Click <strong>"🖨️ Print All Table QRs (Uniform)"</strong> to print identical gold-framed standee stickers for all tables in 1-click!</li>
                </ul>
              </div>

              {/* Guide 4: Live Kitchen Orders & Siren */}
              <div style={{ background: '#1F2937', borderRadius: '16px', padding: '16px', border: '1px solid #374151' }}>
                <div style={{ fontSize: '0.92rem', fontWeight: 900, color: '#FFD700', marginBottom: '6px' }}>
                  🔔 4. Live Kitchen Siren & KOT Management (लाइव ऑर्डर सायरन)
                </div>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.82rem', color: '#D1D5DB', lineHeight: 1.6 }}>
                  <li>When a customer scans QR on Table 4 and orders, your phone/laptop will ring a loud Swiggy/Zomato style <strong>Emergency Siren Ringtone 🔊</strong>.</li>
                  <li>Click <strong>"Accept Order" ➔ "Chef Preparing" ➔ "Served to Table" ➔ "Complete & Paid"</strong>.</li>
                  <li>Click <strong>"🖨️ Print Thermal Receipt KOT"</strong> for kitchen printing.</li>
                </ul>
              </div>

              {/* Guide 5: GPS Location & Settings */}
              <div style={{ background: '#1F2937', borderRadius: '16px', padding: '16px', border: '1px solid #374151' }}>
                <div style={{ fontSize: '0.92rem', fontWeight: 900, color: '#FFD700', marginBottom: '6px' }}>
                  📍 5. GPS Geo-Fencing & Profile Settings (सुरक्षा और प्रोफाइल)
                </div>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.82rem', color: '#D1D5DB', lineHeight: 1.6 }}>
                  <li>Go to <strong>Setup Tab ➔ Settings</strong> to update Logo, Phone Number, FSSAI License, & Currency.</li>
                  <li>Click <strong>"Enable Location"</strong> to auto-save GPS coordinates so customers outside your restaurant hall cannot place fake orders.</li>
                </ul>
              </div>

            </div>

            <button
              onClick={() => setShowHelpModal(false)}
              style={{
                width: '100%', marginTop: '20px', padding: '13px', borderRadius: '9999px',
                border: 'none', background: 'linear-gradient(135deg, #FFD700 0%, #D4AF37 100%)',
                color: '#0A0A0A', fontWeight: 900, fontSize: '0.9rem', cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(255,215,0,0.3)'
              }}
            >
              ✅ Got it! Return to Dashboard
            </button>
          </div>
        </div>
      )}

      {/* 🖨️ Custom Bluetooth Thermal Printer Setup Modal */}
      {showPrinterModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 11000,
          background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            background: '#111827', border: '2px solid #0EA5E9', borderRadius: '24px',
            padding: '24px', maxWidth: '540px', width: '100%', color: '#FFFFFF',
            boxShadow: '0 25px 60px rgba(0,0,0,0.9)', position: 'relative'
          }}>
            <button
              onClick={() => setShowPrinterModal(false)}
              style={{
                position: 'absolute', top: '16px', right: '16px',
                background: 'rgba(255,255,255,0.12)', border: 'none',
                color: '#FFFFFF', borderRadius: '50%', width: '32px', height: '32px',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              <X size={18} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', borderBottom: '1px solid #1F2937', paddingBottom: '14px' }}>
              <span style={{ fontSize: '2rem' }}>🖨️</span>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#38BDF8' }}>
                  Bluetooth Thermal Printer Pairing Guide
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#9CA3AF' }}>
                  58mm & 80mm ESC/POS Thermal Printers
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.84rem', color: '#E2E8F0' }}>
              <div style={{ background: '#1F2937', padding: '12px 14px', borderRadius: '12px', border: '1px solid #38BDF8' }}>
                <strong style={{ color: '#38BDF8', display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>💻 Counter Laptop / PC Setup:</strong>
                Agar Laptop/PC counter par hai: <strong>Direct 0-second instant print bina kisi app ke 100% possible hai!</strong> (Chrome <code>--kiosk-printing</code> mode).
              </div>

              <div style={{ background: '#1F2937', padding: '12px 14px', borderRadius: '12px', border: '1px solid #DFBA67' }}>
                <strong style={{ color: '#DFBA67', display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>📱 Mobile Phone Setup:</strong>
                Agar Mobile phone se chala rahe hain: <strong>[ 🖨️ KOT ]</strong> dabaane par Receipt Preview dikhega ➔ 1 tap me bill nikal jayega!
              </div>

              <div style={{ background: '#1F2937', padding: '12px 14px', borderRadius: '12px', border: '1px solid #374151' }}>
                <strong style={{ color: '#9CA3AF', display: 'block', marginBottom: '4px' }}>📶 Bluetooth Thermal Printer Pairing:</strong>
                Printer ka switch ON karein, Mobile Bluetooth Settings me jaakar <code>POS-58</code> / <code>POS-80</code> device ko pair karein (Pin: 0000 ya 1234).
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button
                onClick={() => {
                  setShowPrinterModal(false);
                  handleDirectBluetoothPrint({ id: 999, table_number: '1', customer_name: 'Test Guest', total_amount: 150, items: [{ name: 'Paneer Butter Masala', quantity: 1, price: 150 }] }, 'kot');
                }}
                style={{
                  flex: 1, padding: '12px', borderRadius: '9999px', border: 'none',
                  background: 'linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%)',
                  color: '#FFFFFF', fontWeight: 900, fontSize: '0.85rem', cursor: 'pointer'
                }}
              >
                ⚡ Test Sample Print
              </button>
              <button
                onClick={() => setShowPrinterModal(false)}
                style={{
                  padding: '12px 20px', borderRadius: '9999px', border: '1px solid #374151',
                  background: 'rgba(255,255,255,0.08)', color: '#FFFFFF', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 💳 Payment Checkout Modal */}
      {showPaymentModal && (
        <PaymentModal
          restoInfo={restaurantInfo}
          planTier={restaurantInfo?.plan_tier || 'pro'}
          planPrice={restaurantInfo?.plan_price || (restaurantInfo?.plan_tier === 'enterprise' ? 1999 : restaurantInfo?.plan_tier === 'basic' ? 499 : 999)}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={() => {
            setToastMessage('🎉 Cashfree Subscription Authorized! Mandate registered for automatic billing after trial.');
            setTimeout(() => setToastMessage(''), 4000);
            fetchRestaurantInfo().then(data => {
              if (data) setRestaurantInfo(data);
            });
          }}
        />
      )}

      {/* 🔔 Floating Toast Notification Banner */}
      {toastMessage && (
        <div style={{
          position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
          zIndex: 12000, background: '#0A2315', color: '#DFBA67', border: '2px solid #DFBA67',
          padding: '12px 24px', borderRadius: '9999px', fontWeight: 900, fontSize: '0.88rem',
          boxShadow: '0 10px 30px rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', gap: '8px'
        }}>
          {toastMessage}
        </div>
      )}

      {/* 🖨️ Thermal Printer Toast Notification */}
      {printToast && (
        <div style={{
          position: 'fixed',
          bottom: '80px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 12000,
          background: printToast.type === 'success' ? '#0A2315' : '#7F1D1D',
          color: '#FFFFFF',
          padding: '10px 18px',
          borderRadius: '9999px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '0.85rem',
          fontWeight: 800,
          border: `1.5px solid ${printToast.type === 'success' ? '#22C55E' : '#EF4444'}`,
          maxWidth: '90vw'
        }}>
          <span>{printToast.message}</span>
          {printToast.type === 'error' && printToast.order && (
            <button
              onClick={() => {
                setPrintToast(null);
                if (printToast.printType === 'kot') {
                  handlePrintKOT(printToast.order);
                } else {
                  handlePrintCustomerBill(printToast.order, printToast.paymentMode);
                }
              }}
              style={{
                background: '#EF4444',
                color: '#FFF',
                border: 'none',
                padding: '4px 10px',
                borderRadius: '12px',
                fontSize: '0.75rem',
                fontWeight: 900,
                cursor: 'pointer'
              }}
            >
              🔄 Retry
            </button>
          )}
        </div>
      )}
    </div>
  );
}
