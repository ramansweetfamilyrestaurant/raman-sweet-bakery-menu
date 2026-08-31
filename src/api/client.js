const API_BASE = '/api';

async function handleResponse(res, fallbackErrorMsg = 'API request failed') {
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error(`Server returned HTTP ${res.status}: ${text.substring(0, 120)}`);
  }
  if (!res.ok) {
    const err = new Error(data.message || data.error || fallbackErrorMsg);
    err.status = res.status;
    err.error = data.error || '';
    err.code = data.code || data.error || '';
    err.data = data;
    if (res.status === 401 || (res.status === 403 && (data.error === 'Invalid or expired token.' || (data.message && data.message.includes('expired token'))))) {
      err.isUnauthorized = true;
    }
    if (res.status === 403 && (data.error === 'SUBSCRIPTION_EXPIRED' || (data.message && data.message.includes('expired')))) {
      err.isSubscriptionExpired = true;
      err.code = 'SUBSCRIPTION_EXPIRED';
    }
    throw err;
  }
  return data;
}

export async function fetchRestaurantInfo(slugOrToken = '') {
  let url = `${API_BASE}/info`;
  const headers = {};

  if (typeof slugOrToken === 'string' && slugOrToken.length > 30) {
    headers.Authorization = `Bearer ${slugOrToken}`;
  } else if (typeof slugOrToken === 'string' && slugOrToken) {
    url += `?slug=${encodeURIComponent(slugOrToken)}`;
  } else if (typeof slugOrToken === 'object') {
    if (slugOrToken.token) headers.Authorization = `Bearer ${slugOrToken.token}`;
    if (slugOrToken.slug) url += `?slug=${encodeURIComponent(slugOrToken.slug)}`;
  }

  const res = await fetch(url, { headers, cache: 'no-store' });
  return handleResponse(res, 'Failed to fetch restaurant info');
}

export async function fetchCategories({ adminView = false, slug = '', token = '' } = {}) {
  const params = new URLSearchParams();
  if (adminView) params.append('admin_view', 'true');
  if (slug) params.append('slug', slug);

  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/categories?${params.toString()}`, { headers, cache: 'no-store' });
  return handleResponse(res, 'Failed to fetch categories');
}

export async function fetchDishes({ query = '', category_id = 'all', adminView = false, slug = '', token = '' } = {}) {
  const params = new URLSearchParams();
  if (query) params.append('q', query);
  if (category_id) params.append('category_id', category_id);
  if (adminView) params.append('admin_view', 'true');
  if (slug) params.append('slug', slug);

  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/dishes?${params.toString()}`, { headers, cache: 'no-store' });
  return handleResponse(res, 'Failed to fetch dishes');
}

