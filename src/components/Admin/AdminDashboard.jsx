import React, { useState, useEffect } from 'react';
import { fetchCategories, fetchDishes, toggleDishAvailability, toggleCategoryActive, deleteDish, deleteCategory, fetchRestaurantInfo, updateDishPrice, fetchAnnouncements, fetchAdminOrders, updateOrderStatus, uploadImage, fetchServiceRequests, resolveServiceRequest, fetchAdminAnalytics, fetchAdminCombos, createCombo, updateCombo, deleteCombo, toggleComboAvailability, optimizeDatabase } from '../../api/client';
import { getPlanDetails } from '../../config/plans';
import DishFormModal from './DishFormModal';
import CategoryFormModal from './CategoryFormModal';
import ComboFormModal from './ComboFormModal';
import { Plus, Edit, Trash2, Eye, EyeOff, LogOut, ArrowLeft, Layers, Utensils, QrCode, Printer, Settings, Star, CheckCircle, Lock, ExternalLink, Megaphone, MessageSquare, Palette, Sparkles, Clock, CheckCircle2, XCircle, Upload, X, BarChart2, TrendingUp, Download, Award, MapPin, RefreshCw, CreditCard } from 'lucide-react';

import PaymentModal from '../PaymentModal';

export default function AdminDashboard({ token, username, onLogout, onReturnToMenu }) {
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [activeTab, setActiveTab] = useState('dishes'); // 'dishes', 'categories', 'qr-generator', 'settings'
  const [categories, setCategories] = useState([]);
  const [dishes, setDishes] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [dismissedNotice, setDismissedNotice] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCatFilter, setSelectedCatFilter] = useState('all');
  const [editingPriceId, setEditingPriceId] = useState(null);
  const [quickPriceVal, setQuickPriceVal] = useState({ price: '', price_half: '' });

  // QR Code Generator State
  const [tableNumber, setTableNumber] = useState('1');
  const [qrGenerated, setQrGenerated] = useState(false);

  // Live Orders (KOT) & Analytics State
  const [orders, setOrders] = useState([]);
  const [serviceRequests, setServiceRequests] = useState([]);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [billOrderModal, setBillOrderModal] = useState(null);
  const [kotFilter, setKotFilter] = useState('all');
  const [prevPendingCount, setPrevPendingCount] = useState(0);
  const [restaurantInfo, setRestaurantInfo] = useState(null);

  const [combos, setCombos] = useState([]);
  const [comboModalData, setComboModalData] = useState(null);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [masterSupportPhone, setMasterSupportPhone] = useState('919876543210');
  const [showOnboardingGuide, setShowOnboardingGuide] = useState(true);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showPrinterModal, setShowPrinterModal] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

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
      setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    } catch (err) {
      alert(err.message || 'Failed to update order status');
    }
  };

  // ⚡ 0.5-Second Direct Bluetooth ESC/POS Thermal Receipt Printing (RawBT Protocol Integration)
  const handleDirectBluetoothPrint = (order, printType = 'kot') => {
    try {
      const restoName = settingsForm.name || 'KhanaMaster Restaurant';
      const itemsList = (order.items || []).map(i => {
        const portionText = i.portion ? ` (${i.portion})` : '';
        return `${i.quantity}x ${i.name}${portionText} - Rs.${i.price * i.quantity}`;
      }).join('\n');

      let receiptText = '';
      if (printType === 'kot') {
        receiptText = `==============================\n   KITCHEN ORDER TICKET (KOT)   \n   TABLE #${order.table_number || '1'}\n==============================\n` +
          `Order ID: #${order.id}\n` +
          `Customer: ${order.customer_name || 'Dine-In Guest'}\n` +
          `Time: ${formatDateTime(order.created_at)}\n` +
          `------------------------------\n` +
          `${itemsList}\n` +
          `------------------------------\n` +
          `TOTAL BILL: Rs.${order.total_amount}\n` +
          `==============================\n` +
          ` *** READY FOR KITCHEN *** \n\n\n`;
      } else {
        receiptText = `==============================\n   ${restoName.toUpperCase()}   \n      TAX / CUSTOMER BILL     \n==============================\n` +
          `Table #${order.table_number || '1'} | Order #${order.id}\n` +
          `Customer: ${order.customer_name || 'Guest'}\n` +
          `Date: ${formatDateTime(order.created_at)}\n` +
          `------------------------------\n` +
          `${itemsList}\n` +
          `------------------------------\n` +
          `GRAND TOTAL: Rs.${order.total_amount}\n` +
          `==============================\n` +
          ` Thank You! Visit Us Again! \n\n\n`;
      }

      // Trigger RawBT / ESC/POS Direct Bluetooth Print Protocol URL
      const rawbtUrl = `rawbt:base64,${btoa(unescape(encodeURIComponent(receiptText)))}`;
      window.location.href = rawbtUrl;
    } catch (e) {
      console.warn('Direct Bluetooth print trigger fallback:', e);
      if (printType === 'kot') handlePrintKOT(order);
      else setBillOrderModal(order);
    }
  };

  const handlePrintKOT = (order) => {
    const printWindow = window.open('', '_blank', 'width=380,height=600');
    if (!printWindow) return;
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
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>KOT Ticket - Table ${order.table_number}</title>
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
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handlePrintCustomerBill = (order, paymentMode = 'CASH') => {
    const printWindow = window.open('', '_blank', 'width=400,height=700');
    if (!printWindow) return;

    const isGst = restaurantInfo?.gst_enabled;
    const gstin = restaurantInfo?.gstin_number || '';
    const fssai = restaurantInfo?.fssai_lic_no || '';
    const currency = restaurantInfo?.currency_symbol || '₹';

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

    printWindow.document.write(`
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
              <div style="display:flex;justify:space-between;font-size:11px;color:#333;">
                <span>CGST @ 2.5%:</span>
                <span>${currency}${cgst}</span>
              </div>
              <div style="display:flex;justify:space-between;font-size:11px;color:#333;">
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
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 5000);
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
    const planInfo = getPlanDetails(planKey);
    const maxCombos = planInfo?.max_combos !== undefined ? planInfo.max_combos : (planKey === 'basic' ? 3 : planKey === 'pro' ? 10 : 9999);

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

  const loadData = async () => {
    setLoading(true);
    try {
      const [catData, dishData, infoData, comboData] = await Promise.all([
        fetchCategories({ adminView: true, token }),
        fetchDishes({ adminView: true, token }),
        fetchRestaurantInfo(token),
        fetchAdminCombos(token).catch(() => [])
      ]);
      setCategories(Array.isArray(catData) ? catData : []);
      setDishes(Array.isArray(dishData) ? dishData : []);
      setRestaurantInfo(infoData);
      setCombos(Array.isArray(comboData) ? comboData : []);
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
    if (!window.confirm('Are you sure you want to delete this dish?')) return;
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
      {/* Top Header */}
      <header style={{
        background: 'linear-gradient(135deg, #0A2315 0%, #164E2A 100%)',
        color: '#FFFFFF',
        padding: '10px 14px',
        borderBottom: '2px solid #D4AF37',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
      }}>
        {/* Left: Brand & Owner Metadata */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, overflow: 'hidden' }}>
          {settingsForm.logo && settingsForm.logo !== '/uploads/logo.jpg' ? (
            <img
              src={settingsForm.logo}
              alt="Logo"
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                border: '1.5px solid #D4AF37',
                objectFit: 'cover',
                flexShrink: 0
              }}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          ) : (
            <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#D4AF37', color: '#0A2315', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.9rem', flexShrink: 0 }}>
              {(settingsForm.name || 'R').charAt(0).toUpperCase()}
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <h1 style={{
              fontSize: '0.95rem',
              fontWeight: 800,
              color: '#DFBA67',
              margin: 0,
              lineHeight: 1.1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {settingsForm.name || 'Admin Panel'}
            </h1>
            <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.75)', fontWeight: 600, display: 'block', marginTop: '1px' }}>
              Owner: {username}
            </span>
          </div>
        </div>

        {/* Right: Quick Action Pill Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <button 
            onClick={() => setShowHelpModal(true)}
            title="Open Interactive System Guide & Help Center"
            style={{
              background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
              color: '#FFFFFF',
              padding: '6px 11px',
              borderRadius: 'var(--radius-pill)',
              fontSize: '0.74rem',
              fontWeight: 800,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 8px rgba(245,158,11,0.4)'
            }}
          >
            📖 Guide
          </button>
          <button 
            onClick={() => onReturnToMenu(settingsForm.slug)}
            title="View Public Customer Menu"
            style={{
              background: 'rgba(255,255,255,0.15)',
              color: '#FFFFFF',
              padding: '6px 11px',
              borderRadius: 'var(--radius-pill)',
              fontSize: '0.74rem',
              fontWeight: 700,
              border: '1px solid rgba(255,255,255,0.25)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              whiteSpace: 'nowrap'
            }}
          >
            <Eye size={13} /> Menu
          </button>

          <button 
            onClick={onLogout}
            title="Logout Admin"
            style={{
              background: 'rgba(220, 38, 38, 0.85)',
              color: '#FFFFFF',
              padding: '6px 11px',
              borderRadius: 'var(--radius-pill)',
              fontSize: '0.74rem',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              whiteSpace: 'nowrap'
            }}
          >
            <LogOut size={13} /> Exit
          </button>
        </div>
      </header>

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

      {/* 🧭 Sub-Grouped Navigation Bar (Option 2: Clean 4-Main Group Tabs + Sub-Pills) */}
      <div style={{
        background: 'rgba(10, 35, 21, 0.95)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        padding: '6px 12px',
        position: 'sticky',
        top: '52px',
        zIndex: 99,
        boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
        borderBottom: '1px solid rgba(212, 175, 55, 0.3)'
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {/* Main Group Tabs (4 Compact Tabs) */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.4)',
            padding: '3px',
            borderRadius: 'var(--radius-pill)',
            border: '1px solid rgba(212, 175, 55, 0.35)',
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '4px'
          }}>
            {[
              {
                id: 'orders-group',
                label: '📋 Orders',
                subTabs: ['orders', 'floor-map', 'service-requests'],
                badge: (orders.filter(o => o.status === 'pending').length + serviceRequests.length) || null,
                defaultTab: 'orders'
              },
              {
                id: 'analytics-group',
                label: '📊 Analytics',
                subTabs: ['analytics'],
                defaultTab: 'analytics'
              },
              {
                id: 'menu-group',
                label: '🍲 Menu',
                subTabs: ['dishes', 'categories', 'combos'],
                defaultTab: 'dishes'
              },
              {
                id: 'setup-group',
                label: '⚙️ Setup',
                subTabs: ['qr-generator', 'settings'],
                defaultTab: 'qr-generator'
              }
            ].map(group => {
              const isGroupActive = group.subTabs.includes(activeTab);
              return (
                <button
                  key={group.id}
                  onClick={() => {
                    if (!group.subTabs.includes(activeTab)) {
                      setActiveTab(group.defaultTab);
                    }
                  }}
                  style={{
                    padding: '7px 4px',
                    borderRadius: 'var(--radius-pill)',
                    fontWeight: isGroupActive ? 900 : 700,
                    fontSize: '0.76rem',
                    background: isGroupActive ? 'linear-gradient(135deg, #FFD700 0%, #D4AF37 100%)' : 'transparent',
                    color: isGroupActive ? '#0A2315' : 'rgba(255, 255, 255, 0.85)',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                    boxShadow: isGroupActive ? '0 4px 12px rgba(255, 215, 0, 0.4)' : 'none',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <span>{group.label}</span>
                  {group.badge ? (
                    <span style={{
                      background: isGroupActive ? '#0A2315' : '#EF4444',
                      color: '#FFFFFF',
                      fontSize: '0.62rem',
                      fontWeight: 900,
                      padding: '1px 5px',
                      borderRadius: '99px'
                    }}>
                      {group.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {/* Sub-Nav Pills Row (Appears dynamically based on active group) */}
          {(() => {
            let currentSubTabs = [];
            if (['orders', 'floor-map', 'service-requests'].includes(activeTab)) {
              currentSubTabs = [
                ...(restaurantInfo && (restaurantInfo.direct_ordering_enabled === false || restaurantInfo.direct_ordering_enabled === 0) ? [] : [{ id: 'orders', label: 'Live Orders', count: orders.filter(o => o.status === 'pending').length }]),
                { id: 'floor-map', label: '🗺️ Floor Map' },
                { id: 'service-requests', label: '🛎️ Waiter Calls', count: serviceRequests.length }
              ];
            } else if (['dishes', 'categories', 'combos'].includes(activeTab)) {
              currentSubTabs = [
                { id: 'dishes', label: 'Dishes', count: safeDishes.length },
                { id: 'categories', label: 'Categories', count: safeCategories.length },
                { id: 'combos', label: '🛒 Combos', count: combos.length }
              ];
            } else if (['qr-generator', 'settings'].includes(activeTab)) {
              currentSubTabs = [
                { id: 'qr-generator', label: '📱 QR Generator' },
                { id: 'settings', label: '⚙️ Settings' }
              ];
            }

            if (currentSubTabs.length <= 1) return null;

            return (
              <div style={{
                display: 'flex',
                gap: '6px',
                justifyContent: 'center',
                paddingTop: '2px'
              }}>
                {currentSubTabs.map(sub => {
                  const isSubActive = activeTab === sub.id;
                  return (
                    <button
                      key={sub.id}
                      onClick={() => setActiveTab(sub.id)}
                      style={{
                        padding: '4px 12px',
                        borderRadius: 'var(--radius-pill)',
                        fontSize: '0.7rem',
                        fontWeight: isSubActive ? 800 : 600,
                        background: isSubActive ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.12)',
                        color: isSubActive ? '#0A2315' : 'rgba(255, 255, 255, 0.8)',
                        border: isSubActive ? '1px solid #DFBA67' : '1px solid rgba(255, 255, 255, 0.15)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <span>{sub.label}</span>
                      {sub.count !== undefined && (
                        <span style={{ opacity: 0.85, fontSize: '0.65rem' }}>({sub.count})</span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Main Container */}
      <div style={{ maxWidth: '800px', margin: '14px auto', padding: '0 12px' }}>

        {/* KPI Stats Overview Bar */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '8px',
          marginBottom: '16px'
        }}>
          <div style={{
            background: '#FFFFFF',
            border: '1px solid var(--border-light)',
            borderRadius: '12px',
            padding: '10px 6px',
            textAlign: 'center',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block', textTransform: 'uppercase' }}>Dishes</span>
            <span style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--primary-emerald)' }}>{safeDishes.length}</span>
          </div>

          <div style={{
            background: '#FFFFFF',
            border: '1px solid var(--border-light)',
            borderRadius: '12px',
            padding: '10px 6px',
            textAlign: 'center',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block', textTransform: 'uppercase' }}>Categories</span>
            <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#D4AF37' }}>{safeCategories.length}</span>
          </div>

          <div style={{
            background: '#ECFDF5',
            border: '1px solid #A7F3D0',
            borderRadius: '12px',
            padding: '10px 6px',
            textAlign: 'center',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <span style={{ fontSize: '0.64rem', color: '#166534', fontWeight: 700, display: 'block', textTransform: 'uppercase' }}>Active</span>
            <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#15803D' }}>{safeDishes.filter(d => d.available !== false).length}</span>
          </div>

          <div style={{
            background: '#FEF2F2',
            border: '1px solid #FCA5A5',
            borderRadius: '12px',
            padding: '10px 6px',
            textAlign: 'center',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <span style={{ fontSize: '0.64rem', color: '#991B1B', fontWeight: 700, display: 'block', textTransform: 'uppercase' }}>Hidden</span>
            <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#DC2626' }}>{safeDishes.filter(d => d.available === false).length}</span>
          </div>
        </div>

        {/* 🗺️ REAL-TIME DINE-IN TABLE FLOOR MAP */}
        {activeTab === 'floor-map' && (
          <div style={{ marginBottom: '24px' }}>
            <div style={{
              background: '#FFFFFF',
              borderRadius: '20px',
              padding: '20px',
              boxShadow: 'var(--shadow-card)',
              border: '1.5px solid #E5E7EB'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0A2315', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MapPin size={22} color="#059669" /> Live Dining Hall Floor Map ({totalTablesCount} Tables)
                  </h2>
                  <span style={{ fontSize: '0.78rem', color: '#6B7280' }}>
                    Real-time occupancy status, active bills, seated time & waiter service alerts
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ background: '#D1FAE5', color: '#065F46', padding: '6px 12px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 800 }}>
                    🟢 Available ({availableTablesCount})
                  </span>
                  <span style={{ background: '#FEE2E2', color: '#991B1B', padding: '6px 12px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 800 }}>
                    🔴 Occupied ({occupiedTablesCount})
                  </span>
                  <span style={{ background: '#FEF3C7', color: '#92400E', padding: '6px 12px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 800 }}>
                    🟡 Service Alert ({serviceNeededCount})
                  </span>
                </div>
              </div>

              {/* Table Cards Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                gap: '16px'
              }}>
                {tableGrid.map(t => {
                  const isOccupied = t.status === 'occupied';
                  const isService = t.status === 'service_needed';
                  const isFree = t.status === 'available';

                  const cardBg = isOccupied ? '#FEF2F2' : (isService ? '#FFFBEB' : '#F0FDF4');
                  const borderCol = isOccupied ? '#FCA5A5' : (isService ? '#FCD34D' : '#86EFAC');
                  const statusLabel = isOccupied ? '🔴 SEATED & EATING' : (isService ? '🟡 SERVICE REQUEST' : '🟢 TABLE FREE');
                  const badgeBg = isOccupied ? '#EF4444' : (isService ? '#F59E0B' : '#10B981');

                  return (
                    <div
                      key={t.tableNumber}
                      style={{
                        background: cardBg,
                        border: `2px solid ${borderCol}`,
                        borderRadius: '16px',
                        padding: '14px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        minHeight: '175px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '1.05rem', fontWeight: 900, color: '#1F2937' }}>
                            TABLE #{t.tableNumber}
                          </span>
                          <span style={{
                            background: badgeBg,
                            color: '#FFFFFF',
                            fontSize: '0.62rem',
                            fontWeight: 900,
                            padding: '3px 7px',
                            borderRadius: '10px'
                          }}>
                            {statusLabel}
                          </span>
                        </div>

                        {/* Occupied Details */}
                        {isOccupied && t.activeOrder && (
                          <div style={{ fontSize: '0.8rem', color: '#374151', background: '#FFFFFF', padding: '8px 10px', borderRadius: '10px', border: '1px solid #FECACA', marginBottom: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
                              <span>Order #{t.activeOrder.id}</span>
                              <span style={{ color: '#DC2626' }}>₹{t.activeOrder.total_amount}</span>
                            </div>
                            <div style={{ fontSize: '0.74rem', color: '#6B7280', marginTop: '2px' }}>
                              {t.activeOrder.customer_name || 'Dine-In Guest'} • {Array.isArray(t.activeOrder.items) ? t.activeOrder.items.length : 1} items
                            </div>
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#374151', marginTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span>🕒 {getSeatedTimeInfo(t.activeOrder.created_at).timeStr}</span>
                              <span style={{ background: '#FEE2E2', color: '#991B1B', padding: '1px 6px', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 800 }}>
                                ⏳ {getSeatedTimeInfo(t.activeOrder.created_at).agoStr}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Service Request Details */}
                        {isService && t.serviceRequest && (
                          <div style={{ fontSize: '0.8rem', color: '#92400E', background: '#FFFFFF', padding: '8px 10px', borderRadius: '10px', border: '1px solid #FDE68A', marginBottom: '10px' }}>
                            <div style={{ fontWeight: 800 }}>
                              {t.serviceRequest.request_type}
                            </div>
                            {t.serviceRequest.note && (
                              <div style={{ fontSize: '0.72rem', fontStyle: 'italic', color: '#B45309', marginTop: '2px' }}>
                                "{t.serviceRequest.note}"
                              </div>
                            )}
                          </div>
                        )}

                        {/* Free Table Info */}
                        {isFree && (
                          <div style={{ fontSize: '0.78rem', color: '#047857', fontStyle: 'italic', margin: '12px 0', textAlign: 'center' }}>
                            Available for new dining guests ✨
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                        {isOccupied && t.activeOrder && (
                          <>
                            <button
                              onClick={() => setBillOrderModal(t.activeOrder)}
                              style={{
                                flex: 1,
                                background: '#D97706',
                                color: '#FFFFFF',
                                border: 'none',
                                padding: '6px',
                                borderRadius: '8px',
                                fontSize: '0.74rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '3px'
                              }}
                            >
                              <Printer size={12} /> Bill 🧾
                            </button>

                            <button
                              onClick={() => handleUpdateStatus(t.activeOrder.id, 'completed')}
                              style={{
                                flex: 1,
                                background: '#10B981',
                                color: '#FFFFFF',
                                border: 'none',
                                padding: '6px',
                                borderRadius: '8px',
                                fontSize: '0.74rem',
                                fontWeight: 800,
                                cursor: 'pointer'
                              }}
                              title="Mark order complete and clear table"
                            >
                              🏁 Clear
                            </button>
                          </>
                        )}

                        {isService && t.serviceRequest && (
                          <button
                            onClick={async () => {
                              await resolveServiceRequest(t.serviceRequest.id, token);
                              const reqs = await fetchServiceRequests(token);
                              setServiceRequests(reqs);
                            }}
                            style={{
                              width: '100%',
                              background: '#D97706',
                              color: '#FFFFFF',
                              border: 'none',
                              padding: '7px',
                              borderRadius: '8px',
                              fontSize: '0.74rem',
                              fontWeight: 800,
                              cursor: 'pointer'
                            }}
                          >
                            ✓ Attend Request
                          </button>
                        )}

                        {isFree && (
                          <button
                            onClick={() => setActiveTab('qr-generator')}
                            style={{
                              width: '100%',
                              background: '#ECFDF5',
                              color: '#047857',
                              border: '1px solid #A7F3D0',
                              padding: '6px',
                              borderRadius: '8px',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px'
                            }}
                          >
                            <QrCode size={12} /> Table QR Code
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 🔔 LIVE KITCHEN ORDERS TERMINAL (KOT) */}
        {activeTab === 'orders' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
            <div style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              padding: '16px 20px',
              border: '1.5px solid var(--gold-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              boxShadow: 'var(--shadow-md)'
            }}>
              <div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--primary-emerald)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={20} color="#D4AF37" /> Live Dine-In Kitchen Orders (KOT)
                </h2>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  ⚡ Auto-refreshes live every 5 seconds • Real-time table orders from customers
                </span>
              </div>
            </div>

              {/* KOT Status Filter Pills */}
              <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }}>
                {[
                  { id: 'all', label: `🔥 All Orders (${orders.length})` },
                  { id: 'pending', label: `🟡 Pending (${orders.filter(o => o.status === 'pending').length})` },
                  { id: 'preparing', label: `👨‍🍳 Kitchen (${orders.filter(o => o.status === 'preparing').length})` },
                  { id: 'served', label: `🟢 Served (${orders.filter(o => o.status === 'served').length})` },
                  { id: 'completed', label: `🏁 Complete (${orders.filter(o => o.status === 'completed').length})` }
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setKotFilter(f.id)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-pill)',
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      background: kotFilter === f.id ? 'var(--header-gradient)' : '#FFFFFF',
                      color: kotFilter === f.id ? '#FFFFFF' : 'var(--text-dark)',
                      border: kotFilter === f.id ? 'none' : '1px solid var(--border-light)',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      boxShadow: kotFilter === f.id ? '0 2px 8px rgba(10,35,21,0.2)' : 'none'
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {orders.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '50px 20px', background: '#FFFFFF', borderRadius: '16px', border: '1px solid var(--border-light)' }}>
                  <Clock size={44} color="#9CA3AF" style={{ marginBottom: '12px' }} />
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-dark)', margin: '0 0 4px 0' }}>No Orders Received Yet</h3>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>When customers place a table order from their phone, it will pop up here live!</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px' }}>
                  {orders.filter(o => kotFilter === 'all' || o.status === kotFilter).map((o) => {
                    const statusColors = {
                      pending: { bg: '#FEF3C7', text: '#92400E', border: '#FCD34D', label: 'Pending 🟡' },
                      preparing: { bg: '#DBEAFE', text: '#1E40AF', border: '#93C5FD', label: 'In Kitchen 👨‍🍳' },
                      served: { bg: '#D1FAE5', text: '#065F46', border: '#6EE7B7', label: 'Served 🟢' },
                      completed: { bg: '#F3F4F6', text: '#4B5563', border: '#D1D5DB', label: 'Completed 🏁' },
                      cancelled: { bg: '#FEE2E2', text: '#991B1B', border: '#FCA5A5', label: 'Cancelled 🔴' }
                    };
                    const st = statusColors[o.status] || statusColors.pending;

                    return (
                      <div
                        key={o.id}
                        style={{
                          background: '#FFFFFF',
                          borderRadius: '16px',
                          padding: '16px',
                          border: `2px solid ${st.border}`,
                          boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: '12px'
                        }}
                      >
                        <div>
                          {/* Header: Table & Order ID */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <span style={{
                              background: 'linear-gradient(135deg, #0A2315 0%, #143A24 100%)',
                              color: '#FFD700',
                              fontWeight: 900,
                              fontSize: '0.9rem',
                              padding: '4px 12px',
                              borderRadius: 'var(--radius-pill)',
                              border: '1px solid #FFD700'
                            }}>
                              TABLE #{o.table_number || '1'}
                            </span>

                            <span style={{
                              background: st.bg,
                              color: st.text,
                              fontSize: '0.78rem',
                              fontWeight: 800,
                              padding: '4px 10px',
                              borderRadius: '12px',
                              border: `1px solid ${st.border}`
                            }}>
                              {st.label}
                            </span>
                          </div>

                          {/* Customer details & Date / Time */}
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span style={{ fontWeight: 800, color: '#1F2937' }}>Order #{o.id} • {o.customer_name || 'Guest'}</span>
                            <span style={{ fontWeight: 700, color: '#374151', background: '#F3F4F6', padding: '2px 8px', borderRadius: '6px', fontSize: '0.74rem' }}>
                              📅 {formatDateTime(o.created_at)}
                            </span>
                          </div>

                        {/* Items List */}
                        <div style={{ background: '#F9FAFB', borderRadius: '12px', padding: '10px 12px', border: '1px solid #E5E7EB', marginBottom: '10px' }}>
                          {Array.isArray(o.items) && o.items.map((item, iIdx) => {
                            const portionLabel = item.portion || '';
                            const isHalf = portionLabel.toLowerCase().includes('half');
                            const isFull = portionLabel.toLowerCase().includes('full');

                            return (
                              <div key={iIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.86rem', fontWeight: 700, color: '#1F2937', padding: '4px 0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span>{item.quantity}x {item.name}</span>
                                  {portionLabel && (
                                    <span style={{
                                      fontSize: '0.66rem',
                                      fontWeight: 900,
                                      padding: '1px 6px',
                                      borderRadius: '4px',
                                      background: isHalf ? '#FEF3C7' : (isFull ? '#D1FAE5' : '#E5E7EB'),
                                      color: isHalf ? '#92400E' : (isFull ? '#065F46' : '#374151'),
                                      border: isHalf ? '1px solid #F59E0B' : (isFull ? '1px solid #10B981' : '1px solid #9CA3AF')
                                    }}>
                                      {portionLabel.toUpperCase()}
                                    </span>
                                  )}
                                </div>
                                <span style={{ color: 'var(--primary-emerald)', fontWeight: 800 }}>₹{item.price * item.quantity}</span>
                              </div>
                            );
                          })}
                          <div style={{ borderTop: '1px dashed #D1D5DB', marginTop: '6px', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '0.92rem', color: '#111827' }}>
                            <span>Total Bill</span>
                            <span style={{ color: 'var(--gold-primary)' }}>₹{o.total_amount}</span>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div style={{ display: 'flex', gap: '6px' }}>

                        <button
                          onClick={() => handlePrintKOT(o)}
                          style={{
                            background: '#F3F4F6',
                            color: '#374151',
                            border: '1px solid #D1D5DB',
                            padding: '8px 10px',
                            borderRadius: '10px',
                            fontWeight: 800,
                            fontSize: '0.76rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          title="Print Kitchen Order Ticket"
                        >
                          <Printer size={13} /> KOT
                        </button>

                        <button
                          onClick={() => setBillOrderModal(o)}
                          style={{
                            background: '#FEF3C7',
                            color: '#B45309',
                            border: '1px solid #FDE68A',
                            padding: '8px 10px',
                            borderRadius: '10px',
                            fontWeight: 800,
                            fontSize: '0.76rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          title="Print Final Customer Bill"
                        >
                          <Printer size={13} /> Bill 🧾
                        </button>

                        {o.status === 'pending' && (
                          <button
                            onClick={() => handleUpdateStatus(o.id, 'preparing')}
                            style={{
                              flex: 1,
                              background: '#2563EB',
                              color: '#FFFFFF',
                              border: 'none',
                              padding: '8px',
                              borderRadius: '10px',
                              fontWeight: 800,
                              fontSize: '0.76rem',
                              cursor: 'pointer'
                            }}
                          >
                            👨‍🍳 Start Preparing
                          </button>
                        )}
                        {o.status === 'preparing' && (
                          <button
                            onClick={() => handleUpdateStatus(o.id, 'served')}
                            style={{
                              flex: 1,
                              background: '#059669',
                              color: '#FFFFFF',
                              border: 'none',
                              padding: '8px',
                              borderRadius: '10px',
                              fontWeight: 800,
                              fontSize: '0.76rem',
                              cursor: 'pointer'
                            }}
                          >
                            ✅ Mark Served
                          </button>
                        )}
                        {o.status === 'served' && (
                          <button
                            onClick={() => handleUpdateStatus(o.id, 'completed')}
                            style={{
                              flex: 1,
                              background: '#4B5563',
                              color: '#FFFFFF',
                              border: 'none',
                              padding: '8px',
                              borderRadius: '10px',
                              fontWeight: 800,
                              fontSize: '0.76rem',
                              cursor: 'pointer'
                            }}
                          >
                            🏁 Complete Table
                          </button>
                        )}
                        {o.status !== 'completed' && o.status !== 'cancelled' && (
                          <button
                            onClick={() => handleUpdateStatus(o.id, 'cancelled')}
                            style={{
                              background: '#FEE2E2',
                              color: '#DC2626',
                              border: 'none',
                              padding: '8px 10px',
                              borderRadius: '10px',
                              fontWeight: 800,
                              fontSize: '0.76rem',
                              cursor: 'pointer'
                            }}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB: Live Sales Analytics & Best Selling Dishes */}
        {activeTab === 'analytics' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Header & CSV Download Bar */}
            <div style={{
              background: '#FFFFFF',
              borderRadius: 'var(--radius-md)',
              padding: '20px',
              border: '1px solid var(--border-light)',
              display: 'flex',
              justify: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--primary-emerald)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <TrendingUp size={24} color="#10B981" /> Restaurant Sales & Revenue Analytics
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Real-time sales insights, order breakdown, and best-selling dishes
                </span>
              </div>

              <button
                onClick={handleDownloadSalesReport}
                style={{
                  background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '10px 18px',
                  borderRadius: 'var(--radius-pill)',
                  fontWeight: 900,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 14px rgba(5, 150, 105, 0.35)'
                }}
              >
                <Download size={16} /> Download Sales CSV Report
              </button>
            </div>

            {/* 4 KPI Revenue Metric Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
              <div style={{ background: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)', border: '1px solid #A7F3D0', borderRadius: '16px', padding: '16px' }}>
                <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#047857', display: 'block', textTransform: 'uppercase' }}>Today's Revenue</span>
                <strong style={{ fontSize: '1.4rem', fontWeight: 900, color: '#065F46' }}>
                  ₹{analyticsData ? analyticsData.today_sales.toLocaleString('en-IN') : 0}
                </strong>
                <span style={{ fontSize: '0.74rem', color: '#047857', display: 'block', marginTop: '2px' }}>
                  {analyticsData ? analyticsData.today_orders : 0} orders today
                </span>
              </div>

              <div style={{ background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)', border: '1px solid #FDE68A', borderRadius: '16px', padding: '16px' }}>
                <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#B45309', display: 'block', textTransform: 'uppercase' }}>7-Day Revenue</span>
                <strong style={{ fontSize: '1.4rem', fontWeight: 900, color: '#92400E' }}>
                  ₹{analyticsData ? analyticsData.weekly_sales.toLocaleString('en-IN') : 0}
                </strong>
                <span style={{ fontSize: '0.74rem', color: '#B45309', display: 'block', marginTop: '2px' }}>Last 7 days total</span>
              </div>

              <div style={{ background: 'linear-gradient(135deg, #F0F9FF 0%, #E0F2FE 100%)', border: '1px solid #BAE6FD', borderRadius: '16px', padding: '16px' }}>
                <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#0369A1', display: 'block', textTransform: 'uppercase' }}>30-Day Revenue</span>
                <strong style={{ fontSize: '1.4rem', fontWeight: 900, color: '#075985' }}>
                  ₹{analyticsData ? analyticsData.monthly_sales.toLocaleString('en-IN') : 0}
                </strong>
                <span style={{ fontSize: '0.74rem', color: '#0369A1', display: 'block', marginTop: '2px' }}>Last 30 days total</span>
              </div>

              <div style={{ background: 'linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)', border: '1px solid #DDD6FE', borderRadius: '16px', padding: '16px' }}>
                <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#6D28D9', display: 'block', textTransform: 'uppercase' }}>All-Time Sales</span>
                <strong style={{ fontSize: '1.4rem', fontWeight: 900, color: '#5B21B6' }}>
                  ₹{analyticsData ? analyticsData.total_sales.toLocaleString('en-IN') : 0}
                </strong>
                <span style={{ fontSize: '0.74rem', color: '#6D28D9', display: 'block', marginTop: '2px' }}>
                  {analyticsData ? analyticsData.total_orders : 0} total orders
                </span>
              </div>
            </div>

            {/* Top 5 Best-Selling Dishes & 7-Day Revenue Visual Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>

              {/* 🏆 Top 5 Best-Selling Dishes */}
              <div style={{ background: '#FFFFFF', borderRadius: '18px', padding: '20px', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <Award size={22} color="#D97706" />
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 900, color: '#92400E', margin: 0 }}>
                    🏆 Top 5 Best-Selling Dishes
                  </h4>
                </div>

                {(!analyticsData || !analyticsData.top_dishes || analyticsData.top_dishes.length === 0) ? (
                  <div style={{ textAlign: 'center', padding: '30px', color: '#9CA3AF', fontSize: '0.84rem' }}>
                    No dish sales data recorded yet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {analyticsData.top_dishes.map((dish, idx) => {
                      const maxQty = analyticsData.top_dishes[0]?.quantity || 1;
                      const percent = Math.round((dish.quantity / maxQty) * 100);
                      const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];

                      return (
                        <div key={dish.name} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.86rem', fontWeight: 800, color: '#1F2937' }}>
                              {medals[idx]} {dish.name}
                            </span>
                            <span style={{ fontSize: '0.8rem', fontWeight: 900, color: '#059669' }}>
                              {dish.quantity} sold (₹{dish.revenue.toLocaleString('en-IN')})
                            </span>
                          </div>
                          <div style={{ width: '100%', height: '8px', background: '#F3F4F6', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${percent}%`, height: '100%', background: 'linear-gradient(90deg, #10B981 0%, #059669 100%)', borderRadius: '4px' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 📊 7-Day Revenue Visual Bar Chart */}
              <div style={{ background: '#FFFFFF', borderRadius: '18px', padding: '20px', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <BarChart2 size={22} color="#059669" />
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 900, color: '#065F46', margin: 0 }}>
                    📊 7-Day Daily Revenue Trend
                  </h4>
                </div>

                {(!analyticsData || !analyticsData.daily_chart || analyticsData.daily_chart.length === 0) ? (
                  <div style={{ textAlign: 'center', padding: '30px', color: '#9CA3AF', fontSize: '0.84rem' }}>
                    No daily revenue chart data yet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '160px', paddingTop: '20px' }}>
                    {analyticsData.daily_chart.map(item => {
                      const maxDaily = Math.max(...analyticsData.daily_chart.map(d => d.sales), 1);
                      const barHeightPercent = Math.max(Math.round((item.sales / maxDaily) * 100), 8);

                      return (
                        <div key={item.date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: '6px' }}>
                          <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#059669' }}>
                            ₹{item.sales}
                          </span>
                          <div style={{ width: '60%', maxWidth: '28px', height: `${barHeightPercent}%`, background: 'linear-gradient(180deg, #34D399 0%, #059669 100%)', borderRadius: '6px 6px 0 0' }} />
                          <span style={{ fontSize: '0.7rem', color: '#6B7280', fontWeight: 700 }}>
                            {item.displayDate}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>



            </div>
          </div>
        )}
        {activeTab === 'service-requests' && (
          <div style={{
            background: '#FFFFFF',
            borderRadius: 'var(--radius-md)',
            padding: '24px',
            border: '1px solid var(--border-light)',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Megaphone size={22} color="#7C3AED" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#7C3AED' }}>
                  🛎️ Live Waiter Calls & Table Requests
                </h3>
              </div>
              <button
                onClick={loadOrders}
                style={{
                  background: '#7C3AED',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-pill)',
                  fontWeight: 800,
                  fontSize: '0.78rem',
                  cursor: 'pointer'
                }}
              >
                🔄 Refresh
              </button>
            </div>

            {serviceRequests.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#6B7280' }}>
                <CheckCircle size={40} color="#10B981" style={{ marginBottom: '8px' }} />
                <p style={{ fontWeight: 700, fontSize: '0.95rem' }}>No pending waiter calls right now!</p>
                <span style={{ fontSize: '0.78rem' }}>When a customer taps 'Call Staff' on their table, requests appear here instantly.</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {serviceRequests.map((req) => (
                  <div
                    key={req.id}
                    style={{
                      background: '#F5F3FF',
                      border: '1.5px solid #DDD6FE',
                      borderRadius: '16px',
                      padding: '16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <span style={{ background: '#7C3AED', color: '#FFFFFF', padding: '3px 10px', borderRadius: '10px', fontWeight: 900, fontSize: '0.78rem' }}>
                        TABLE #{req.table_number}
                      </span>
                      <h4 style={{ fontSize: '1.05rem', fontWeight: 900, color: '#4C1D95', margin: '6px 0 2px 0' }}>
                        {req.request_type}
                      </h4>
                      {req.note && (
                        <p style={{ fontSize: '0.82rem', color: '#6D28D9', margin: 0, fontStyle: 'italic' }}>
                          Note: "{req.note}"
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => handleResolveServiceRequest(req.id)}
                      style={{
                        background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                        color: '#FFFFFF',
                        border: 'none',
                        padding: '10px 18px',
                        borderRadius: 'var(--radius-pill)',
                        fontWeight: 900,
                        fontSize: '0.84rem',
                        cursor: 'pointer',
                        boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)'
                      }}
                    >
                      ✓ Mark Attended
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 1: Dishes Management */}
        {activeTab === 'dishes' && (
          <div>
            {/* Search & Actions Bar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="🔍 Search dish name..."
                style={{
                  width: '100%',
                  padding: '9px 14px',
                  borderRadius: 'var(--radius-pill)',
                  border: '1.5px solid var(--border-light)',
                  fontSize: '0.85rem',
                  outline: 'none',
                  background: '#FFFFFF'
                }}
              />

              <div style={{ display: 'flex', gap: '8px' }}>
                <select
                  value={selectedCatFilter}
                  onChange={(e) => setSelectedCatFilter(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-pill)',
                    border: '1.5px solid var(--primary-emerald)',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    background: '#FFFFFF',
                    color: 'var(--primary-emerald)',
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                >
                  <option value="all">📁 All Categories ({safeDishes.length})</option>
                  {safeCategories.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({safeDishes.filter(d => d && Number(d.category_id) === Number(c.id)).length})
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => setDishModalData('new')}
                  style={{
                    background: 'var(--primary-emerald)',
                    color: '#FFFFFF',
                    padding: '8px 14px',
                    borderRadius: 'var(--radius-pill)',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  <Plus size={15} /> Add Dish
                </button>
              </div>
            </div>

            <div className="admin-dish-grid" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredDishes.map((dish) => {
                const isEditingThisPrice = editingPriceId === dish.id;

                return (
                  <div key={dish.id} style={{
                    background: '#FFFFFF',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 14px',
                    border: '1px solid var(--border-light)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    boxShadow: 'var(--shadow-sm)'
                  }}>
                    {/* Top Row: Dish Metadata & Master Controls */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexGrow: 1, minWidth: 0, overflow: 'hidden' }}>
                        {dish.image && dish.image !== '/uploads/logo.jpg' ? (
                          <img src={dish.image} alt="" style={{ width: '42px', height: '42px', borderRadius: 'var(--radius-sm)', objectFit: 'cover', flexShrink: 0 }} onError={(e) => { e.target.style.display = 'none'; }} />
                        ) : (
                          <div style={{ width: '42px', height: '42px', borderRadius: 'var(--radius-sm)', background: 'var(--header-gradient)', color: 'var(--gold-bright)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1rem', flexShrink: 0 }}>🍲</div>
                        )}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{
                              width: '10px',
                              height: '10px',
                              border: dish.type === 'nonveg' ? '1.5px solid #DC2626' : dish.type === 'egg' ? '1.5px solid #D97706' : '1.5px solid var(--veg-green)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: '2px',
                              flexShrink: 0
                            }}>
                              <span style={{
                                width: '4px',
                                height: '4px',
                                borderRadius: '50%',
                                backgroundColor: dish.type === 'nonveg' ? '#DC2626' : dish.type === 'egg' ? '#D97706' : 'var(--veg-green)'
                              }} />
                            </span>
                            <h4 style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--primary-emerald)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }}>{dish.name}</h4>
                          </div>
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginTop: '2px' }}>
                            {dish.category_name || 'Category'} • {dish.price_half ? `Half ${settingsForm.currency_symbol || '₹'}${Math.round(dish.price_half)} | Full ${settingsForm.currency_symbol || '₹'}${Math.round(dish.price)}` : `${settingsForm.currency_symbol || '₹'}${Math.round(dish.price)}`}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        <button
                          onClick={() => handleToggleDish(dish.id, dish.available)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 'var(--radius-pill)',
                            fontSize: '0.74rem',
                            fontWeight: 900,
                            background: dish.available !== false ? '#DCFCE7' : '#FEE2E2',
                            color: dish.available !== false ? '#15803D' : '#DC2626',
                            border: dish.available !== false ? '1px solid #86EFAC' : '1px solid #FCA5A5',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                          title={dish.available !== false ? 'Click to mark Out of Stock Today' : 'Click to mark Available'}
                        >
                          {dish.available !== false ? '🟢 Available' : '🚫 Out of Stock Today'}
                        </button>

                        <button onClick={() => setDishModalData(dish)} style={{ color: 'var(--primary-emerald)', padding: '5px', background: '#F3F4F6', borderRadius: '6px', border: 'none', cursor: 'pointer' }} title="Full Edit">
                          <Edit size={15} />
                        </button>

                        <button onClick={() => handleDeleteDish(dish.id)} style={{ color: '#EF4444', padding: '5px', background: '#FEE2E2', borderRadius: '6px', border: 'none', cursor: 'pointer' }} title="Delete Dish">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Bottom Row: Quick Action Toolbar (Quick Price & Preset Badges) */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      overflowX: 'auto',
                      scrollbarWidth: 'none',
                      paddingTop: '6px',
                      borderTop: '1px solid #F3F4F6'
                    }}>
                      {/* Quick 1-Click Price Editor Toggle Button */}
                      <button
                        onClick={() => {
                          if (isEditingThisPrice) {
                            setEditingPriceId(null);
                          } else {
                            setEditingPriceId(dish.id);
                            setQuickPriceVal({ price: Math.round(dish.price), price_half: dish.price_half ? Math.round(dish.price_half) : '' });
                          }
                        }}
                        style={{
                          padding: '4px 9px',
                          borderRadius: 'var(--radius-pill)',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          background: isEditingThisPrice ? '#FEF3C7' : '#F3F4F6',
                          color: isEditingThisPrice ? '#D97706' : '#1F2937',
                          border: '1px solid #D1D5DB',
                          whiteSpace: 'nowrap',
                          cursor: 'pointer'
                        }}
                      >
                        ⚡ Quick Price
                      </button>

                      {/* ⭐ Must Try Toggle */}
                      <button
                        onClick={() => handleToggleBadge(dish, 'Must Try')}
                        style={{
                          padding: '4px 8px',
                          borderRadius: 'var(--radius-pill)',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          background: dish.badge === 'Must Try' ? '#FEF3C7' : '#FFFFFF',
                          color: dish.badge === 'Must Try' ? '#D97706' : '#4B5563',
                          border: dish.badge === 'Must Try' ? '1px solid #F59E0B' : '1px solid #E5E7EB',
                          whiteSpace: 'nowrap',
                          cursor: 'pointer'
                        }}
                      >
                        ⭐ Must Try
                      </button>

                      {/* ✨ Special Toggle */}
                      <button
                        onClick={() => handleToggleBadge(dish, 'Special')}
                        style={{
                          padding: '4px 8px',
                          borderRadius: 'var(--radius-pill)',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          background: dish.badge === 'Special' ? '#FCE7F3' : '#FFFFFF',
                          color: dish.badge === 'Special' ? '#BE185D' : '#4B5563',
                          border: dish.badge === 'Special' ? '1px solid #EC4899' : '1px solid #E5E5E5',
                          whiteSpace: 'nowrap',
                          cursor: 'pointer'
                        }}
                      >
                        ✨ Special
                      </button>
                    </div>

                    {/* Inline Quick Price Editing Row */}
                    {isEditingThisPrice && (
                      <div style={{
                        background: '#FFFBEB',
                        border: '1px solid #FCD34D',
                        borderRadius: 'var(--radius-sm)',
                        padding: '8px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        flexWrap: 'wrap'
                      }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#92400E' }}>⚡ Quick Price:</span>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#78350F' }}>Full</label>
                          <input
                            type="number"
                            value={quickPriceVal.price}
                            onChange={(e) => setQuickPriceVal({ ...quickPriceVal, price: e.target.value })}
                            style={{ width: '65px', padding: '4px 6px', borderRadius: '4px', border: '1px solid #F59E0B', fontSize: '0.82rem', fontWeight: 800 }}
                          />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#78350F' }}>Half</label>
                          <input
                            type="number"
                            value={quickPriceVal.price_half}
                            onChange={(e) => setQuickPriceVal({ ...quickPriceVal, price_half: e.target.value })}
                            placeholder="Opt"
                            style={{ width: '65px', padding: '4px 6px', borderRadius: '4px', border: '1px solid #F59E0B', fontSize: '0.82rem', fontWeight: 800 }}
                          />
                        </div>

                        <button
                          onClick={() => handleSaveQuickPrice(dish.id)}
                          style={{
                            background: '#D97706',
                            color: '#FFFFFF',
                            padding: '4px 12px',
                            borderRadius: 'var(--radius-pill)',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            border: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          ✓ Save
                        </button>

                        <button
                          onClick={() => setEditingPriceId(null)}
                          style={{
                            background: 'transparent',
                            color: '#78350F',
                            padding: '4px 8px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            border: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: CATEGORIES */}
        {activeTab === 'categories' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '14px' }}>
              <button
                onClick={() => setCatModalData('new')}
                style={{
                  background: 'var(--primary-emerald)',
                  color: '#FFFFFF',
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Plus size={16} /> Add Category
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {categories.map((cat) => (
                <div key={cat.id} style={{
                  background: '#FFFFFF',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 16px',
                  border: '1px solid var(--border-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {cat.image && cat.image !== '/uploads/logo.jpg' ? (
                      <img src={cat.image} alt="" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none'; }} />
                    ) : (
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--header-gradient)', color: 'var(--gold-bright)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.9rem' }}>{cat.name.charAt(0).toUpperCase()}</div>
                    )}
                    <div>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--primary-emerald)' }}>{cat.name}</h4>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{cat.name_hi || ''}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={() => handleToggleCategory(cat.id, isCatActive(cat.active))}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-pill)',
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        background: isCatActive(cat.active) ? '#DCFCE7' : '#FEE2E2',
                        color: isCatActive(cat.active) ? '#15803D' : '#DC2626',
                        border: isCatActive(cat.active) ? '1.5px solid #86EFAC' : '1.5px solid #FCA5A5',
                        cursor: 'pointer'
                      }}
                    >
                      {isCatActive(cat.active) ? '● Active' : '● Inactive (Hidden)'}
                    </button>

                    <button onClick={() => setCatModalData(cat)} style={{ color: 'var(--primary-emerald)', padding: '5px', background: '#F3F4F6', borderRadius: '6px', border: 'none', cursor: 'pointer' }} title="Edit Category">
                      <Edit size={16} />
                    </button>

                    <button onClick={() => handleDeleteCategory(cat.id)} style={{ color: '#EF4444', padding: '5px', background: '#FEE2E2', borderRadius: '6px', border: 'none', cursor: 'pointer' }} title="Delete Category">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: COMBOS / THALI BUILDER */}
        {activeTab === 'combos' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#1F2937' }}>🛒 Combo Deals & Thali Manager</h3>
              <button
                onClick={handleOpenCreateCombo}
                style={{
                  padding: '8px 16px', borderRadius: '10px', border: 'none',
                  background: 'linear-gradient(135deg, #FFD700 0%, #D4AF37 100%)',
                  color: '#0A0A0A', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px',
                  boxShadow: '0 4px 14px rgba(255,215,0,0.35)'
                }}
              >
                <Plus size={15} /> Add Combo
              </button>
            </div>

            {combos.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '50px 20px', background: '#FFFFFF',
                borderRadius: '16px', border: '1px solid #E5E7EB'
              }}>
                <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🛒</div>
                <h3 style={{ color: '#374151', fontWeight: 800, marginBottom: '6px' }}>No Combo Deals Yet</h3>
                <p style={{ color: '#6B7280', fontSize: '0.88rem' }}>Create combo thalis and meal deals to offer customers great value!</p>
                <button
                  onClick={handleOpenCreateCombo}
                  style={{
                    marginTop: '14px', padding: '10px 24px', borderRadius: '12px', border: 'none',
                    background: 'linear-gradient(135deg, #FFD700 0%, #D4AF37 100%)',
                    color: '#0A0A0A', fontWeight: 800, fontSize: '0.88rem', cursor: 'pointer'
                  }}
                >+ Create First Combo</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {combos.map(combo => {
                  let comboItems = [];
                  try { comboItems = typeof combo.items === 'string' ? JSON.parse(combo.items) : (combo.items || []); } catch { comboItems = []; }
                  const originalTotal = comboItems.reduce((s, i) => s + ((i.original_price || 0) * (i.qty || 1)), 0);
                  const savings = originalTotal - combo.price;
                  const isAvailable = combo.available === 1 || combo.available === true;
                  return (
                    <div key={combo.id} style={{
                      background: '#FFFFFF', borderRadius: '16px', padding: '16px',
                      border: `1px solid ${isAvailable ? '#E5E7EB' : '#FEE2E2'}`,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                      opacity: isAvailable ? 1 : 0.7,
                      transition: 'all 0.2s'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                        <div style={{
                          width: '94px', height: '78px', borderRadius: '14px', overflow: 'hidden',
                          background: '#F9FAFB', border: '1.5px solid rgba(255,215,0,0.4)', flexShrink: 0,
                          position: 'relative', boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                        }}>
                          {combo.image && combo.image !== '/uploads/logo.jpg' ? (
                            <img 
                              src={combo.image} 
                              alt={combo.name} 
                              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} 
                              onError={(e) => {
                                e.target.style.display = 'none';
                                if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                              }} 
                            />
                          ) : null}
                          <div style={{
                            width: '100%', height: '100%',
                            display: (combo.image && combo.image !== '/uploads/logo.jpg') ? 'none' : 'flex',
                            alignItems: 'center', justifyContent: 'center', fontSize: '2.2rem',
                            background: 'linear-gradient(135deg, rgba(255,215,0,0.15), rgba(10,35,21,0.1))'
                          }}>
                            🍱
                          </div>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 800, fontSize: '1rem', color: '#1F2937' }}>{combo.name}</span>
                            {combo.badge && (
                              <span style={{
                                padding: '2px 8px', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 700,
                                background: 'linear-gradient(135deg, #FFD700, #F59E0B)', color: '#0A0A0A'
                              }}>{combo.badge}</span>
                            )}
                            {!isAvailable && (
                              <span style={{
                                padding: '2px 8px', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 700,
                                background: '#FEE2E2', color: '#DC2626'
                              }}>Unavailable</span>
                            )}
                          </div>
                          {combo.description && (
                            <p style={{ color: '#6B7280', fontSize: '0.78rem', margin: '0 0 6px 0' }}>{combo.description}</p>
                          )}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                            <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#059669' }}>₹{combo.price}</span>
                            {originalTotal > 0 && originalTotal > combo.price && (
                              <>
                                <span style={{ textDecoration: 'line-through', color: '#9CA3AF', fontSize: '0.82rem' }}>₹{originalTotal}</span>
                                <span style={{
                                  padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700,
                                  background: 'rgba(74,222,128,0.15)', color: '#059669'
                                }}>Save ₹{savings}</span>
                              </>
                            )}
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {comboItems.map((item, idx) => (
                              <span key={idx} style={{
                                padding: '2px 8px', borderRadius: '6px', fontSize: '0.7rem',
                                background: '#F3F4F6', color: '#374151', fontWeight: 600
                              }}>
                                {item.qty > 1 ? `${item.qty}x ` : ''}{item.dish_name} {item.portion === 'half' ? '(H)' : ''}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div style={{ display: 'flex', gap: '8px', marginTop: '12px', borderTop: '1px solid #F3F4F6', paddingTop: '10px' }}>
                        <button
                          onClick={async () => {
                            try {
                              await toggleComboAvailability(combo.id, !isAvailable, token);
                              setCombos(prev => prev.map(c => c.id === combo.id ? { ...c, available: !isAvailable ? 1 : 0 } : c));
                            } catch { alert('Failed to toggle'); }
                          }}
                          style={{
                            flex: 1, padding: '8px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem',
                            border: '1px solid ' + (isAvailable ? '#FEE2E2' : '#D1FAE5'),
                            background: isAvailable ? 'rgba(239,68,68,0.06)' : 'rgba(16,185,129,0.06)',
                            color: isAvailable ? '#DC2626' : '#059669'
                          }}
                        >
                          {isAvailable ? '🔴 Mark Unavailable' : '🟢 Mark Available'}
                        </button>
                        <button
                          onClick={() => setComboModalData(combo)}
                          style={{
                            padding: '8px 16px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem',
                            border: '1px solid rgba(255,215,0,0.3)', background: 'rgba(255,215,0,0.08)', color: '#B45309'
                          }}
                        >
                          <Edit size={13} /> Edit
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm(`Delete combo "${combo.name}"?`)) return;
                            try {
                              await deleteCombo(combo.id, token);
                              setCombos(prev => prev.filter(c => c.id !== combo.id));
                            } catch { alert('Failed to delete'); }
                          }}
                          style={{
                            padding: '8px 16px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem',
                            border: '1px solid #FEE2E2', background: 'rgba(239,68,68,0.06)', color: '#DC2626'
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: TABLE & QR MANAGER */}
        {activeTab === 'qr-generator' && (
          <div>
            {/* Top Action Bar */}
            <div style={{
              background: '#FFFFFF',
              borderRadius: 'var(--radius-md)',
              padding: '20px 24px',
              border: '1px solid var(--border-light)',
              boxShadow: 'var(--shadow-sm)',
              marginBottom: '20px',
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '16px'
            }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--primary-emerald)', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <QrCode size={22} /> Restaurant Dining Tables & QR Manager
                </h3>
                <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: 0 }}>
                  Manage tables, add new dining tables, delete tables, and print QR standees for your restaurant.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  onClick={handleAddTable}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '12px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #FFD700 0%, #D4AF37 100%)',
                    color: '#0A0A0A',
                    fontWeight: 900,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 14px rgba(255,215,0,0.35)'
                  }}
                >
                  <Plus size={16} /> + Add New Table (Table ${totalTablesCount + 1})
                </button>

                <button
                  onClick={() => {
                    setTableNumber('1');
                    handlePrintQR();
                  }}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '12px',
                    border: 'none',
                    background: 'linear-gradient(135deg, var(--primary-emerald), #059669)',
                    color: '#FFFFFF',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Printer size={16} /> Quick Print QR
                </button>

                <button
                  onClick={handlePrintAllQRs}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '12px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)',
                    color: '#FFFFFF',
                    fontWeight: 900,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 14px rgba(99,102,241,0.3)'
                  }}
                >
                  <Printer size={16} /> 🖨️ Print All Table QRs (Uniform)
                </button>
              </div>
            </div>

            {/* Table Cards Grid */}
            {totalTablesCount === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '50px 20px',
                background: '#FFFFFF',
                borderRadius: '20px',
                border: '1.5px dashed var(--border-light)',
                boxShadow: 'var(--shadow-sm)',
                marginBottom: '28px'
              }}>
                <div style={{ fontSize: '3.5rem', marginBottom: '12px' }}>📱</div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--primary-emerald)', margin: '0 0 6px 0' }}>
                  No Table QR Codes Generated Yet
                </h3>
                <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', maxWidth: '440px', margin: '0 auto 20px auto', lineHeight: 1.5 }}>
                  Click <strong>+ Add New Table</strong> to generate your first dining table QR standee sticker!
                </p>
                <button
                  onClick={handleAddTable}
                  style={{
                    padding: '12px 24px', borderRadius: '12px', border: 'none',
                    background: 'linear-gradient(135deg, #FFD700 0%, #D4AF37 100%)',
                    color: '#0A0A0A', fontWeight: 900, fontSize: '0.9rem', cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(255,215,0,0.35)'
                  }}
                >
                  ➕ Add Table 1 (Generate First QR)
                </button>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: '16px',
                marginBottom: '28px'
              }}>
                {Array.from({ length: totalTablesCount }, (_, i) => i + 1).map((tNum) => {
                  const tableInfo = tableGrid.find(t => t.tableNumber === tNum);
                  const isOccupied = tableInfo?.status === 'occupied';
                  const isService = tableInfo?.status === 'service_needed';
                  const qrDataUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(window.location.origin + '/' + (settingsForm.slug || 'raman-sweet-bakery') + '?table=' + tNum)}`;

                  return (
                    <div key={tNum} style={{
                      background: '#FFFFFF',
                      borderRadius: '18px',
                      padding: '18px',
                      border: isService ? '2px solid #F59E0B' : isOccupied ? '2px solid #EF4444' : '1px solid var(--border-light)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                      textAlign: 'center',
                      position: 'relative',
                      transition: 'all 0.2s'
                    }}>
                      {/* Card Top: Number + Delete Button */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span style={{
                          background: '#0A2315',
                          color: '#DFBA67',
                          padding: '4px 12px',
                          borderRadius: 'var(--radius-pill)',
                          fontSize: '0.82rem',
                          fontWeight: 900,
                          border: '1px solid #C5A059'
                        }}>
                          Table {tNum}
                        </span>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {/* Delete Button */}
                          <button
                            onClick={() => handleDeleteTable(tNum)}
                            title={`Delete Table ${tNum}`}
                            style={{
                              background: '#FEE2E2',
                              color: '#DC2626',
                              border: 'none',
                              borderRadius: '50%',
                              width: '26px',
                              height: '26px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer'
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* QR Code Graphic Preview */}
                      <div style={{
                        background: '#FAFAFA',
                        padding: '12px',
                        borderRadius: '14px',
                        border: '1px solid #F3F4F6',
                        display: 'inline-block',
                        marginBottom: '12px'
                      }}>
                        <img
                          src={qrDataUrl}
                          alt={`Table ${tNum}`}
                          style={{ width: '120px', height: '120px', display: 'block' }}
                        />
                      </div>

                      {/* Live Status Badge */}
                      <div style={{ marginBottom: '14px' }}>
                        {isService ? (
                          <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 800, background: '#FEF3C7', color: '#B45309' }}>
                            🔔 Call Staff Request
                          </span>
                        ) : isOccupied ? (
                          <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 800, background: '#FEE2E2', color: '#DC2626' }}>
                            🔴 Occupied (Order Active)
                          </span>
                        ) : (
                          <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 800, background: '#DCFCE7', color: '#15803D' }}>
                            🟢 Available
                          </span>
                        )}
                      </div>

                      {/* Quick Print Button */}
                      <button
                        onClick={() => {
                          setTableNumber(String(tNum));
                          handlePrintQR();
                        }}
                        style={{
                          width: '100%',
                          padding: '9px',
                          borderRadius: '10px',
                          border: 'none',
                          background: 'var(--primary-emerald)',
                          color: '#FFFFFF',
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}
                      >
                        <Printer size={14} /> Print Standee QR
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Custom Single QR Standee Generator */}
            <div style={{
              background: '#FFFFFF',
              borderRadius: 'var(--radius-md)',
              padding: '24px',
              border: '1px solid var(--border-light)',
              boxShadow: 'var(--shadow-sm)',
              textAlign: 'center',
              maxWidth: '440px',
              margin: '0 auto'
            }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--primary-emerald)', marginBottom: '8px' }}>
                🖨️ Print Custom Table QR Standee
              </h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                Type any custom table number or label below to preview & print a standee sticker:
              </p>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '16px' }}>
                <input
                  type="text"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  placeholder="Table Number (e.g. 5, VIP-1)"
                  style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-light)',
                    fontSize: '0.9rem',
                    width: '100%'
                  }}
                />
                <button
                  onClick={handlePrintQR}
                  style={{
                    background: 'var(--primary-emerald)',
                    color: '#FFFFFF',
                    padding: '10px 18px',
                    borderRadius: 'var(--radius-sm)',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Printer size={15} /> Print
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: GOOGLE REVIEW LINK */}
        {activeTab === 'review' && (
          <div style={{
            background: '#FFFFFF',
            borderRadius: 'var(--radius-md)',
            padding: '24px',
            border: '1px solid var(--border-light)',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Star size={22} color="#D4AF37" fill="#D4AF37" />
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary-emerald)' }}>
                Google Review Link
              </h3>
            </div>
            
            <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: 1.5 }}>
              Aapna Google Maps Review link yaha daalein. Jab customer menu header me <strong>⭐ Review Us / रेटिंग दें</strong> par click karenge, toh ye link open hoga:
            </p>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary-emerald)', marginBottom: '6px' }}>
                Google Review Link (URL):
              </label>
              <input
                type="url"
                value={settingsForm.google_review_url}
                onChange={(e) => setSettingsForm({ ...settingsForm, google_review_url: e.target.value })}
                placeholder="https://share.google/2M5mFMPlmS6pAXRf7"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1.5px solid var(--gold-primary)',
                  fontSize: '0.92rem',
                  outline: 'none',
                  background: 'var(--gold-soft)'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={handleSaveSettings}
                style={{
                  background: 'var(--primary-emerald)',
                  color: '#FFFFFF',
                  padding: '10px 24px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer'
                }}
              >
                <CheckCircle size={16} /> Save Review Link
              </button>

              {settingsForm.google_review_url && (
                <a
                  href={settingsForm.google_review_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                    color: '#0A2315',
                    padding: '10px 20px',
                    borderRadius: 'var(--radius-pill)',
                    fontSize: '0.88rem',
                    fontWeight: 800,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    textDecoration: 'none'
                  }}
                >
                  <ExternalLink size={15} /> Test Link ↗
                </a>
              )}


            {settingsSavedMsg && (
              <p style={{ marginTop: '14px', color: '#15803D', fontSize: '0.84rem', fontWeight: 700 }}>
                ✓ Google Review Link saved successfully!
              </p>
            )}
            </div>

            {/* Customer Button Live Preview */}
            <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border-light)' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '10px' }}>
                CUSTOMER MENU BUTTON PREVIEW:
              </span>
              <button
                onClick={() => {
                  if (settingsForm.google_review_url) {
                    window.open(settingsForm.google_review_url, '_blank');
                  } else {
                    alert('Pehle Google Review Link daal kar Save karein.');
                  }
                }}
                style={{
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  color: '#0A2315',
                  background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                  border: '1px solid #FFFFFF',
                  padding: '6px 16px',
                  borderRadius: 'var(--radius-pill)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  boxShadow: '0 2px 8px rgba(255, 215, 0, 0.4)'
                }}
              >
                <Star size={14} color="#0A2315" fill="#0A2315" />
                Review Us / रेटिंग दें
              </button>
            </div>
          </div>
        )}

        {/* TAB 5: RESTAURANT SETTINGS */}
        {activeTab === 'settings' && (
          <>
          {/* Active SaaS Subscription Plan Badge */}
          <div style={{
            background: 'linear-gradient(135deg, #0A2315 0%, #164E2A 100%)',
            color: '#FFFFFF',
            borderRadius: 'var(--radius-md)',
            padding: '20px',
            marginBottom: '20px',
            border: '2px solid #D4AF37',
            boxShadow: '0 8px 24px rgba(10,35,21,0.25)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#DFBA67', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  ACTIVE SAAS SUBSCRIPTION PLAN
                </span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#FFFFFF', margin: '2px 0 0 0' }}>
                  👑 {(restaurantInfo?.plan_tier || 'PRO').toUpperCase()} PLAN ({restaurantInfo?.currency_symbol || '₹'}{restaurantInfo?.plan_price || 999}/mo)
                </h3>
              </div>
              <span style={{
                background: restaurantInfo?.active !== false ? '#DCFCE7' : '#FEE2E2',
                color: restaurantInfo?.active !== false ? '#15803D' : '#DC2626',
                padding: '4px 12px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '0.78rem',
                fontWeight: 900
              }}>
                {restaurantInfo?.active !== false ? '● ACTIVE SUBSCRIPTION' : '● SUSPENDED'}
              </span>
            </div>

            {/* Feature Access Matrix Status */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', paddingTop: '12px', borderTop: '1px solid rgba(212,175,55,0.3)' }}>
              <div style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>🟢 Direct Table Ordering:</span>
                <strong style={{ color: restaurantInfo?.direct_ordering_enabled ? '#4ADE80' : '#FCA5A5' }}>
                  {restaurantInfo?.direct_ordering_enabled ? 'Active ✅' : 'Disabled 🔒'}
                </strong>
              </div>
              <div style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>💬 WhatsApp Drawer:</span>
                <strong style={{ color: restaurantInfo?.whatsapp_enabled ? '#4ADE80' : '#FCA5A5' }}>
                  {restaurantInfo?.whatsapp_enabled ? 'Active ✅' : 'Disabled 🔒'}
                </strong>
              </div>
              <div style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>⭐ Google Review Rating:</span>
                <strong style={{ color: restaurantInfo?.google_reviews_enabled ? '#4ADE80' : '#FCA5A5' }}>
                  {restaurantInfo?.google_reviews_enabled ? 'Active ✅' : 'Disabled 🔒'}
                </strong>
              </div>
            </div>
          </div>

          {/* Quick Accordion Expand/Collapse Controls */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: '14px', flexWrap: 'wrap', gap: '8px'
          }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--primary-emerald)' }}>
              ⚙️ RESTAURANT CONFIGURATION PANELS
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={() => setOpenSettingsSections({ profile: true, permissions: true, security: true })}
                style={{ background: 'rgba(10,35,21,0.08)', color: 'var(--primary-emerald)', border: 'none', padding: '4px 10px', borderRadius: 'var(--radius-pill)', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer' }}
              >
                Expand All
              </button>
              <button
                onClick={() => setOpenSettingsSections({ profile: false, permissions: false, security: false })}
                style={{ background: 'rgba(220,38,38,0.08)', color: '#DC2626', border: 'none', padding: '4px 10px', borderRadius: 'var(--radius-pill)', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer' }}
              >
                Collapse All
              </button>
            </div>
          </div>

          {/* Accordion 1: Restaurant Profile & Settings Header */}
          <div 
            onClick={() => toggleSettingsSection('profile')}
            style={{
              background: 'linear-gradient(135deg, #0A2315 0%, #164E2A 100%)',
              color: '#FFFFFF',
              borderRadius: openSettingsSections.profile ? '16px 16px 0 0' : '16px',
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              justify: 'space-between',
              cursor: 'pointer',
              marginBottom: openSettingsSections.profile ? 0 : '14px',
              boxShadow: '0 4px 14px rgba(10,35,21,0.2)',
              border: '1.5px solid #D4AF37'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px' }}>🏢</span>
              <h3 style={{ fontSize: '0.98rem', fontWeight: 900, color: '#FFD700', margin: 0 }}>
                1. Restaurant Profile, Details & Menu Filters
              </h3>
            </div>
            <span style={{ fontSize: '0.8rem', color: '#FFD700', fontWeight: 900 }}>
              {openSettingsSections.profile ? '▲ Collapse' : '▼ Tap to Expand'}
            </span>
          </div>

          {openSettingsSections.profile && (
            <div style={{
              background: '#FFFFFF',
              borderRadius: '0 0 16px 16px',
              padding: '24px',
              border: '1.5px solid var(--border-light)',
              borderTop: 'none',
              marginBottom: '16px'
            }}>
              <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: 1.5 }}>
                Update your restaurant contact number, address, opening hours, logo, and Google review link below. These details will automatically update across your digital menu header, info modal, and footer.
              </p>

            {/* Restaurant Brand Logo Uploader */}
            <div style={{
              marginBottom: '20px',
              padding: '16px',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-sm)',
              border: '1.5px dashed var(--gold-border)',
              display: 'flex',
              alignItems: 'center',
              gap: '16px'
            }}>
              {settingsForm.logo && settingsForm.logo !== '/uploads/logo.jpg' ? (
                <img
                  src={settingsForm.logo}
                  alt="Logo Preview"
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '2px solid var(--gold-bright)'
                  }}
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              ) : (
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'var(--header-gradient)',
                  color: 'var(--gold-bright)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: '1.4rem'
                }}>
                  {(settingsForm.name || 'R').charAt(0).toUpperCase()}
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 800, color: 'var(--primary-emerald)', marginBottom: '4px' }}>
                  🖼️ Restaurant Brand Logo
                </label>
                <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  Upload PNG/JPG logo (Recommended: 200x200px round logo)
                </p>
                <label style={{
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'var(--header-gradient)',
                  color: '#FFFFFF',
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '0.78rem',
                  fontWeight: 700
                }}>
                  <Upload size={14} /> Upload Logo File
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={async (e) => {
                      const file = e.target.files[0];
                      if (!file) return;
                      try {
                        const url = await uploadImage(file, token);
                        setSettingsForm(prev => ({ ...prev, logo: url }));
                        setToastMessage('Logo uploaded! Click "Save Restaurant Settings" below.');
                      } catch (err) {
                        setToastMessage('Logo upload failed');
                      }
                    }}
                  />
                </label>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary-emerald)', marginBottom: '6px' }}>
                  Restaurant Name:
                </label>
                <input
                  type="text"
                  value={settingsForm.name}
                  onChange={(e) => setSettingsForm({ ...settingsForm, name: e.target.value })}
                  placeholder="e.g. Royal Pizza Cafe"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1.5px solid var(--border-light)',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary-emerald)', marginBottom: '6px' }}>
                  Phone Number:
                </label>
                <input
                  type="text"
                  value={settingsForm.phone}
                  onChange={(e) => setSettingsForm({ ...settingsForm, phone: e.target.value })}
                  placeholder="e.g. +91 9876543210"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1.5px solid var(--border-light)',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary-emerald)', marginBottom: '6px' }}>
                  FSSAI License No:
                </label>
                <input
                  type="text"
                  value={settingsForm.fssai_lic_no}
                  onChange={(e) => setSettingsForm({ ...settingsForm, fssai_lic_no: e.target.value })}
                  placeholder="e.g. 20824001000123"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1.5px solid var(--border-light)',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary-emerald)', marginBottom: '6px' }}>
                  Restaurant Category / Type:
                </label>
                <select
                  value={settingsForm.resto_type}
                  onChange={(e) => setSettingsForm({ ...settingsForm, resto_type: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1.5px solid var(--border-light)',
                    fontSize: '0.9rem',
                    outline: 'none',
                    background: '#FFFFFF'
                  }}
                >
                  <option value="pure_veg">100% Pure Vegetarian 🟢</option>
                  <option value="veg_nonveg">Veg & Non-Veg Multi-Cuisine 🔴🟢</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary-emerald)', marginBottom: '6px' }}>
                  Tagline / Badge:
                </label>
                <input
                  type="text"
                  value={settingsForm.tagline}
                  onChange={(e) => setSettingsForm({ ...settingsForm, tagline: e.target.value })}
                  placeholder="100% Pure Vegetarian"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1.5px solid var(--border-light)',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary-emerald)', marginBottom: '6px' }}>
                  Opening Hours:
                </label>
                <input
                  type="text"
                  value={settingsForm.openingHours}
                  onChange={(e) => setSettingsForm({ ...settingsForm, openingHours: e.target.value })}
                  placeholder="8:00 AM - 10:30 PM (Mon - Sun)"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1.5px solid var(--border-light)',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary-emerald)', marginBottom: '6px' }}>
                Full Address:
              </label>
              <input
                type="text"
                value={settingsForm.address}
                onChange={(e) => setSettingsForm({ ...settingsForm, address: e.target.value })}
                placeholder="HawaiAdda Chowk, Near katchari Gumti, Motihari, Bihar"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1.5px solid var(--border-light)',
                  fontSize: '0.9rem',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary-emerald)', marginBottom: '6px' }}>
                  📍 Google Maps Location / Directions Link:
                </label>
                <input
                  type="url"
                  value={settingsForm.google_maps_url}
                  onChange={(e) => setSettingsForm({ ...settingsForm, google_maps_url: e.target.value })}
                  placeholder="https://maps.google.com/?q=HawaiAdda+Chowk,+Motihari"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1.5px solid var(--border-light)',
                    fontSize: '0.88rem',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary-emerald)', marginBottom: '6px' }}>
                  ⭐ Google Review Link:
                </label>
                <input
                  type="url"
                  value={settingsForm.google_review_url}
                  onChange={(e) => setSettingsForm({ ...settingsForm, google_review_url: e.target.value })}
                  placeholder="https://g.page/r/YOUR_BUSINESS_ID/review"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1.5px solid var(--border-light)',
                    fontSize: '0.88rem',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary-emerald)', marginBottom: '6px' }}>
                  🍽️ Restaurant Cuisine Type (AI Review Generator Context):
                </label>
                <select
                  value={settingsForm.resto_type || 'pure_veg'}
                  onChange={(e) => setSettingsForm({ ...settingsForm, resto_type: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1.5px solid var(--border-light)',
                    fontSize: '0.88rem',
                    outline: 'none',
                    fontWeight: 700,
                    background: '#FFFFFF'
                  }}
                >
                  <option value="sweet_bakery">🧁 Sweet & Bakery (Mithai, Namkeen, Snacks)</option>
                  <option value="multi_cuisine">🍲 Multi-Cuisine Restaurant (Family Dining, Naan, Gravies)</option>
                  <option value="fast_food">🍔 Fast Food & Cafe (Burger, Pizza, Shakes, Quick Bites)</option>
                  <option value="pure_veg">🌿 Pure Veg & South Indian (Dosa, Idli, Pure Veg Thali)</option>
                  <option value="biryani">🍗 Biryani & Non-Veg Special (Biryani, Mughlai, Flavor)</option>
                </select>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.86rem', fontWeight: 800, color: 'var(--primary-emerald)', marginTop: '4px' }}>
                  <input
                    type="checkbox"
                    checked={settingsForm.google_reviews_enabled !== false && settingsForm.google_reviews_enabled !== 0}
                    onChange={(e) => setSettingsForm({ ...settingsForm, google_reviews_enabled: e.target.checked })}
                    style={{ width: '18px', height: '18px', accentColor: '#DFBA67', cursor: 'pointer' }}
                  />
                  <span>Enable Smart AI Google Review Booster Button</span>
                </label>
              </div>

            {/* 🧾 GST & Tax Invoice Settings Card */}
            <div style={{
              background: '#FFFBEB',
              border: '1.5px solid #FCD34D',
              borderRadius: '16px',
              padding: '16px 18px',
              marginBottom: '20px'
            }}>
              <strong style={{ fontSize: '0.95rem', color: '#92400E', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                🧾 Customer Bill & GST Tax Invoice Settings
              </strong>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', alignItems: 'center' }}>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.86rem', fontWeight: 800, color: '#78350F' }}>
                    <input
                      type="checkbox"
                      checked={!!settingsForm.gst_enabled}
                      onChange={(e) => setSettingsForm({ ...settingsForm, gst_enabled: e.target.checked })}
                      style={{ width: '18px', height: '18px', accentColor: '#D97706', cursor: 'pointer' }}
                    />
                    <span>Enable 5% GST Tax Billing (CGST 2.5% + SGST 2.5%)</span>
                  </label>
                  <span style={{ fontSize: '0.74rem', color: '#B45309', display: 'block', marginTop: '2px', marginLeft: '26px' }}>
                    Calculates and prints 5% GST breakdown on customer final bills
                  </span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#78350F', marginBottom: '4px' }}>
                    GSTIN Registration Number (Optional):
                  </label>
                  <input
                    type="text"
                    value={settingsForm.gstin_number || ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, gstin_number: e.target.value.toUpperCase() })}
                    placeholder="e.g. 10AAAAA0000A1Z5"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #FDE68A', fontSize: '0.85rem', textTransform: 'uppercase' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#78350F', marginBottom: '4px' }}>
                    Total Dining Tables in Hall:
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={settingsForm.total_tables !== undefined && settingsForm.total_tables !== null ? settingsForm.total_tables : 0}
                    onChange={(e) => setSettingsForm({ ...settingsForm, total_tables: Math.max(0, parseInt(e.target.value) || 0) })}
                    placeholder="e.g. 0"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #FDE68A', fontSize: '0.85rem' }}
                  />
                </div>
              </div>
            </div>

            {/* 📍 GPS Geo-Fencing Radius Configuration Card */}
            <div style={{
              background: '#F0FDF4',
              border: '1.5px solid #86EFAC',
              borderRadius: '16px',
              padding: '16px 18px',
              marginBottom: '20px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <strong style={{ fontSize: '0.95rem', color: '#166534', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    📍 Restaurant GPS Radius Protection (Anti-Fake Order Shield)
                  </strong>
                  <span style={{ fontSize: '0.78rem', color: '#15803D' }}>
                    Prevents fake orders from customers outside the restaurant (e.g. photos of table QR codes)
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (navigator.geolocation) {
                      navigator.geolocation.getCurrentPosition((pos) => {
                        setSettingsForm(prev => ({
                          ...prev,
                          latitude: Number(pos.coords.latitude.toFixed(6)),
                          longitude: Number(pos.coords.longitude.toFixed(6))
                        }));
                        alert(`📍 Location detected: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}. Click 'Save Restaurant Settings' below to apply!`);
                      }, (err) => {
                        alert('Unable to detect GPS location: ' + err.message);
                      });
                    } else {
                      alert('Geolocation is not supported by your browser.');
                    }
                  }}
                  style={{
                    background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '8px 14px',
                    borderRadius: 'var(--radius-pill)',
                    fontWeight: 900,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  📍 Detect My Current Location
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#166534', marginBottom: '4px' }}>
                    Latitude (GPS):
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={settingsForm.latitude !== undefined ? settingsForm.latitude : ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, latitude: e.target.value })}
                    placeholder="e.g. 26.6500"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #A7F3D0', fontSize: '0.84rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#166534', marginBottom: '4px' }}>
                    Longitude (GPS):
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={settingsForm.longitude !== undefined ? settingsForm.longitude : ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, longitude: e.target.value })}
                    placeholder="e.g. 84.9167"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #A7F3D0', fontSize: '0.84rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#166534', marginBottom: '4px' }}>
                    Max Order Radius (Meters):
                  </label>
                  <input
                    type="number"
                    value={settingsForm.max_distance_meters || 100}
                    onChange={(e) => setSettingsForm({ ...settingsForm, max_distance_meters: Number(e.target.value) })}
                    placeholder="100"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #A7F3D0', fontSize: '0.84rem' }}
                  />
                </div>
              </div>
            </div>

              {/* Currency Symbol Selector */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary-emerald)', marginBottom: '6px' }}>
                  💰 Currency Symbol:
                </label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {['₹', '$', '€', '£', ''].map((sym) => (
                    <button
                      key={sym || 'none'}
                      onClick={() => setSettingsForm({ ...settingsForm, currency_symbol: sym })}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 'var(--radius-pill)',
                        fontSize: '0.9rem',
                        fontWeight: 800,
                        background: settingsForm.currency_symbol === sym ? 'var(--primary-emerald)' : '#FFFFFF',
                        color: settingsForm.currency_symbol === sym ? '#FFFFFF' : 'var(--text-dark)',
                        border: settingsForm.currency_symbol === sym ? '2px solid var(--primary-emerald)' : '1.5px solid var(--border-light)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        minWidth: '48px'
                      }}
                    >
                      {sym || 'None'}
                    </button>
                  ))}
                </div>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Menu me price ke aage ye symbol dikhega. "None" choose karein agar koi symbol nahi chahiye.
                </p>
              </div>
            </div>

            {/* Individual Filter Buttons ON / OFF Toggles */}
            <div style={{
              background: '#FAF8F5',
              border: '1.5px solid var(--gold-primary)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              marginBottom: '20px'
            }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--primary-emerald)', marginBottom: '4px' }}>
                🎛️ Customer Menu Filter Buttons Visibility
              </h4>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
                Menu page par har ek filter button ko alag-alag ON ya OFF karein:
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                {[
                  { key: 'veg', label: '🟢 Veg Only Button' },
                  { key: 'nonveg', label: '🔴 Non-Veg Button' },
                  { key: 'egg', label: '🟡 Egg Button' },
                  { key: 'must_try', label: '⭐ Must Try Button' },
                  { key: 'special', label: '✨ Special Button' },
                  { key: 'under100', label: '⚡ Under 100 Button' }
                ].map((item) => {
                  const isVisible = settingsForm.filters_visibility?.[item.key] !== false;
                  return (
                    <div key={item.key} style={{
                      background: isVisible ? '#F0FDF4' : '#FEF2F2',
                      border: isVisible ? '1px solid #86EFAC' : '1px solid #FCA5A5',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 800, color: isVisible ? '#166534' : '#991B1B' }}>
                        {item.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const currentVis = settingsForm.filters_visibility || {};
                          setSettingsForm({
                            ...settingsForm,
                            filters_visibility: {
                              ...currentVis,
                              [item.key]: !isVisible
                            }
                          });
                        }}
                        style={{
                          padding: '4px 12px',
                          borderRadius: 'var(--radius-pill)',
                          fontWeight: 800,
                          fontSize: '0.74rem',
                          background: isVisible ? '#15803D' : '#DC2626',
                          color: '#FFFFFF',
                          border: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        {isVisible ? 'ON' : 'OFF'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              onClick={handleSaveSettings}
              style={{
                background: 'var(--primary-emerald)',
                color: '#FFFFFF',
                padding: '10px 24px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '0.88rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer'
              }}
            >
              <CheckCircle size={16} /> Save All Settings
            </button>

            {settingsSavedMsg && (
              <span style={{
                marginLeft: '12px',
                color: '#15803D',
                fontSize: '0.84rem',
                fontWeight: 700
              }}>
                ✓ Restaurant Settings Saved Successfully!
              </span>
            )}
            </div>
          )}

          {/* Accordion 2: Order Siren Sound & Mobile Device Permissions */}
          <div 
            onClick={() => toggleSettingsSection('permissions')}
            style={{
              background: 'linear-gradient(135deg, #0A2315 0%, #164E2A 100%)',
              color: '#FFFFFF',
              borderRadius: openSettingsSections.permissions ? '16px 16px 0 0' : '16px',
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              justify: 'space-between',
              cursor: 'pointer',
              marginBottom: openSettingsSections.permissions ? 0 : '14px',
              boxShadow: '0 4px 14px rgba(10,35,21,0.2)',
              border: '1.5px solid #D4AF37'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px' }}>🔔</span>
              <h3 style={{ fontSize: '0.98rem', fontWeight: 900, color: '#FFD700', margin: 0 }}>
                2. Order Alarm Siren & Mobile Device Permissions
              </h3>
            </div>
            <span style={{ fontSize: '0.8rem', color: '#FFD700', fontWeight: 900 }}>
              {openSettingsSections.permissions ? '▲ Collapse' : '▼ Tap to Expand'}
            </span>
          </div>

          {openSettingsSections.permissions && (
            <div style={{
              background: '#FFFFFF',
              borderRadius: '0 0 16px 16px',
              padding: '24px',
              border: '1.5px solid var(--border-light)',
              borderTop: 'none',
              marginBottom: '16px'
            }}>
              <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: 1.5 }}>
                Configure your phone or laptop sound siren, desktop push notifications, and GPS location permissions.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                {/* Sound Ringtone Control */}
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <strong style={{ fontSize: '0.85rem', color: '#1E293B' }}>🔊 Order Siren Sound:</strong>
                    <span style={{ fontSize: '0.7rem', fontWeight: 900, color: permissionsGranted ? '#15803D' : '#B45309', background: permissionsGranted ? '#DCFCE7' : '#FEF3C7', padding: '2px 6px', borderRadius: '4px' }}>
                      {permissionsGranted ? 'Active' : 'Needs Unlock'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={requestAudioPermission}
                      style={{ flex: 1, padding: '7px', borderRadius: '8px', background: '#DFBA67', color: '#0A0A0A', border: 'none', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer' }}
                    >
                      🔊 Test Alarm
                    </button>
                    <button
                      onClick={requestAudioPermission}
                      style={{ flex: 1, padding: '7px', borderRadius: '8px', background: '#0A2315', color: '#FFD700', border: 'none', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer' }}
                    >
                      ⚡ Enable
                    </button>
                  </div>
                </div>

                {/* Push Notifications Control */}
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <strong style={{ fontSize: '0.85rem', color: '#1E293B' }}>🔔 Push Notifications:</strong>
                    <span style={{ fontSize: '0.7rem', fontWeight: 900, color: ('Notification' in window && Notification.permission === 'granted') ? '#15803D' : '#DC2626', background: ('Notification' in window && Notification.permission === 'granted') ? '#DCFCE7' : '#FEE2E2', padding: '2px 6px', borderRadius: '4px' }}>
                      {('Notification' in window && Notification.permission === 'granted') ? 'Allowed' : 'Blocked'}
                    </span>
                  </div>
                  <button
                    onClick={requestNotificationPermission}
                    style={{ width: '100%', padding: '7px', borderRadius: '8px', background: '#312E81', color: '#FFFFFF', border: 'none', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer' }}
                  >
                    🔔 Request Access
                  </button>
                </div>

                {/* GPS Location Control */}
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <strong style={{ fontSize: '0.85rem', color: '#1E293B' }}>📍 GPS Location:</strong>
                    <span style={{ fontSize: '0.7rem', fontWeight: 900, color: '#15803D', background: '#DCFCE7', padding: '2px 6px', borderRadius: '4px' }}>
                      Enabled
                    </span>
                  </div>
                  <button
                    onClick={requestGpsPermission}
                    style={{ width: '100%', padding: '7px', borderRadius: '8px', background: '#E2E8F0', color: '#1E293B', border: 'none', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer' }}
                  >
                    📍 Detect GPS
                  </button>
                </div>

                {/* 🖨️ Bluetooth Thermal Printer Control */}
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <strong style={{ fontSize: '0.85rem', color: '#1E293B' }}>🖨️ Bluetooth Thermal Printer:</strong>
                    <span style={{ fontSize: '0.7rem', fontWeight: 900, color: '#15803D', background: '#DCFCE7', padding: '2px 6px', borderRadius: '4px' }}>
                      Ready (58/80mm)
                    </span>
                  </div>
                  <button
                    onClick={() => setShowPrinterModal(true)}
                    style={{ width: '100%', padding: '7px', borderRadius: '8px', background: 'linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%)', color: '#FFFFFF', border: 'none', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer' }}
                  >
                    🖨️ View Printer Setup Guide
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Accordion 3: SaaS Billing & Subscription Management */}
          <div 
            onClick={() => toggleSettingsSection('billing')}
            style={{
              background: 'linear-gradient(135deg, #0A2315 0%, #164E2A 100%)',
              color: '#FFFFFF',
              borderRadius: openSettingsSections.billing ? '16px 16px 0 0' : '16px',
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              marginBottom: openSettingsSections.billing ? 0 : '14px',
              boxShadow: '0 4px 14px rgba(10,35,21,0.25)',
              border: '1.5px solid #DFBA67'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ background: 'rgba(255,255,255,0.15)', padding: '8px', borderRadius: '10px' }}>
                <CreditCard size={20} color="#DFBA67" />
              </div>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 900, margin: 0, color: '#DFBA67' }}>
                  SECTION 3: 💳 BILLING & SUBSCRIPTION PLAN
                </h3>
                <span style={{ fontSize: '0.74rem', color: '#E2E8F0' }}>
                  Manage active plan tier, view expiration date, and renew or upgrade plan
                </span>
              </div>
            </div>
            <span style={{ fontSize: '0.78rem', fontWeight: 800, background: 'rgba(0,0,0,0.3)', padding: '4px 10px', borderRadius: '50px' }}>
              {openSettingsSections.billing ? '▲ Collapse' : '▼ Tap to Expand'}
            </span>
          </div>

          {openSettingsSections.billing && (
            <div style={{
              background: '#FFFFFF', border: '1.5px solid #DFBA67', borderTop: 'none',
              borderRadius: '0 0 16px 16px', padding: '20px', marginBottom: '14px'
            }}>
              <div style={{ background: '#F8FAFC', borderRadius: '16px', padding: '18px', border: '1px solid #E2E8F0', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748B', display: 'block' }}>CURRENT ACTIVE PLAN:</span>
                    <strong style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0F172A' }}>
                      {(restaurantInfo?.plan_tier || 'pro').toUpperCase()} PLAN
                    </strong>
                  </div>
                  <span style={{ background: '#DCFCE7', color: '#15803D', border: '1px solid #86EFAC', padding: '4px 12px', borderRadius: '50px', fontSize: '0.76rem', fontWeight: 900 }}>
                    🟢 ACTIVE
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.82rem', borderTop: '1px solid #E2E8F0', paddingTop: '12px' }}>
                  <div>
                    <span style={{ color: '#64748B', display: 'block', fontSize: '0.72rem', fontWeight: 700 }}>PLAN EXPIRY / TRIAL ENDS:</span>
                    <strong style={{ color: '#0F172A' }}>{restaurantInfo?.trial_ends_at || restaurantInfo?.plan_expires_at || '14-Day Free Trial'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748B', display: 'block', fontSize: '0.72rem', fontWeight: 700 }}>MONTHLY AUTOPAY RATE:</span>
                    <strong style={{ color: '#059669' }}>
                      ₹{restaurantInfo?.plan_price || (restaurantInfo?.plan_tier === 'enterprise' ? 1999 : restaurantInfo?.plan_tier === 'basic' ? 499 : 999)} / month
                    </strong>
                  </div>
                </div>

                <div style={{ marginTop: '12px', background: '#FFFBEB', border: '1px solid #FDE68A', padding: '10px 14px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.76rem', color: '#B45309', fontWeight: 800 }}>
                    ⚡ RECURRING AUTOPAY: <span style={{ color: restaurantInfo?.mandate_status === 'cancelled' ? '#DC2626' : '#059669' }}>{restaurantInfo?.mandate_status === 'cancelled' ? '🔴 CANCELLED' : '🟢 ACTIVE (UPI Autopay Authorized)'}</span>
                  </div>
                  {restaurantInfo?.mandate_status !== 'cancelled' && (
                    <button
                      onClick={async () => {
                        if (window.confirm('Are you sure you want to cancel your automatic UPI Autopay recurring subscription?')) {
                          try {
                            const res = await fetch('/api/payment/cancel-mandate', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                              body: JSON.stringify({ restaurant_id: restaurantInfo?.id || 1 })
                            });
                            const data = await res.json();
                            alert(data.message || 'Autopay Cancelled');
                            loadData();
                          } catch {
                            alert('Failed to cancel Autopay mandate');
                          }
                        }
                      }}
                      style={{ background: '#FEE2E2', color: '#B91C1C', border: '1px solid #FCA5A5', padding: '4px 10px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 900, cursor: 'pointer' }}
                    >
                      🛑 Cancel Autopay
                    </button>
                  )}
                </div>
              </div>

              <button
                onClick={() => setShowPaymentModal(true)}
                style={{
                  width: '100%', padding: '14px', borderRadius: '14px', border: 'none',
                  background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', color: '#FFFFFF',
                  fontWeight: 900, fontSize: '0.95rem', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  boxShadow: '0 4px 16px rgba(16,185,129,0.35)'
                }}
              >
                <CreditCard size={18} />
                <span>💳 Upgrade or Renew Subscription Now</span>
              </button>
            </div>
          )}

          {/* Accordion 4: Change Admin Credentials */}
          <div 
            onClick={() => toggleSettingsSection('security')}
            style={{
              background: 'linear-gradient(135deg, #92400E 0%, #D97706 100%)',
              color: '#FFFFFF',
              borderRadius: openSettingsSections.security ? '16px 16px 0 0' : '16px',
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              justify: 'space-between',
              cursor: 'pointer',
              marginBottom: openSettingsSections.security ? 0 : '14px',
              boxShadow: '0 4px 14px rgba(217,119,6,0.25)',
              border: '1.5px solid #FDE68A'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px' }}>🔐</span>
              <h3 style={{ fontSize: '0.98rem', fontWeight: 900, color: '#FFFFFF', margin: 0 }}>
                3. Change Admin Username & Password
              </h3>
            </div>
            <span style={{ fontSize: '0.8rem', color: '#FFFFFF', fontWeight: 900 }}>
              {openSettingsSections.security ? '▲ Collapse' : '▼ Tap to Expand'}
            </span>
          </div>

          {openSettingsSections.security && (
            <div style={{
              background: '#FFFFFF',
              borderRadius: '0 0 16px 16px',
              padding: '24px',
              border: '1.5px solid var(--border-light)',
              borderTop: 'none',
              marginBottom: '16px'
            }}>
              <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: 1.5 }}>
                Change your admin username and/or password. You must enter your current password to verify.
              </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#D97706', marginBottom: '6px' }}>
                Current Password: *
              </label>
              <input
                type="password"
                value={credForm.currentPassword}
                onChange={(e) => setCredForm({ ...credForm, currentPassword: e.target.value })}
                placeholder="Enter your current password"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1.5px solid var(--border-light)',
                  fontSize: '0.9rem',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#D97706', marginBottom: '6px' }}>
                  New Username:
                </label>
                <input
                  type="text"
                  value={credForm.newUsername}
                  onChange={(e) => setCredForm({ ...credForm, newUsername: e.target.value })}
                  placeholder="Leave blank to keep current"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1.5px solid var(--border-light)',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#D97706', marginBottom: '6px' }}>
                  New Password:
                </label>
                <input
                  type="password"
                  value={credForm.newPassword}
                  onChange={(e) => setCredForm({ ...credForm, newPassword: e.target.value })}
                  placeholder="Leave blank to keep current"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1.5px solid var(--border-light)',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            {credForm.newPassword && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#D97706', marginBottom: '6px' }}>
                  Confirm New Password:
                </label>
                <input
                  type="password"
                  value={credForm.confirmPassword}
                  onChange={(e) => setCredForm({ ...credForm, confirmPassword: e.target.value })}
                  placeholder="Re-enter new password"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1.5px solid var(--border-light)',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                />
              </div>
            )}

            <button
              onClick={handleChangeCredentials}
              style={{
                background: '#D97706',
                color: '#FFFFFF',
                padding: '10px 24px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '0.88rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer'
              }}
            >
              <Lock size={16} /> Update Credentials
            </button>

            {credMsg.text && (
              <span style={{
                marginLeft: '12px',
                color: credMsg.type === 'success' ? '#15803D' : '#DC2626',
                fontSize: '0.84rem',
                fontWeight: 700
              }}>
                {credMsg.text}
              </span>
            )}
          </div>
          )}
          </>
        )}

      </div>

      {/* Dish & Category Form Modals */}
      {dishModalData && (
        <DishFormModal
          dish={dishModalData === 'new' ? null : dishModalData}
          categories={categories}
          token={token}
          onSave={loadData}
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
                  KhanaMaster Owner Guide & Help Center
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
          planPrice={restaurantInfo?.plan_tier === 'enterprise' ? 1999 : restaurantInfo?.plan_tier === 'basic' ? 499 : 999}
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
    </div>
  );
}
