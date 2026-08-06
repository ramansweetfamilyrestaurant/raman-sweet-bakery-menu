const API_BASE = '/api';

export async function fetchRestaurantInfo() {
  const res = await fetch(`${API_BASE}/info`);
  if (!res.ok) throw new Error('Failed to fetch restaurant info');
  return res.json();
}

export async function fetchCategories() {
  const res = await fetch(`${API_BASE}/categories`);
  if (!res.ok) throw new Error('Failed to fetch categories');
  return res.json();
}

export async function fetchDishes({ query = '', category_id = 'all', adminView = false } = {}) {
  const params = new URLSearchParams();
  if (query) params.append('q', query);
  if (category_id) params.append('category_id', category_id);
  if (adminView) params.append('admin_view', 'true');

  const res = await fetch(`${API_BASE}/dishes?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch dishes');
  return res.json();
}

// Admin API calls
export async function adminLogin(username, password) {
  const res = await fetch(`${API_BASE}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Login failed');
  return data;
}

export async function fetchAdminStats(token) {
  const res = await fetch(`${API_BASE}/admin/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch admin stats');
  return res.json();
}

export async function uploadImage(file, token) {
  const formData = new FormData();
  formData.append('image', file);

  const res = await fetch(`${API_BASE}/admin/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Upload failed');
  return data;
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
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create category');
  return data;
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
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update category');
  return data;
}

export async function deleteCategory(id, token) {
  const res = await fetch(`${API_BASE}/admin/categories/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to delete category');
  return data;
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
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to toggle category active status');
  return data;
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
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create dish');
  return data;
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
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update dish');
  return data;
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
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to toggle availability');
  return data;
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
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update price');
  return data;
}

export async function deleteDish(id, token) {
  const res = await fetch(`${API_BASE}/admin/dishes/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to delete dish');
  return data;
}