// Super Admin API calls
export async function superAdminLogin(username, password) {
  const res = await fetch(`${API_BASE}/superadmin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return handleResponse(res, 'Super Admin login failed');
}

export async function fetchSuperAdminRestaurants(token) {
  const res = await fetch(`${API_BASE}/superadmin/restaurants`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(res, 'Failed to fetch tenant restaurants');
}

export async function createTenantRestaurant(restaurantData, token) {
  const res = await fetch(`${API_BASE}/superadmin/restaurants`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(restaurantData),
  });
  return handleResponse(res, 'Failed to create tenant restaurant');
}

export async function createSuperAdminBusinessCheckout(businessData, token) {
  const res = await fetch(`${API_BASE}/superadmin/checkout-business`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(businessData),
  });
  return handleResponse(res, 'Failed to initialize Cashfree business checkout');
}

export async function toggleTenantRestaurantActive(id, active, token) {
  const res = await fetch(`${API_BASE}/superadmin/restaurants/${id}/toggle`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ active }),
  });
  return handleResponse(res, 'Failed to update restaurant status');
}

export async function impersonateTenantRestaurant(id, token) {
  const res = await fetch(`${API_BASE}/superadmin/restaurants/${id}/impersonate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(res, 'Failed to log in as tenant owner');
}

export async function updateTenantRestaurant(id, data, token) {
  const res = await fetch(`${API_BASE}/superadmin/restaurants/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  return handleResponse(res, 'Failed to update tenant restaurant');
}

export async function deleteTenantRestaurant(id, token) {
  const res = await fetch(`${API_BASE}/superadmin/restaurants/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(res, 'Failed to delete tenant restaurant');
}

export async function grantFreeAccess(id, payload, token) {
  const res = await fetch(`${API_BASE}/superadmin/restaurants/${id}/grant-free-access`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  return handleResponse(res, 'Failed to grant free access');
}

export async function revokeFreeAccess(id, token) {
  const res = await fetch(`${API_BASE}/superadmin/restaurants/${id}/revoke-free-access`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(res, 'Failed to revoke free access');
}

export async function fetchPendingRegistrations(token) {
  const res = await fetch(`${API_BASE}/superadmin/pending-registrations`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(res, 'Failed to fetch pending registrations');
}

// Restaurant Admin API calls
export async function adminLogin(username, password, slug = '') {
  const res = await fetch(`${API_BASE}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, slug }),
  });
  return handleResponse(res, 'Login failed');
}

export async function fetchAdminStats(token) {
  const res = await fetch(`${API_BASE}/admin/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(res, 'Failed to fetch admin stats');
}

export async function updateTenantSettings(token, settingsData) {
  const res = await fetch(`${API_BASE}/admin/settings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(settingsData),
  });
  return handleResponse(res, 'Failed to update tenant settings');
}

// Helper: Compress image file on client-side before uploading (max 800px, 82% JPEG quality)
async function compressImageFile(file) {
  if (!file || !file.type || !file.type.startsWith('image/')) return file;
  
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 800;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob((blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            try {
              const compressedFile = new File([blob], (file.name || 'image').replace(/\.[^/.]+$/, "") + ".jpg", {
                type: 'image/jpeg',
                lastModified: Date.now()
              });
              resolve(compressedFile);
            } catch (fileErr) {
              resolve(blob);
            }
          }, 'image/jpeg', 0.82);
        } catch (err) {
          resolve(file);
        }
      };
      img.onerror = () => resolve(file);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

export async function uploadImage(file, tokenOrEntityType, entityTypeOrToken = 'dishes') {
  let token = tokenOrEntityType;
  let entityType = entityTypeOrToken;

  // Polymorphic argument handling if token & entityType are swapped
  if (typeof tokenOrEntityType === 'string' && !tokenOrEntityType.includes('.') && (typeof entityTypeOrToken === 'string' && entityTypeOrToken.includes('.'))) {
    entityType = tokenOrEntityType;
    token = entityTypeOrToken;
  }
  if (!entityType || typeof entityType !== 'string' || entityType.includes('.')) {
    entityType = 'dishes';
  }

  let processedFile = file;
  try {
    processedFile = await compressImageFile(file);
  } catch (err) {
    console.warn('Image compression notice, using original file:', err.message);
  }

  const formData = new FormData();
  const filename = file.name || 'image.jpg';
  formData.append('entityType', entityType);
  formData.append('image', processedFile, filename);

  const res = await fetch(`${API_BASE}/admin/upload?entityType=${encodeURIComponent(entityType)}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  const data = await handleResponse(res, 'Upload failed');
  return data.r2ProxyUrl || data.url;
}

export async function completeOnboarding(token) {
  const res = await fetch(`${API_BASE}/admin/onboarding/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
  });
  return handleResponse(res, 'Failed to complete onboarding');
}

export async function deleteImageApi(imageUrl, token) {
  if (!imageUrl) return;
  try {
    const res = await fetch(`${API_BASE}/admin/upload/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ imageUrl }),
    });
    return await handleResponse(res, 'Delete image failed');
  } catch (err) {
    console.warn('Notice deleting temporary image:', err.message);
  }
}

export async function createCategory(categoryData, token) {
  const res = await fetch(`${API_BASE}/admin/categories`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(categoryData),
  });
  return handleResponse(res, 'Failed to create category');
}

export async function updateCategory(id, categoryData, token) {
  const res = await fetch(`${API_BASE}/admin/categories/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(categoryData),
  });
  return handleResponse(res, 'Failed to update category');
}

export async function deleteCategory(id, token) {
  const res = await fetch(`${API_BASE}/admin/categories/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(res, 'Failed to delete category');
}

export async function toggleCategoryActive(id, active, token) {
  const res = await fetch(`${API_BASE}/admin/categories/${id}/toggle`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ active }),
  });
  return handleResponse(res, 'Failed to toggle category active status');
}

