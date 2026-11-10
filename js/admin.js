let adminToken = '';
let products = [];
let selectedPhotoUrl = '';

function getFilteredProducts() {
  const query = document.getElementById('inventory-search').value.trim().toLocaleLowerCase();
  const category = document.getElementById('inventory-category').value;
  const availability = document.getElementById('inventory-availability').value;
  return products.filter(product => {
    const categoryLabel = window.MAGENTA_CATEGORIES.find(item => item.value === product.category)?.label || product.category;
    const searchable = [product.name, product.brand, product.specs, product.description, product.badge, categoryLabel]
      .join(' ')
      .toLocaleLowerCase();
    return (!query || searchable.includes(query))
      && (!category || product.category === category)
      && (!availability || (availability === 'in-stock' ? product.inStock !== false : product.inStock === false));
  });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function setAdminStatus(message, isError = false) {
  const status = document.getElementById('admin-status');
  status.textContent = message;
  status.classList.toggle('store-status-error', isError);
}

async function readJson(response, fallback) {
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error(fallback);
  }
  if (!response.ok) throw new Error(result.error || fallback);
  return result;
}

function renderProducts() {
  const grid = document.getElementById('products-grid');
  const filteredProducts = getFilteredProducts();
  document.getElementById('inventory-total').textContent = products.length;
  document.getElementById('inventory-in-stock').textContent = products.filter(product => product.inStock !== false).length;
  document.getElementById('inventory-out-of-stock').textContent = products.filter(product => product.inStock === false).length;
  document.getElementById('inventory-result-count').textContent = filteredProducts.length === products.length
    ? `Showing all ${products.length} products.`
    : `Showing ${filteredProducts.length} of ${products.length} products.`;
  if (!filteredProducts.length) {
    grid.innerHTML = products.length
      ? '<p class="store-empty">No products match these filters.</p>'
      : '<p class="store-empty">No products in the catalogue.</p>';
    return;
  }
  grid.innerHTML = filteredProducts.map(product => {
    const category = (window.MAGENTA_CATEGORIES.find(item => item.value === product.category)?.label) || product.category;
    const badge = String(product.badge || '').trim().toLocaleLowerCase();
    const stockStatus = product.stockStatus || (
      product.inStock === false ? 'out-of-stock' : (badge === 'new' || badge === 'new stock' ? 'new-stock' : 'in-stock')
    );
    const image = product.imageUrl
      ? `<img class="product-photo" src="${escapeHtml(window.MagentaApi.adminAssetUrl(product.imageUrl))}" alt="${escapeHtml(product.name)}" loading="lazy">`
      : '<div class="photo-placeholder product-photo-placeholder" role="img" aria-label="No product photo"><span>Product photo</span></div>';
    const controls = adminToken
      ? `<div class="stock-management-controls">
          <button class="btn btn-outline btn-sm edit-stock-btn" type="button" data-product-id="${escapeHtml(product.id)}">Edit details</button>
          <label class="btn btn-outline btn-sm photo-upload-control">Change photo
            <input class="product-photo-input" type="file" data-product-id="${escapeHtml(product.id)}" accept="image/jpeg,image/png,image/webp" aria-label="Change photo for ${escapeHtml(product.name)}">
          </label>
          <button class="btn btn-outline btn-sm remove-stock-btn" type="button" data-product-id="${escapeHtml(product.id)}">Remove from store</button>
        </div>`
      : '';
    return `<article class="product-card">
      <div class="product-img">${image}${product.badge ? `<span class="product-badge">${escapeHtml(product.badge)}</span>` : ''}</div>
      <div class="product-body">
        <h3>${escapeHtml(product.name)}</h3>
        <p class="product-specs">${escapeHtml(category)}${product.brand ? ` · ${escapeHtml(product.brand)}` : ''}</p>
        <p class="product-specs">${escapeHtml(product.specs)}</p>
        ${product.description ? `<p class="product-description">${escapeHtml(product.description)}</p>` : ''}
        <p class="product-stock-status${stockStatus === 'out-of-stock' ? ' is-out-of-stock' : ''}">${stockStatus === 'out-of-stock' ? 'Out of stock' : stockStatus === 'new-stock' ? 'New stock' : 'In stock'}</p>
        <div class="product-price">Ksh ${Number(product.price).toLocaleString()}</div>
        ${controls}
      </div>
    </article>`;
  }).join('');
}

