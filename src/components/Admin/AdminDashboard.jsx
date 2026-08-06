import { fetchCategories, fetchDishes, toggleDishAvailability, deleteDish, deleteCategory, fetchRestaurantInfo, updateDishPrice } from '../../api/client';
import DishFormModal from './DishFormModal';
import CategoryFormModal from './CategoryFormModal';
import { Plus, Edit, Trash2, Eye, EyeOff, LogOut, ArrowLeft, Layers, Utensils, QrCode, Printer, Settings, Star, CheckCircle, Lock, ExternalLink } from 'lucide-react';

export default function AdminDashboard({ token, username, onLogout, onReturnToMenu }) {
  const [activeTab, setActiveTab] = useState('dishes'); // 'dishes', 'categories', 'qr-generator', 'settings'
  const [categories, setCategories] = useState([]);
  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCatFilter, setSelectedCatFilter] = useState('all');
  const [editingPriceId, setEditingPriceId] = useState(null);
  const [quickPriceVal, setQuickPriceVal] = useState({ price: '', price_half: '' });

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
    google_review_url: '',
    google_maps_url: ''
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
          google_review_url: infoData.google_review_url || '',
          google_maps_url: infoData.google_maps_url || ''
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

  const handleToggleMustTry = async (dish) => {
    const isMustTry = dish.badge === 'Must Try';
    const newBadge = isMustTry ? '' : 'Must Try';
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
      alert('Failed to update Must Try status');
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

  const filteredDishes = dishes.filter(d => {
    const matchesSearch = d.name.toLowerCase().includes(search.toLowerCase()) || 
      (d.name_hi && d.name_hi.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = selectedCatFilter === 'all' || String(d.category_id) === String(selectedCatFilter);
    return matchesSearch && matchesCategory;
  });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-mobile-app)', paddingBottom: '60px' }}>
      {/* Top Header */}
      <header style={{
        background: 'var(--primary-emerald)',
        color: '#FFFFFF',
        padding: '12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '2px solid #D4AF37',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button 
            onClick={onReturnToMenu}
            style={{ color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}
          >
            <ArrowLeft size={14} /> Menu
          </button>
          <span style={{ opacity: 0.4 }}>|</span>
          <h2 style={{ fontSize: '0.95rem', fontWeight: 800 }}>Manager</h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.72rem', color: '#D4AF37', fontWeight: 700 }}>{username}</span>
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
      <div style={{ maxWidth: '800px', margin: '16px auto', padding: '0 10px' }}>
        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveTab('dishes')}
            style={{
              flex: 1,
              minWidth: '70px',
              padding: '8px 4px',
              borderRadius: 'var(--radius-md)',
              fontWeight: 700,
              fontSize: '0.72rem',
              background: activeTab === 'dishes' ? 'var(--primary-emerald)' : '#FFFFFF',
              color: activeTab === 'dishes' ? '#FFFFFF' : 'var(--text-dark)',
              border: '1px solid var(--border-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }}
          >
            <Utensils size={15} /> Dishes ({dishes.length})
          </button>

          <button
            onClick={() => setActiveTab('categories')}
            style={{
              flex: 1,
              minWidth: '70px',
              padding: '8px 4px',
              borderRadius: 'var(--radius-md)',
              fontWeight: 700,
              fontSize: '0.72rem',
              background: activeTab === 'categories' ? 'var(--primary-emerald)' : '#FFFFFF',
              color: activeTab === 'categories' ? '#FFFFFF' : 'var(--text-dark)',
              border: '1px solid var(--border-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }}
          >
            <Layers size={13} /> Cat
          </button>

          <button
            onClick={() => setActiveTab('qr-generator')}
            style={{
              flex: 1,
              minWidth: '70px',
              padding: '8px 4px',
              borderRadius: 'var(--radius-md)',
              fontWeight: 700,
              fontSize: '0.72rem',
              background: activeTab === 'qr-generator' ? 'var(--primary-emerald)' : '#FFFFFF',
              color: activeTab === 'qr-generator' ? '#FFFFFF' : 'var(--text-dark)',
              border: '1px solid var(--border-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }}
          >
            <QrCode size={13} /> QR
          </button>

          <button
            onClick={() => setActiveTab('review')}
            style={{
              flex: 1,
              minWidth: '70px',
              padding: '8px 4px',
              borderRadius: 'var(--radius-md)',
              fontWeight: 700,
              fontSize: '0.72rem',
              background: activeTab === 'review' ? 'var(--primary-emerald)' : '#FFFFFF',
              color: activeTab === 'review' ? '#FFFFFF' : 'var(--text-dark)',
              border: '1px solid var(--border-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }}
          >
            <Star size={13} color="#D4AF37" fill="#D4AF37" /> Review
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            style={{
              flex: 1,
              minWidth: '70px',
              padding: '8px 4px',
              borderRadius: 'var(--radius-md)',
              fontWeight: 700,
              fontSize: '0.72rem',
              background: activeTab === 'settings' ? 'var(--primary-emerald)' : '#FFFFFF',
              color: activeTab === 'settings' ? '#FFFFFF' : 'var(--text-dark)',
              border: '1px solid var(--border-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }}
          >
            <Settings size={13} /> Settings
          </button>
        </div>

        {/* TAB 1: DISHES */}
        {activeTab === 'dishes' && (
          <div>
            {/* Category Dropdown Filter & Search Bar */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="🔍 Search dish by name..."
                style={{
                  flex: 1,
                  minWidth: '150px',
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-pill)',
                  border: '1px solid var(--border-light)',
                  fontSize: '0.85rem'
                }}
              />

              <select
                value={selectedCatFilter}
                onChange={(e) => setSelectedCatFilter(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-pill)',
                  border: '1.5px solid #D4AF37',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  background: '#0A2315',
                  color: '#FFFFFF',
                  cursor: 'pointer'
                }}
              >
                <option value="all">📁 All Categories ({dishes.length})</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({dishes.filter(d => Number(d.category_id) === Number(c.id)).length})
                  </option>
                ))}
              </select>

              <button
                onClick={() => setDishModalData('new')}
                style={{
                  background: 'linear-gradient(135deg, #0A2315 0%, #164E2A 100%)',
                  color: '#FFFFFF',
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  border: '1px solid #D4AF37'
                }}
              >
                <Plus size={16} /> Add New Dish
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
                    gap: '8px'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      flexWrap: 'wrap'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexGrow: 1, minWidth: 0, overflow: 'hidden' }}>
                        <img src={dish.image || '/uploads/logo.jpg'} alt="" style={{ width: '38px', height: '38px', borderRadius: 'var(--radius-sm)', objectFit: 'cover', flexShrink: 0 }} />
                        <div style={{ minWidth: 0 }}>
                          <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary-emerald)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{dish.name}</h4>
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                            {dish.category_name || 'Category'} • {dish.price_half ? `Half ₹${Math.round(dish.price_half)} | Full ₹${Math.round(dish.price)}` : `₹${Math.round(dish.price)}`}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0, flexWrap: 'wrap' }}>
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
                            padding: '4px 8px',
                            borderRadius: 'var(--radius-pill)',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            background: isEditingThisPrice ? '#FEF3C7' : '#F3F4F6',
                            color: isEditingThisPrice ? '#D97706' : '#1F2937',
                            border: '1px solid #D1D5DB'
                          }}
                        >
                          ⚡ Quick Price
                        </button>

                        <button
                          onClick={() => handleToggleMustTry(dish)}
                          title={dish.badge === 'Must Try' ? 'Remove Must Try' : 'Mark as Must Try'}
                          style={{
                            padding: '4px 8px',
                            borderRadius: 'var(--radius-pill)',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            background: dish.badge === 'Must Try' ? '#FEF3C7' : '#F3F4F6',
                            color: dish.badge === 'Must Try' ? '#D97706' : '#4B5563',
                            border: dish.badge === 'Must Try' ? '1px solid #F59E0B' : '1px solid #D1D5DB',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                        >
                          <Star size={11} fill={dish.badge === 'Must Try' ? '#D97706' : 'none'} color={dish.badge === 'Must Try' ? '#D97706' : '#4B5563'} />
                          {dish.badge === 'Must Try' ? 'Must Try' : '+ Must Try'}
                        </button>

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

                        <button onClick={() => setDishModalData(dish)} style={{ color: 'var(--primary-emerald)', padding: '4px' }} title="Full Edit">
                          <Edit size={16} />
                        </button>

                        <button onClick={() => handleDeleteDish(dish.id)} style={{ color: '#EF4444', padding: '4px' }} title="Delete Dish">
                          <Trash2 size={16} />
                        </button>
                      </div>
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
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#78350F' }}>Full ₹</label>
                          <input
                            type="number"
                            value={quickPriceVal.price}
                            onChange={(e) => setQuickPriceVal({ ...quickPriceVal, price: e.target.value })}
                            style={{ width: '60px', padding: '3px 6px', borderRadius: '4px', border: '1px solid #F59E0B', fontSize: '0.8rem', fontWeight: 700 }}
                          />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#78350F' }}>Half ₹</label>
                          <input
                            type="number"
                            value={quickPriceVal.price_half}
                            onChange={(e) => setQuickPriceVal({ ...quickPriceVal, price_half: e.target.value })}
                            placeholder="Optional"
                            style={{ width: '60px', padding: '3px 6px', borderRadius: '4px', border: '1px solid #F59E0B', fontSize: '0.8rem', fontWeight: 700 }}
                          />
                        </div>

                        <button
                          onClick={() => handleSaveQuickPrice(dish.id)}
                          style={{
                            background: '#D97706',
                            color: '#FFFFFF',
                            padding: '3px 12px',
                            borderRadius: 'var(--radius-pill)',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            border: 'none'
                          }}
                        >
                          ✓ Save Price
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
                justifyContent: 'center',
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