export async function createDish(dishData, token) {
  const res = await fetch(`${API_BASE}/admin/dishes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(dishData),
  });
  return handleResponse(res, 'Failed to create dish');
}

export async function updateDish(id, dishData, token) {
  const res = await fetch(`${API_BASE}/admin/dishes/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(dishData),
  });
  return handleResponse(res, 'Failed to update dish');
}

export async function toggleDishAvailability(id, available, token) {
  const res = await fetch(`${API_BASE}/admin/dishes/${id}/toggle`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ available }),
  });
  return handleResponse(res, 'Failed to toggle availability');
}

export async function updateDishPrice(id, price, price_half, token) {
  // Support both (id, price, token) legacy call and (id, price, price_half, token)
  let actualPriceHalf = price_half;
  let actualToken = token;
  if (typeof price_half === 'string' && !token) {
    actualToken = price_half;
    actualPriceHalf = null;
  }

  const res = await fetch(`${API_BASE}/admin/dishes/${id}/price`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${actualToken}`,
    },
    body: JSON.stringify({ price, price_half: actualPriceHalf }),
  });
  return handleResponse(res, 'Failed to update price');
}

export async function deleteDish(id, token) {
  const res = await fetch(`${API_BASE}/admin/dishes/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(res, 'Failed to delete dish');
}

export async function fetchAnnouncements() {
  const res = await fetch(`${API_BASE}/announcements`);
  return handleResponse(res, 'Failed to fetch announcements');
}

export async function fetchSuperAnnouncements(token) {
  const res = await fetch(`${API_BASE}/superadmin/announcements`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return handleResponse(res, 'Failed to fetch announcements');
}

export async function createAnnouncement(message, type, token) {
  const res = await fetch(`${API_BASE}/superadmin/announcements`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ message, type })
  });
  return handleResponse(res, 'Failed to create announcement');
}

export async function deleteAnnouncement(id, token) {
  const res = await fetch(`${API_BASE}/superadmin/announcements/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  return handleResponse(res, 'Failed to delete announcement');
}

export async function clearAllAnnouncements(token) {
  const res = await fetch(`${API_BASE}/superadmin/announcements`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  return handleResponse(res, 'Failed to clear all announcements');
}

export async function fetchSaaSPlans(token) {
  const res = await fetch(`${API_BASE}/superadmin/plans`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return handleResponse(res, 'Failed to fetch SaaS plans');
}

export async function createSaaSPlan(planData, token) {
  const res = await fetch(`${API_BASE}/superadmin/plans`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(planData)
  });
  return handleResponse(res, 'Failed to create SaaS plan');
}

export async function updateSaaSPlan(key, planData, token) {
  const res = await fetch(`${API_BASE}/superadmin/plans/${key}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(planData)
  });
  return handleResponse(res, 'Failed to update SaaS plan');
}