async function loadProducts() {
  setAdminStatus('Loading inventory…');
  document.getElementById('reload-inventory').disabled = true;
  try {
    const response = await fetch(window.MagentaApi.adminUrl('/api/products'), { cache: 'no-store' });
    products = await readJson(response, 'Inventory could not be loaded from the API.');
    renderProducts();
    setAdminStatus(`${products.length} products in the catalogue.`);
    return true;
  } catch (error) {
    setAdminStatus(`${error.message} Check the Supabase project URL, deployed inventory function, and allowed website origin.`, true);
    products = [];
    renderProducts();
    document.getElementById('inventory-result-count').textContent = 'Inventory unavailable.';
    document.getElementById('products-grid').innerHTML = '<p class="store-empty store-status-error">Could not load products. Check the API connection and refresh.</p>';
    return false;
  } finally {
    document.getElementById('reload-inventory').disabled = false;
  }
}

async function unlockAdmin() {
  const token = document.getElementById('admin-token').value.trim();
  if (!token) {
    setAdminStatus('Enter the admin token to unlock stock management.', true);
    return;
  }
  try {
    const response = await fetch(window.MagentaApi.adminUrl('/api/admin/verify'), {
      headers: { Authorization: `Bearer ${token}` }
    });
    await readJson(response, 'Admin authorization failed.');
    adminToken = token;
    document.getElementById('admin-token').value = '';
    document.getElementById('unlock-admin').hidden = true;
    document.getElementById('lock-admin').hidden = false;
    document.getElementById('stock-controls').hidden = false;
    renderProducts();
    setAdminStatus('Stock management unlocked for this browser session.');
  } catch (error) {
    adminToken = '';
    document.getElementById('unlock-admin').hidden = false;
    document.getElementById('lock-admin').hidden = true;
    document.getElementById('stock-controls').hidden = true;
    renderProducts();
    setAdminStatus(error.message, true);
  }
}

function lockAdmin() {
  adminToken = '';
  document.getElementById('stock-controls').hidden = true;
  document.getElementById('unlock-admin').hidden = false;
  document.getElementById('lock-admin').hidden = true;
  resetStockForm();
  renderProducts();
  setAdminStatus('Stock management locked for this browser session.');
}

function buildProductFormData(form) {
  const formData = new FormData(form);
  const stockStatus = formData.get('stockStatus');
  formData.set('inStock', String(stockStatus !== 'out-of-stock'));
  if (stockStatus === 'new-stock') formData.set('badge', 'New Stock');
  return formData;
}

async function handleAddStock(event) {
  event.preventDefault();
  if (!adminToken) {
    setAdminStatus('Unlock stock management before posting products.', true);
    return;
  }
  const form = event.currentTarget;
  const editingId = form.dataset.editingId;
  const image = form.elements.image.files[0];
  if (!editingId && !image) {
    setAdminStatus('Choose a product photo before publishing.', true);
    return;
  }
  if (image && (!['image/jpeg', 'image/png', 'image/webp'].includes(image.type) || image.size > 5 * 1024 * 1024)) {
    setAdminStatus('Choose a JPEG, PNG, or WebP photo that is 5 MB or smaller.', true);
    return;
  }
  const submitButton = form.querySelector('[type="submit"]');
  submitButton.disabled = true;
  setAdminStatus(editingId ? 'Saving product changes…' : 'Publishing product to the store…');
  try {
    const response = await fetch(window.MagentaApi.adminUrl(editingId ? `/api/products/${encodeURIComponent(editingId)}` : '/api/products'), {
      method: editingId ? 'PATCH' : 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: buildProductFormData(form)
    });
    const result = await readJson(response, editingId ? 'Product changes could not be saved.' : 'Product could not be posted.');
    resetStockForm();
    if (await loadProducts()) {
      setAdminStatus(`${result.name} ${editingId ? 'updated' : 'published'}. It is now visible in the store.`);
    }
  } catch (error) {
    setAdminStatus(error.message, true);
  } finally {
    submitButton.disabled = false;
  }
}

