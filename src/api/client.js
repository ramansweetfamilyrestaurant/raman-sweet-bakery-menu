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
    throw new Error(data.error || fallbackErrorMsg);
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

export async function uploadImage(file, token) {
  const formData = new FormData();
  formData.append('image', file);

  const res = await fetch(`${API_BASE}/admin/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  return handleResponse(res, 'Upload failed');
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