export async function deleteSaaSPlan(key, token) {
  const res = await fetch(`${API_BASE}/superadmin/plans/${key}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  return handleResponse(res, 'Failed to delete SaaS plan');
}

export async function fetchAuditLogs(token) {
  const res = await fetch(`${API_BASE}/superadmin/audit-logs`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return handleResponse(res, 'Failed to fetch audit logs');
}

export async function verifyCustomerLocationApi(payload) {
  const res = await fetch(`${API_BASE}/orders/verify-location`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse(res, 'Location verification failed');
}

export async function requestStaffPresenceVerification(payload) {
  const res = await fetch(`${API_BASE}/orders/presence/request-staff`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse(res, 'Failed to request staff verification');
}

export async function fetchPresenceStatus(verificationToken) {
  const res = await fetch(`${API_BASE}/orders/presence-status/${encodeURIComponent(verificationToken)}`, {
    cache: 'no-store'
  });
  return handleResponse(res, 'Failed to fetch verification status');
}

export async function fetchPresencePolicy(slug = '') {
  const url = slug ? `${API_BASE}/orders/presence-policy?slug=${encodeURIComponent(slug)}` : `${API_BASE}/orders/presence-policy`;
  const res = await fetch(url, { cache: 'no-store' });
  return handleResponse(res, 'Failed to fetch presence policy');
}

export async function createDirectOrder(orderData) {
  const res = await fetch(`${API_BASE}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderData),
  });
  return handleResponse(res, 'Failed to place order');
}

export async function fetchAdminOrders(token, scope = 'live') {
  const res = await fetch(`${API_BASE}/admin/orders?scope=${scope}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return handleResponse(res, 'Failed to fetch orders');
}

export async function updateOrderStatus(id, status, token, extraBody = {}) {
  const payload = typeof status === 'object' ? { ...status } : { status, ...extraBody };
  const res = await fetch(`${API_BASE}/admin/orders/${id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });
  return handleResponse(res, 'Failed to update order status');
}

export async function trackOrderStatus(id, slug = '') {
  const cleanSlug = slug ? String(slug).trim() : '';
  const url = cleanSlug
    ? `${API_BASE}/orders/track/${id}?slug=${encodeURIComponent(cleanSlug)}`
    : `${API_BASE}/orders/track/${id}`;
  const res = await fetch(url);
  return handleResponse(res, 'Failed to track order');
}

export async function fetchActiveTableOrder(slug, tableNumber) {
  const res = await fetch(`${API_BASE}/orders/active-table?slug=${encodeURIComponent(slug)}&table_number=${encodeURIComponent(tableNumber)}`);
  return handleResponse(res, 'Failed to fetch active table order');
}

export async function createServiceRequest(data) {
  const res = await fetch(`${API_BASE}/service-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return handleResponse(res, 'Failed to submit service request');
}

export async function fetchServiceRequests(token) {
  const res = await fetch(`${API_BASE}/admin/service-requests`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return handleResponse(res, 'Failed to fetch service requests');
}

export async function resolveServiceRequest(id, token) {
  const res = await fetch(`${API_BASE}/admin/service-requests/${id}/resolve`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` }
  });
  return handleResponse(res, 'Failed to resolve service request');
}

export async function approvePresenceRequest(id, token) {
  const res = await fetch(`${API_BASE}/admin/service-requests/${id}/approve-presence`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    }
  });
  return handleResponse(res, 'Failed to approve presence verification');
}

export async function rejectPresenceRequest(id, token, reason = 'Rejected by staff') {
  const res = await fetch(`${API_BASE}/admin/service-requests/${id}/reject-presence`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ rejection_reason: reason })
  });
  return handleResponse(res, 'Failed to reject presence verification');
}