function resetStockForm() {
  const form = document.getElementById('stock-form');
  form.reset();
  delete form.dataset.editingId;
  form.elements.image.required = true;
  document.getElementById('product-image-required').hidden = false;
  document.getElementById('stock-form-title').textContent = 'Quick post to store';
  document.getElementById('stock-submit').textContent = 'Publish to store';
  document.getElementById('cancel-edit').hidden = true;
  clearPhotoPreview();
}

function showPhotoPreview(source, label, isSelected = false) {
  const image = document.getElementById('product-image-preview-img');
  if (selectedPhotoUrl) URL.revokeObjectURL(selectedPhotoUrl);
  selectedPhotoUrl = source.startsWith('blob:') ? source : '';
  image.src = source;
  document.getElementById('product-image-preview-label').textContent = label;
  document.getElementById('clear-product-image').hidden = !isSelected;
  document.getElementById('product-image-preview').hidden = false;
}

function clearPhotoPreview() {
  if (selectedPhotoUrl) URL.revokeObjectURL(selectedPhotoUrl);
  selectedPhotoUrl = '';
  document.getElementById('product-image-preview-img').removeAttribute('src');
  document.getElementById('product-image-preview-label').textContent = '';
  document.getElementById('clear-product-image').hidden = true;
  document.getElementById('product-image-preview').hidden = true;
}

function clearSelectedPhoto() {
  const form = document.getElementById('stock-form');
  form.elements.image.value = '';
  const editingProduct = products.find(product => product.id === form.dataset.editingId);
  if (editingProduct?.imageUrl) {
    showPhotoPreview(window.MagentaApi.adminAssetUrl(editingProduct.imageUrl), 'Current product photo');
  } else {
    clearPhotoPreview();
  }
}

function editStock(id) {
  const product = products.find(item => item.id === id);
  if (!product) {
    setAdminStatus('That product is no longer in the catalogue. Reload inventory and try again.', true);
    return;
  }
  const form = document.getElementById('stock-form');
  form.dataset.editingId = product.id;
  form.elements.name.value = product.name;
  form.elements.brand.value = product.brand || '';
  form.elements.price.value = product.price;
  form.elements.specs.value = product.specs;
  form.elements.description.value = product.description || '';
  form.elements.category.value = product.category;
  const badge = String(product.badge || '').trim().toLocaleLowerCase();
  form.elements.badge.value = badge === 'new' || badge === 'new stock' ? '' : (product.badge || '');
  form.elements.stockStatus.value = product.stockStatus || (
    product.inStock === false ? 'out-of-stock' : (badge === 'new' || badge === 'new stock' ? 'new-stock' : 'in-stock')
  );
  form.elements.image.value = '';
  form.elements.image.required = false;
  document.getElementById('product-image-required').hidden = true;
  document.getElementById('stock-form-title').textContent = 'Edit store product';
  document.getElementById('stock-submit').textContent = 'Save changes';
  document.getElementById('cancel-edit').hidden = false;
  if (product.imageUrl) {
    showPhotoPreview(window.MagentaApi.adminAssetUrl(product.imageUrl), 'Current product photo');
  } else {
    clearPhotoPreview();
  }
  setAdminStatus(`Editing ${product.name}.`);
  form.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function previewSelectedPhoto(fileInput) {
  const file = fileInput.files[0];
  if (!file) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
    setAdminStatus('Choose a JPEG, PNG, or WebP photo that is 5 MB or smaller.', true);
    fileInput.value = '';
    clearSelectedPhoto();
    return;
  }
  showPhotoPreview(URL.createObjectURL(file), file.name, true);
  setAdminStatus('Photo ready to publish with this product.');
}

async function updateProductPhoto(id, fileInput) {
  const file = fileInput.files[0];
  if (!file) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
    setAdminStatus('Choose a JPEG, PNG, or WebP photo that is 5 MB or smaller.', true);
    fileInput.value = '';
    return;
  }
  const formData = new FormData();
  formData.append('image', file);
  fileInput.disabled = true;
  setAdminStatus('Uploading product photo…');
  try {
    const response = await fetch(window.MagentaApi.adminUrl(`/api/products/${encodeURIComponent(id)}/photo`), {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: formData
    });
    const result = await readJson(response, 'Product photo could not be updated.');
    if (await loadProducts()) setAdminStatus(`Photo updated for ${result.name}.`);
  } catch (error) {
    setAdminStatus(error.message, true);
  } finally {
    fileInput.value = '';
    fileInput.disabled = false;
  }
}

