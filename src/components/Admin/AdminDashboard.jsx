import React, { useState, useEffect } from 'react';
import { fetchCategories, fetchDishes, toggleDishAvailability, deleteDish, deleteCategory, fetchRestaurantInfo } from '../../api/client';
import DishFormModal from './DishFormModal';
import CategoryFormModal from './CategoryFormModal';
import { Plus, Edit, Trash2, Eye, EyeOff, LogOut, ArrowLeft, Layers, Utensils, QrCode, Printer, Settings, Star, CheckCircle, Lock } from 'lucide-react';

export default function AdminDashboard({ token, username, onLogout, onReturnToMenu }) {
  const [activeTab, setActiveTab] = useState('dishes'); // 'dishes', 'categories', 'qr-generator', 'settings'
  const [categories, setCategories] = useState([]);
  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // QR Code Generator State
  const [tableNumber, setTableNumber] = useState('1');
  const [qrGenerated, setQrGenerated] = useState(false);

  // Settings State
  const [settingsForm, setSettingsForm] = useState({
    name: '',
    tagline: '',
    phone: '',
    address: '',
    openingHours: '',
    google_review_url: ''
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
        fetchCategories(),
        fetchDishes({ adminView: true }),
        fetchRestaurantInfo()
      ]);
      setCategories(catData);
      setDishes(dishData);
      if (infoData) {
        setSettingsForm({
          name: infoData.name || 'Raman Sweet Bakery & Family Restaurant',
          tagline: infoData.tagline || '100% Pure Vegetarian',
          phone: infoData.phone || '+91 9708366583',
          address: infoData.address || 'HawaiAdda Chowk, Near katchari Gumti, Motihari, Bihar',
          openingHours: infoData.openingHours || '8:00 AM - 10:30 PM (Mon - Sun)',
          google_review_url: infoData.google_review_url || ''
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
  }, []);

  const handleToggleDish = async (id, currentVal) => {
    try {
      await toggleDishAvailability(id, !currentVal, token);
      setDishes(dishes.map(d => d.id === id ? { ...d, available: !currentVal } : d));
    } catch (err) {
      alert('Failed to update dish availability');
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

  const filteredDishes = dishes.filter(d => 
    d.name.toLowerCase().includes(search.toLowerCase()) || 
    (d.name_hi && d.name_hi.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-mobile-app)', paddingBottom: '60px' }}>
      {/* Top Header */}
      <header style={{
        background: 'var(--primary-emerald)',
        color: '#FFFFFF',
        padding: '16px 20px',
        display: 'flex',
        justify: 'space-between',
        alignItems: 'center',
        borderBottom: '2px solid #D4AF37'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button 
            onClick={onReturnToMenu}
            style={{ color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.82rem' }}
          >
            <ArrowLeft size={16} /> View Menu
          </button>
          <span style={{ opacity: 0.4 }}>|</span>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Manager Portal</h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '0.8rem', color: '#D4AF37', fontWeight: 700 }}>Manager: {username}</span>
          <button
            onClick={onLogout}
            style={{
              color: '#EF4444',
              background: '#FEE2E2',
              padding: '4px 10px',
              borderRadius: 'var(--radius-pill)',
              fontSize: '0.75rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <LogOut size={13} /> Logout
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div style={{ maxWidth: '800px', margin: '20px auto', padding: '0 16px' }}>
        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveTab('dishes')}
            style={{
              flex: 1,
              minWidth: '110px',
              padding: '10px 8px',
              borderRadius: 'var(--radius-md)',
              fontWeight: 700,
              fontSize: '0.82rem',
              background: activeTab === 'dishes' ? 'var(--primary-emerald)' : '#FFFFFF',
              color: activeTab === 'dishes' ? '#FFFFFF' : 'var(--text-dark)',
              border: '1px solid var(--border-light)',
              display: 'flex',
              alignItems: 'center',
              justify: 'center',
              gap: '4px'
            }}
          >
            <Utensils size={15} /> Dishes ({dishes.length})
          </button>

          <button
            onClick={() => setActiveTab('categories')}
            style={{
              flex: 1,
              minWidth: '110px',
              padding: '10px 8px',
              borderRadius: 'var(--radius-md)',
              fontWeight: 700,
              fontSize: '0.82rem',
              background: activeTab === 'categories' ? 'var(--primary-emerald)' : '#FFFFFF',
              color: activeTab === 'categories' ? '#FFFFFF' : 'var(--text-dark)',
              border: '1px solid var(--border-light)',
              display: 'flex',
              alignItems: 'center',
              justify: 'center',
              gap: '4px'
            }}
          >
            <Layers size={15} /> Categories ({categories.length})
          </button>

          <button
            onClick={() => setActiveTab('qr-generator')}
            style={{
              flex: 1,
              minWidth: '110px',
              padding: '10px 8px',
              borderRadius: 'var(--radius-md)',
              fontWeight: 700,
              fontSize: '0.82rem',
              background: activeTab === 'qr-generator' ? 'var(--primary-emerald)' : '#FFFFFF',
              color: activeTab === 'qr-generator' ? '#FFFFFF' : 'var(--text-dark)',
              border: '1px solid var(--border-light)',
              display: 'flex',
              alignItems: 'center',
              justify: 'center',
              gap: '4px'
            }}
          >
            <QrCode size={15} /> Table QR
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            style={{
              flex: 1,
              minWidth: '110px',
              padding: '10px 8px',
              borderRadius: 'var(--radius-md)',
              fontWeight: 700,
              fontSize: '0.82rem',
              background: activeTab === 'settings' ? 'var(--primary-emerald)' : '#FFFFFF',
              color: activeTab === 'settings' ? '#FFFFFF' : 'var(--text-dark)',
              border: '1px solid var(--border-light)',
              display: 'flex',
              alignItems: 'center',
              justify: 'center',
              gap: '4px'
            }}
          >
            <Star size={15} color="#D4AF37" /> Review Link
          </button>
        </div>

        {/* TAB 1: DISHES */}
        {activeTab === 'dishes' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', gap: '10px' }}>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter dishes by name..."
                style={{
                  flexGrow: 1,
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-pill)',
                  border: '1px solid var(--border-light)',
                  fontSize: '0.85rem'
                }}
              />

              <button
                onClick={() => setDishModalData('new')}
                style={{
                  background: 'var(--primary-emerald)',
                  color: '#FFFFFF',
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap'
                }}
              >
                <Plus size={16} /> Add New Dish
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredDishes.map((dish) => (
                <div key={dish.id} style={{
                  background: '#FFFFFF',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 16px',
                  border: '1px solid var(--border-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justify: 'space-between',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexGrow: 1, minWidth: 0 }}>
                    <img src={dish.image || '/uploads/logo.jpg'} alt="" style={{ width: '44px', height: '44px', borderRadius: 'var(--radius-sm)', objectFit: 'cover' }} />
                    <div style={{ minWidth: 0 }}>
                      <h4 style={{ fontSize: '0.94rem', fontWeight: 700, color: 'var(--primary-emerald)' }}>{dish.name}</h4>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        {dish.category_name || 'Category'} • {dish.price_half ? `Half ${dish.price_half} | Full ${dish.price}` : `${dish.price}`}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={() => handleToggleDish(dish.id, dish.available)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-pill)',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        background: dish.available !== false ? '#DCFCE7' : '#FEE2E2',
                        color: dish.available !== false ? '#15803D' : '#DC2626'
                      }}
                    >
                      {dish.available !== false ? '● Active' : '● Hidden'}
                    </button>

                    <button onClick={() => setDishModalData(dish)} style={{ color: 'var(--primary-emerald)', padding: '4px' }}>
                      <Edit size={16} />
                    </button>

                    <button onClick={() => handleDeleteDish(dish.id)} style={{ color: '#EF4444', padding: '4px' }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
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
                  justify: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img src={cat.image || '/uploads/logo.jpg'} alt="" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                    <div>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--primary-emerald)' }}>{cat.name}</h4>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{cat.name_hi || ''}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setCatModalData(cat)} style={{ color: 'var(--primary-emerald)', padding: '4px' }}>
                      <Edit size={16} />
                    </button>
                    <button onClick={() => handleDeleteCategory(cat.id)} style={{ color: '#EF4444', padding: '4px' }}>
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
                justify: 'center',
                margin: '0 auto 12px',
                border: '2px solid #D4AF37',
                fontWeight: 800,
                fontSize: '1.2rem'
              }}>
                T-{tableNumber || '1'}
              </div>

              <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--primary-emerald)' }}>
                Raman Sweet Bakery
              </h4>
              <p style={{ fontSize: '0.74rem', color: 'var(--veg-green)', fontWeight: 700, marginBottom: '14px' }}>
                100% PURE VEG RESTAURANT
              </p>

              {/* QR Image Graphic */}
              <div style={{
                background: '#FFFFFF',
                padding: '16px',
                borderRadius: 'var(--radius-sm)',
                display: 'inline-block',
                border: '1px solid var(--border-light)',
                marginBottom: '14px'
              }}>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=http://localhost:5000/?table=${tableNumber}`}
                  alt={`Table ${tableNumber} QR Code`}
                  style={{ width: '160px', height: '160px', display: 'block' }}
                />
              </div>

              <p style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--primary-emerald)' }}>
                SCAN TO VIEW DIGITAL MENU
              </p>

              <button
                onClick={() => window.print()}
                style={{
                  marginTop: '16px',
                  background: 'var(--primary-emerald)',
                  color: '#FFFFFF',
                  padding: '8px 20px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Printer size={15} /> Print Table Sticker
              </button>
            </div>
          </div>
        )}

        {/* TAB 4: RESTAURANT & REVIEW LINK SETTINGS */}
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary-emerald)', marginBottom: '6px' }}>
                  Restaurant Name:
                </label>
                <input
                  type="text"
                  value={settingsForm.name}
                  onChange={(e) => setSettingsForm({ ...settingsForm, name: e.target.value })}
                  placeholder="Raman Sweet Bakery & Family Restaurant"
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
                  placeholder="+91 9708366583"
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
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

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary-emerald)', marginBottom: '6px' }}>
                Google Maps Review Link:
              </label>
              <input
                type="url"
                value={settingsForm.google_review_url}
                onChange={(e) => setSettingsForm({ ...settingsForm, google_review_url: e.target.value })}
                placeholder="https://g.page/r/your-restaurant-name/review"
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
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