export async function fetchAdminAnalytics(token, period = 'all', year = null, month = null) {
  let url = `${API_BASE}/admin/analytics`;
  const params = new URLSearchParams();
  if (year && month) {
    params.append('year', year);
    params.append('month', month);
  } else if (period && period !== 'all') {
    params.append('period', period);
  }
  const qs = params.toString();
  if (qs) url += `?${qs}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return handleResponse(res, 'Failed to fetch analytics');
}

export async function exportAdminAnalyticsCSV(token, period = 'all', year = null, month = null) {
  let url = `${API_BASE}/admin/analytics/export/csv`;
  const params = new URLSearchParams();
  if (year && month) {
    params.append('year', year);
    params.append('month', month);
  } else if (period && period !== 'all') {
    params.append('period', period);
  }
  const qs = params.toString();
  if (qs) url += `?${qs}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Export failed with HTTP ${res.status}`);
  }
  return await res.blob();
}

export async function exportAdminAnalyticsXLSX(token, period = 'all', year = null, month = null) {
  let url = `${API_BASE}/admin/analytics/export/xlsx`;
  const params = new URLSearchParams();
  if (year && month) {
    params.append('year', year);
    params.append('month', month);
  } else if (period && period !== 'all') {
    params.append('period', period);
  }
  const qs = params.toString();
  if (qs) url += `?${qs}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(errData.error || `Export failed with HTTP ${res.status}`);
    err.status = res.status;
    err.feature = errData.feature;
    throw err;
  }
  const blob = await res.blob();
  const contentDisposition = res.headers.get('Content-Disposition') || '';
  let filename = 'Sales_Report.xlsx';
  const match = contentDisposition.match(/filename="?([^"]+)"?/);
  if (match && match[1]) filename = match[1];
  return { blob, filename };
}

// ========== COMBO / THALI DEALS ==========

export async function fetchCombos(slug = '') {
  const params = new URLSearchParams();
  if (slug) params.append('slug', slug);
  const res = await fetch(`${API_BASE}/combos?${params.toString()}`);
  return handleResponse(res, 'Failed to fetch combos');
}

export async function fetchAdminCombos(token) {
  const res = await fetch(`${API_BASE}/admin/combos`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return handleResponse(res, 'Failed to fetch combos');
}

export async function createCombo(comboData, token) {
  const res = await fetch(`${API_BASE}/admin/combos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(comboData),
  });
  return handleResponse(res, 'Failed to create combo');
}

export async function updateCombo(id, comboData, token) {
  const res = await fetch(`${API_BASE}/admin/combos/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(comboData),
  });
  return handleResponse(res, 'Failed to update combo');
}

export async function deleteCombo(id, token) {
  const res = await fetch(`${API_BASE}/admin/combos/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(res, 'Failed to delete combo');
}

export async function toggleComboAvailability(id, available, token) {
  const res = await fetch(`${API_BASE}/admin/combos/${id}/toggle`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ available }),
  });
  return handleResponse(res, 'Failed to toggle combo availability');
}

export async function optimizeDatabase(param1, param2) {
  let token = param1;
  let daysOld = 90;
  if (typeof param1 === 'number') {
    daysOld = param1;
    token = param2;
  } else if (typeof param2 === 'number') {
    daysOld = param2;
  }
  const res = await fetch(`${API_BASE}/admin/optimize-db`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ daysOld }),
  });
  return handleResponse(res, 'Failed to optimize database');
}

export async function superAdminOptimizeDatabase(daysOld = 90, token) {
  const res = await fetch(`${API_BASE}/superadmin/optimize-db`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ daysOld }),
  });
  return handleResponse(res, 'Failed to run global database optimization');
}

export async function updateSuperAdminCredentials(credentialsData, token) {
  const res = await fetch(`${API_BASE}/superadmin/change-credentials`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(credentialsData),
  });
  return handleResponse(res, 'Failed to update master credentials');
}

export async function fetchPaymentConfig() {
  const res = await fetch(`${API_BASE}/payment/config-status`);
  return handleResponse(res, 'Failed to fetch payment config');
}

export async function createCashfreeSubscription(planTier, token, returnUrl) {
  const res = await fetch(`${API_BASE}/payment/create-subscription`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ plan_tier: planTier, return_url: returnUrl }),
  });
  return handleResponse(res, 'Failed to create subscription session');
}

export async function verifyCashfreeSubscription(subscriptionId, token) {
  const res = await fetch(`${API_BASE}/payment/verify-subscription?subscription_id=${encodeURIComponent(subscriptionId)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  return handleResponse(res, 'Failed to verify subscription status');
}

export async function cancelSubscription(token, reason) {
  const res = await fetch(`${API_BASE}/payment/cancel-mandate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ reason: reason || null }),
  });
  return handleResponse(res, 'Failed to cancel subscription');
}

export async function changePlan(planKey, token) {
  const res = await fetch(`${API_BASE}/payment/change-plan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ plan: planKey }),
  });
  return handleResponse(res, 'Failed to change plan');
}

