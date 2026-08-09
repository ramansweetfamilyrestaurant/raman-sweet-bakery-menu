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
    const err = new Error(data.error || data.message || fallbackErrorMsg);
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

  const res = await fetch(url, { headers });
  return handleResponse(res, 'Failed to fetch restaurant info');
}

export async function fetchCategories({ adminView = false, slug = '', token = '' } = {}) {
  const params = new URLSearchParams();
  if (adminView) params.append('admin_view', 'true');
  if (slug) params.append('slug', slug);

  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/categories?${params.toString()}`, { headers });
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

  const res = await fetch(`${API_BASE}/dishes?${params.toString()}`, { headers });
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

// Restaurant Admin API calls
export async function adminLogin(username, password) {
  const res = await fetch(`${API_BASE}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return handleResponse(res, 'Login failed');
}

export async function fetchAdminStats(token) {
  const res = await fetch(`${API_BASE}/admin/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(res, 'Failed to fetch admin stats');
}

// Helper: Compress image file on client-side before uploading (max 800px, 82% JPEG quality)
async function compressImageFile(file) {
  if (!file || !file.type || !file.type.startsWith('image/')) return file;
  
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
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
          const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
            type: 'image/jpeg',
            lastModified: Date.now()
          });
          console.log(`⚡ Compressed image from ${(file.size / 1024).toFixed(1)}KB to ${(compressedFile.size / 1024).toFixed(1)}KB`);
          resolve(compressedFile);
        }, 'image/jpeg', 0.82);
      };
      img.onerror = () => resolve(file);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

export async function uploadImage(file, token) {
  // 1. Compress image on client-side (5MB -> ~80KB) for instant upload & low storage
  let processedFile = file;
  try {
    processedFile = await compressImageFile(file);
  } catch (err) {
    console.warn('Image compression notice, using original file:', err.message);
  }

  // 2. Primary: Upload compressed image to ImgBB Free Cloud CDN (0 MB Server Storage used!)
  try {
    const imgbbFormData = new FormData();
    imgbbFormData.append('image', processedFile);

    const imgbbRes = await fetch('https://api.imgbb.com/1/upload?key=6d207e02198a847aa98d0a2a901485a5', {
      method: 'POST',
      body: imgbbFormData,
    });
    const imgbbData = await imgbbRes.json();
    if (imgbbData && imgbbData.data && imgbbData.data.url) {
      console.log('⚡ Uploaded compressed image to ImgBB Free Cloud CDN:', imgbbData.data.url);
      return imgbbData.data.url;
    }
  } catch (err) {
    console.warn('ImgBB Cloud upload notice, using persistent server fallback:', err.message);
  }

  // 3. Fallback: If ImgBB drops, upload compressed file to our persistent server database endpoint
  const formData = new FormData();
  formData.append('image', processedFile);

  const res = await fetch(`${API_BASE}/admin/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  const data = await handleResponse(res, 'Upload failed');
  return data.url;
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

export async function updateDishPrice(id, price, token) {
  const res = await fetch(`${API_BASE}/admin/dishes/${id}/price`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ price }),
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

export async function createDirectOrder(orderData) {
  const res = await fetch(`${API_BASE}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderData),
  });
  return handleResponse(res, 'Failed to place order');
}

export async function fetchAdminOrders(token) {
  const res = await fetch(`${API_BASE}/admin/orders`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return handleResponse(res, 'Failed to fetch orders');
}

export async function updateOrderStatus(id, status, token) {
  const res = await fetch(`${API_BASE}/admin/orders/${id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ status })
  });
  return handleResponse(res, 'Failed to update order status');
}

export async function trackOrderStatus(id) {
  const res = await fetch(`${API_BASE}/orders/track/${id}`);
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

export async function fetchAdminAnalytics(token) {
  const res = await fetch(`${API_BASE}/admin/analytics`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return handleResponse(res, 'Failed to fetch analytics');
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

export async function optimizeDatabase(daysOld = 90, token) {
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