async function removeStock(id) {
  if (!adminToken || !window.confirm('Remove this product from the store?')) return;
  try {
    const response = await fetch(window.MagentaApi.adminUrl(`/api/products/${encodeURIComponent(id)}`), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    if (!response.ok) await readJson(response, 'Stock could not be removed.');
    if (await loadProducts()) setAdminStatus('Product removed from the store.');
  } catch (error) {
    setAdminStatus(error.message, true);
  }
}

function saveApiUrl() {
  const input = document.getElementById('api-url');
  const value = input.value.trim().replace(/\/+$/, '');
  if (value) {
    try {
      const parsed = new URL(value);
      if (!['http:', 'https:'].includes(parsed.protocol) || parsed.pathname !== '/' || parsed.search || parsed.hash) {
        throw new Error();
      }
    } catch {
      setAdminStatus('Enter a valid API origin such as https://api.example.com.', true);
      return;
    }
  }
  try {
    window.MagentaApi.setAdminBaseUrl(value);
    adminToken = '';
    document.getElementById('admin-token').value = '';
    document.getElementById('stock-controls').hidden = true;
    document.getElementById('unlock-admin').hidden = false;
    document.getElementById('lock-admin').hidden = true;
    resetStockForm();
    renderProducts();
    setAdminStatus('API URL saved in this browser.');
    loadProducts();
  } catch {
    setAdminStatus('The API URL could not be saved in this browser.', true);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const categorySelect = document.getElementById('product-category');
  window.MAGENTA_CATEGORIES.forEach(category => {
    const option = document.createElement('option');
    option.value = category.value;
    option.textContent = category.label;
    categorySelect.append(option);
  });
  document.getElementById('api-url').value = window.MagentaApi.getAdminBaseUrl();
  window.MAGENTA_CATEGORIES.forEach(category => {
    const option = document.createElement('option');
    option.value = category.value;
    option.textContent = category.label;
    document.getElementById('inventory-category').append(option);
  });
  document.getElementById('save-api-url').addEventListener('click', saveApiUrl);
  document.getElementById('unlock-admin').addEventListener('click', unlockAdmin);
  document.getElementById('admin-token').addEventListener('keydown', event => {
    if (event.key === 'Enter') unlockAdmin();
  });
  document.getElementById('lock-admin').addEventListener('click', lockAdmin);
  document.getElementById('reload-inventory').addEventListener('click', loadProducts);
  document.getElementById('inventory-search').addEventListener('input', renderProducts);
  document.getElementById('inventory-category').addEventListener('change', renderProducts);
  document.getElementById('inventory-availability').addEventListener('change', renderProducts);
  document.getElementById('clear-inventory-filters').addEventListener('click', () => {
    document.getElementById('inventory-search').value = '';
    document.getElementById('inventory-category').value = '';
    document.getElementById('inventory-availability').value = '';
    renderProducts();
  });
  document.getElementById('stock-form').addEventListener('submit', handleAddStock);
  document.getElementById('product-image').addEventListener('change', event => {
    previewSelectedPhoto(event.currentTarget);
  });
  document.getElementById('clear-product-image').addEventListener('click', clearSelectedPhoto);
  document.getElementById('cancel-edit').addEventListener('click', () => {
    resetStockForm();
    setAdminStatus('Product editing cancelled.');
  });
  document.getElementById('products-grid').addEventListener('click', event => {
    const editButton = event.target.closest('.edit-stock-btn');
    if (editButton) {
      editStock(editButton.dataset.productId);
      return;
    }
    const button = event.target.closest('.remove-stock-btn');
    if (button) removeStock(button.dataset.productId);
  });
  document.getElementById('products-grid').addEventListener('change', event => {
    const input = event.target.closest('.product-photo-input');
    if (input) updateProductPhoto(input.dataset.productId, input);
  });
  loadProducts();
});