export async function fetchPaymentHistory(token) {
  const res = await fetch(`${API_BASE}/payment/history`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return handleResponse(res, 'Failed to fetch payment history');
}

export async function fetchSubscriptionStatus(token) {
  const res = await fetch(`${API_BASE}/admin/subscription-status`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return handleResponse(res, 'Failed to fetch subscription status');
}

export async function fetchPublicPlans() {
  const res = await fetch(`${API_BASE}/plans`);
  return handleResponse(res, 'Failed to fetch plans');
}

// ========== CINEMA SCREENS & SEATS ==========

export async function fetchCinemaScreens(token) {
  const res = await fetch(`${API_BASE}/admin/cinema/screens`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return handleResponse(res, 'Failed to fetch cinema screens');
}

export async function createCinemaScreen(token, data) {
  const res = await fetch(`${API_BASE}/admin/cinema/screens`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
  return handleResponse(res, 'Failed to create cinema screen');
}

export async function updateCinemaScreen(token, screenId, data) {
  const res = await fetch(`${API_BASE}/admin/cinema/screens/${encodeURIComponent(screenId)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
  return handleResponse(res, 'Failed to update cinema screen');
}

export async function deleteCinemaScreen(token, screenId) {
  const res = await fetch(`${API_BASE}/admin/cinema/screens/${encodeURIComponent(screenId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  return handleResponse(res, 'Failed to delete cinema screen');
}

export async function fetchCinemaSeats(token, screenId = null) {
  let url = `${API_BASE}/admin/cinema/seats`;
  if (screenId) url += `?screen_id=${encodeURIComponent(screenId)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return handleResponse(res, 'Failed to fetch cinema seats');
}

export async function batchCreateCinemaSeats(token, data) {
  const res = await fetch(`${API_BASE}/admin/cinema/seats/batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
  return handleResponse(res, 'Failed to configure cinema seats');
}

export async function deleteCinemaSeat(token, seatId) {
  const res = await fetch(`${API_BASE}/admin/cinema/seats/${encodeURIComponent(seatId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  return handleResponse(res, 'Failed to delete cinema seat');
}

// ========== OFFERS & PROMOTIONS CLIENT API ==========

export async function fetchAdminOffers(token) {
  const res = await fetch(`${API_BASE}/admin/offers`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store'
  });
  return handleResponse(res, 'Failed to fetch offers');
}

export async function createAdminOffer(offerData, token) {
  const res = await fetch(`${API_BASE}/admin/offers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(offerData)
  });
  return handleResponse(res, 'Failed to create offer');
}

export async function updateAdminOffer(id, offerData, token) {
  const res = await fetch(`${API_BASE}/admin/offers/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(offerData)
  });
  return handleResponse(res, 'Failed to update offer');
}

export async function toggleAdminOffer(id, active, token) {
  const res = await fetch(`${API_BASE}/admin/offers/${encodeURIComponent(id)}/toggle`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ active })
  });
  return handleResponse(res, 'Failed to toggle offer status');
}

export async function deleteAdminOffer(id, token) {
  const res = await fetch(`${API_BASE}/admin/offers/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  return handleResponse(res, 'Failed to delete offer');
}
