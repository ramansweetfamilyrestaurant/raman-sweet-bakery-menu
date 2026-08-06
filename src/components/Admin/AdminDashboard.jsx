import React, { useState, useEffect } from 'react';
import { fetchCategories, fetchDishes, toggleDishAvailability, toggleCategoryActive, deleteDish, deleteCategory, fetchRestaurantInfo, updateDishPrice, fetchAnnouncements, fetchAdminOrders, updateOrderStatus } from '../../api/client';
import DishFormModal from './DishFormModal';
import CategoryFormModal from './CategoryFormModal';
import { Plus, Edit, Trash2, Eye, EyeOff, LogOut, ArrowLeft, Layers, Utensils, QrCode, Printer, Settings, Star, CheckCircle, Lock, ExternalLink, Megaphone, MessageSquare, Palette, Sparkles, Clock, CheckCircle2, XCircle } from 'lucide-react';

export default function AdminDashboard({ token, username, onLogout, onReturnToMenu }) {
  const [activeTab, setActiveTab] = useState('dishes'); // 'dishes', 'categories', 'qr-generator', 'settings'
  const [categories, setCategories] = useState([]);
  const [dishes, setDishes] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCatFilter, setSelectedCatFilter] = useState('all');
  const [editingPriceId, setEditingPriceId] = useState(null);
  const [quickPriceVal, setQuickPriceVal] = useState({ price: '', price_half: '' });

  // QR Code Generator State
  const [tableNumber, setTableNumber] = useState('1');
  const [qrGenerated, setQrGenerated] = useState(false);

  // Live Orders (KOT) State
  const [orders, setOrders] = useState([]);
  const [prevPendingCount, setPrevPendingCount] = useState(0);
  const [restaurantInfo, setRestaurantInfo] = useState(null);

  const playKitchenChime = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, ctx.currentTime);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1320, ctx.currentTime);

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 0.8);
      osc2.stop(ctx.currentTime + 0.8);
    } catch (e) {
      console.warn('Audio Context chime error:', e);
    }
  };

  const loadOrders = async () => {
    try {
      const data = await fetchAdminOrders(token);
      const safeData = Array.isArray(data) ? data : [];
      const pendingCount = safeData.filter(o => o.status === 'pending').length;
      if (pendingCount > prevPendingCount) {
        playKitchenChime();
      }
      setPrevPendingCount(pendingCount);
      setOrders(safeData);
    } catch (err) {
      console.error('Failed to load orders:', err);
    }
  };

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      await updateOrderStatus(orderId, newStatus, token);
      setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    } catch (err) {
      alert(err.message || 'Failed to update order status');
    }
  };

  const handlePrintKOT = (order) => {
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) return;
    let itemsHtml = '';
    (order.items || []).forEach(i => {
      itemsHtml += `
        <tr>
          <td style="padding:6px 0;font-weight:bold;">${i.quantity}x ${i.name}</td>
          <td style="text-align:right;">₹${i.price * i.quantity}</td>
        </tr>
      `;
    });
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>KOT Ticket - Table ${order.table_number}</title>
          <style>
            body { font-family: monospace; padding: 20px; width: 280px; margin: 0 auto; background: #FFF; }
            h2 { text-align: center; margin: 0 0 4px 0; font-size: 18px; }
            .meta { border-bottom: 1px dashed #000; padding-bottom: 8px; margin-bottom: 10px; font-size: 13px; }
            table { width: 100%; font-size: 14px; border-collapse: collapse; }
            .total { border-top: 1px dashed #000; margin-top: 10px; padding-top: 8px; font-weight: bold; font-size: 16px; display: flex; justify-content: space-between; }
          </style>
        </head>
        <body>
          <h2>*** KITCHEN TICKET (KOT) ***</h2>
          <div class="meta">
            <div><strong>TABLE #${order.table_number || '1'}</strong></div>
            <div>Order ID: #${order.id}</div>
            <div>Guest: ${order.customer_name || 'Dine-In Customer'}</div>
            <div>Time: ${new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
          <table>
            ${itemsHtml}
          </table>
          <div class="total">
            <span>TOTAL:</span>
            <span>₹${order.total_amount}</span>
          </div>
          <script>window.onload = function() { window.print(); };</script>
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

  const loadData = async () => {
    setLoading(true);
    try {
      const [catData, dishData, infoData] = await Promise.all([
        fetchCategories({ adminView: true, token }),
        fetchDishes({ adminView: true, token }),
        fetchRestaurantInfo(token)
      ]);
      setCategories(Array.isArray(catData) ? catData : []);
      setDishes(Array.isArray(dishData) ? dishData : []);
      setRestaurantInfo(infoData);
      if (infoData) {
        const defaultVis = { must_try: true, combo: true, special: true, under100: true };
        setSettingsForm({
          name: infoData.name || '',
          tagline: infoData.tagline || '',
          phone: infoData.phone || '',
          address: infoData.address || '',
          openingHours: infoData.openingHours || '',
          google_review_url: infoData.google_review_url || '',
          google_maps_url: infoData.google_maps_url || '',
          currency_symbol: (infoData.currency_symbol !== null && infoData.currency_symbol !== undefined) ? infoData.currency_symbol : '₹',
          fssai_lic_no: infoData.fssai_lic_no || '',
          resto_type: infoData.resto_type || 'pure_veg',
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

  const handlePrintQR = () => {
    const liveOrigin = window.location.origin;
    const targetUrl = `${liveOrigin}/?table=${tableNumber || '1'}`;
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
          <img
            src={settingsForm.logo || '/uploads/logo.jpg'}
            alt="Logo"
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              border: '1.5px solid #D4AF37',
              objectFit: 'cover',
              flexShrink: 0
            }}
          />
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
      {announcements.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)',
          color: '#E0E7FF',
          padding: '10px 16px',
          fontSize: '0.82rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          borderBottom: '1px solid #6366F1'
        }}>
          <Megaphone size={16} color="#FBBF24" />
          <span><strong>Notice from SaaS Master:</strong> {announcements[0].message}</span>
        </div>
      )}

      {/* Sleek Royal Gold Segmented Navigation Bar */}
      <div style={{
        background: 'linear-gradient(180deg, #0A2315 0%, #081D10 100%)',
        padding: '8px 12px',
        borderBottom: '2px solid #D4AF37',
        position: 'sticky',
        top: '52px',
        zIndex: 99,
        boxShadow: '0 6px 20px rgba(0,0,0,0.25)'
      }}>
        <div style={{
          maxWidth: '800px',
          margin: '0 auto',
          background: 'rgba(0, 0, 0, 0.35)',
          padding: '4px',
          borderRadius: 'var(--radius-pill)',
          border: '1px solid rgba(212, 175, 55, 0.35)',
          display: 'flex',
          gap: '4px',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          {[
            ...(restaurantInfo && (restaurantInfo.direct_ordering_enabled === false || restaurantInfo.direct_ordering_enabled === 0) ? [] : [{ id: 'orders', label: '🔔 KOT Orders', count: orders.filter(o => o.status === 'pending').length, icon: <Sparkles size={14} /> }]),
            { id: 'dishes', label: 'Dishes', count: safeDishes.length, icon: <Utensils size={14} /> },
            { id: 'categories', label: 'Cat', count: safeCategories.length, icon: <Layers size={14} /> },
            { id: 'qr-generator', label: 'QR Code', icon: <QrCode size={14} /> },
            { id: 'settings', label: 'Settings', icon: <Settings size={14} /> }
          ].map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1,
                  padding: '7px 4px',
                  borderRadius: 'var(--radius-pill)',
                  fontWeight: isActive ? 900 : 700,
                  fontSize: '0.74rem',
                  background: isActive ? 'linear-gradient(135deg, #FFD700 0%, #D4AF37 100%)' : 'transparent',
                  color: isActive ? '#0A2315' : 'rgba(255, 255, 255, 0.85)',
                  border: isActive ? '1px solid #FFFFFF' : '1px solid transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  boxShadow: isActive ? '0 4px 14px rgba(255, 215, 0, 0.45)' : 'none',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              >
                {tab.icon}
                <span>
                  {tab.label} {tab.count !== undefined ? `(${tab.count})` : ''}
                </span>
              </button>
            );
          })}
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
                  Auto-refreshes every 5 seconds • Real-time table orders from customers
                </span>
              </div>
              <button
                onClick={loadOrders}
                style={{
                  background: 'var(--gold-primary)',
                  color: '#0A2315',
                  border: 'none',
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-pill)',
                  fontWeight: 900,
                  fontSize: '0.78rem',
                  cursor: 'pointer'
                }}
              >
                🔄 Refresh Now
              </button>
            </div>

            {orders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px 20px', background: '#FFFFFF', borderRadius: '16px', border: '1px solid var(--border-light)' }}>
                <Clock size={44} color="#9CA3AF" style={{ marginBottom: '12px' }} />
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-dark)', margin: '0 0 4px 0' }}>No Orders Received Yet</h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>When customers place a table order from their phone, it will pop up here live!</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px' }}>
                {orders.map((o) => {
                  const statusColors = {
                    pending: { bg: '#FEF3C7', text: '#92400E', border: '#FCD34D', label: 'Pending 🟡' },
                    preparing: { bg: '#DBEAFE', text: '#1E40AF', border: '#93C5FD', label: 'Preparing 👨‍🍳' },
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

                        {/* Customer details & Time */}
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                          <span>Order #{o.id} • {o.customer_name || 'Guest'}</span>
                          <span>{new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>

                        {/* Items List */}
                        <div style={{ background: '#F9FAFB', borderRadius: '12px', padding: '10px 12px', border: '1px solid #E5E7EB', marginBottom: '10px' }}>
                          {Array.isArray(o.items) && o.items.map((item, iIdx) => (
                            <div key={iIdx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem', fontWeight: 700, color: '#1F2937', padding: '3px 0' }}>
                              <span>{item.quantity}x {item.name}</span>
                              <span style={{ color: 'var(--primary-emerald)' }}>₹{item.price * item.quantity}</span>
                            </div>
                          ))}
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
                        <img src={dish.image || '/uploads/logo.jpg'} alt="" style={{ width: '42px', height: '42px', borderRadius: 'var(--radius-sm)', objectFit: 'cover', flexShrink: 0 }} />
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
                            padding: '4px 9px',
                            borderRadius: 'var(--radius-pill)',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            background: dish.available !== false ? '#DCFCE7' : '#FEE2E2',
                            color: dish.available !== false ? '#15803D' : '#DC2626',
                            border: dish.available !== false ? '1px solid #86EFAC' : '1px solid #FCA5A5'
                          }}
                        >
                          {dish.available !== false ? '● Active' : '● Hidden'}
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

                      {/* 🍱 Combo Toggle */}
                      <button
                        onClick={() => handleToggleBadge(dish, 'Combo')}
                        style={{
                          padding: '4px 8px',
                          borderRadius: 'var(--radius-pill)',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          background: dish.badge === 'Combo' ? '#DBEAFE' : '#FFFFFF',
                          color: dish.badge === 'Combo' ? '#1D4ED8' : '#4B5563',
                          border: dish.badge === 'Combo' ? '1px solid #3B82F6' : '1px solid #E5E7EB',
                          whiteSpace: 'nowrap',
                          cursor: 'pointer'
                        }}
                      >
                        🍱 Combo
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
                    <img src={cat.image || '/uploads/logo.jpg'} alt="" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
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

        {/* TAB 3: TABLE QR GENERATOR */}
        {activeTab === 'qr-generator' && (
          <div style={{
            background: '#FFFFFF',
            borderRadius: 'var(--radius-md)',
            padding: '24px',
            border: '1px solid var(--border-light)',
            boxShadow: 'var(--shadow-sm)',
            textAlign: 'center'
          }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary-emerald)', marginBottom: '8px' }}>
              Table QR Code Printable Sticker Generator
            </h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Enter table number to generate a printable QR sticker for your restaurant dining tables.
            </p>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', maxWidth: '300px', margin: '0 auto 20px' }}>
              <input
                type="text"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                placeholder="Table Number (e.g. 5)"
                style={{
                  padding: '10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-light)',
                  fontSize: '0.9rem',
                  width: '100%'
                }}
              />
              <button
                onClick={() => setQrGenerated(true)}
                style={{
                  background: 'var(--primary-emerald)',
                  color: '#FFFFFF',
                  padding: '10px 18px',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  whiteSpace: 'nowrap'
                }}
              >
                Generate QR
              </button>
            </div>

            {/* Generated QR Display Card */}
            <div style={{
              maxWidth: '320px',
              margin: '0 auto',
              padding: '24px',
              border: '2px double #D4AF37',
              borderRadius: 'var(--radius-md)',
              background: '#FAFAFA'
            }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: '#0A2315',
                color: '#D4AF37',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px',
                border: '2px solid #D4AF37',
                fontWeight: 800,
                fontSize: '1.2rem'
              }}>
                T-{tableNumber || '1'}
              </div>

              <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--primary-emerald)' }}>
                {settingsForm.name || 'Digital Menu'}
              </h4>
              <p style={{ fontSize: '0.74rem', color: '#D4AF37', fontWeight: 700, marginBottom: '14px', margin: 0 }}>
                {settingsForm.tagline || 'Scan for Digital Menu'}
              </p>

              {/* QR Image Graphic */}
              <div style={{
                background: '#FFFFFF',
                padding: '16px',
                borderRadius: 'var(--radius-sm)',
                display: 'inline-block',
                border: '1px solid var(--border-light)',
                marginBottom: '14px',
                marginTop: '8px'
              }}>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(window.location.origin + '/?table=' + (tableNumber || '1'))}`}
                  alt={`Table ${tableNumber || '1'} QR Code`}
                  style={{ width: '160px', height: '160px', display: 'block' }}
                />
              </div>

              <p style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--primary-emerald)' }}>
                SCAN TO VIEW DIGITAL MENU (TABLE {tableNumber || '1'})
              </p>

              <button
                onClick={handlePrintQR}
                style={{
                  marginTop: '16px',
                  background: 'var(--primary-emerald)',
                  color: '#FFFFFF',
                  padding: '10px 22px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: 'var(--shadow-gold)',
                  cursor: 'pointer'
                }}
              >
                <Printer size={16} /> Print Table Standee Sticker
              </button>
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
            </div>

            {settingsSavedMsg && (
              <p style={{ marginTop: '14px', color: '#15803D', fontSize: '0.84rem', fontWeight: 700 }}>
                ✓ Google Review Link saved successfully!
              </p>
            )}

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
          <div style={{
            background: '#FFFFFF',
            borderRadius: 'var(--radius-md)',
            padding: '24px',
            border: '1px solid var(--border-light)',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Settings size={22} color="var(--primary-emerald)" />
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary-emerald)' }}>
                Restaurant Details & Settings
              </h3>
            </div>
            
            <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: 1.5 }}>
              Update your restaurant contact number, address, opening hours, name, and Google review link below. These details will automatically update across your digital menu header, info modal, and footer.
            </p>

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
                  placeholder="https://share.google/2M5mFMPlmS6pAXRf7"
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
                  { key: 'combo', label: '🍱 Combo Button' },
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

          {/* Change Login Credentials Section */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: 'var(--radius-md)',
            padding: '24px',
            border: '1px solid var(--border-light)',
            boxShadow: 'var(--shadow-sm)',
            marginTop: '20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Lock size={22} color="#D97706" />
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#D97706' }}>
                🔐 Change Login Credentials
              </h3>
            </div>

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
          </>
        )}
      </div>

      {/* Dish Form Modal */}
      {dishModalData && (
        <DishFormModal
          dish={dishModalData === 'new' ? null : dishModalData}
          categories={categories}
          token={token}
          onSave={handleSaveDish}
          onClose={() => setDishModalData(null)}
        />
      )}

      {/* Category Form Modal */}
      {catModalData && (
        <CategoryFormModal
          category={catModalData === 'new' ? null : catModalData}
          token={token}
          onSave={handleSaveCategory}
          onClose={() => setCatModalData(null)}
        />
      )}
    </div>
  );
}
