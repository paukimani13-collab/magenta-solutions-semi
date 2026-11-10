let currentFilter = 'all';
let products = [];

const KNOWN_BRANDS = [
  'Acer', 'Apple', 'Asus', 'Brother', 'Canon', 'Dell', 'Epson', 'Fujitsu',
  'HP', 'Huawei', 'Lenovo', 'Logitech', 'Microsoft', 'MSI', 'Samsung',
  'MacBook', 'Star', 'Toshiba', 'Zebra',
];

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function setStoreStatus(message, isError = false) {
  const status = document.getElementById('store-status');
  if (!status) return;
  status.textContent = message;
  status.classList.toggle('store-status-error', isError);
}

function getProductBrand(product) {
  if (typeof product.brand === 'string' && product.brand.trim()) return product.brand.trim();
  const name = String(product.name || '');
  const brand = KNOWN_BRANDS.find(candidate => new RegExp(`^${candidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s|$)`, 'i').test(name));
  return brand === 'MacBook' ? 'Apple' : brand || 'Other';
}

function getProductCategory(product) {
  return ({
    laptop: 'laptops',
    desktop: 'all-in-ones',
    accessory: 'accessories',
  })[product.category] || product.category;
}

function updateBrandOptions() {
  const select = document.getElementById('store-brand');
  if (!select) return;
  const selectedBrand = select.value;
  const brands = [...new Set(products.map(getProductBrand))].sort((a, b) => a.localeCompare(b));
  select.innerHTML = '<option value="">All brands</option>' + brands.map(brand =>
    `<option value="${escapeHtml(brand)}">${escapeHtml(brand)}</option>`
  ).join('');
  if (brands.includes(selectedBrand)) select.value = selectedBrand;
}

function getFilteredProducts(filter = currentFilter) {
  const query = document.getElementById('store-query')?.value.trim().toLocaleLowerCase() || '';
  const brand = document.getElementById('store-brand')?.value || '';
  const minPriceValue = document.getElementById('store-min-price')?.value;
  const maxPriceValue = document.getElementById('store-max-price')?.value;
  const specs = document.getElementById('store-specs')?.value.trim().toLocaleLowerCase() || '';
  const minPrice = minPriceValue === '' || minPriceValue === undefined ? null : Number(minPriceValue);
  const maxPrice = maxPriceValue === '' || maxPriceValue === undefined ? null : Number(maxPriceValue);

  return products.filter(product => {
    const category = getProductCategory(product);
    const categoryLabel = window.MAGENTA_CATEGORIES.find(item => item.value === category)?.label || category;
    const searchable = [
      product.name, product.specs, product.description, product.badge, getProductBrand(product), category, categoryLabel,
    ].join(' ').toLocaleLowerCase();
    const price = Number(product.price);
    return (filter === 'all' || category === filter)
      && (!query || searchable.includes(query))
      && (!brand || getProductBrand(product) === brand)
      && (!specs || String(product.specs || '').toLocaleLowerCase().includes(specs))
      && (minPrice === null || (Number.isFinite(minPrice) && price >= minPrice))
      && (maxPrice === null || (Number.isFinite(maxPrice) && price <= maxPrice));
  });
}

async function loadProducts() {
  setStoreStatus('Loading inventory…');
  try {
    const response = await fetch(window.MagentaApi.url('/api/products'), { cache: 'no-store' });
    if (!response.ok) throw new Error('Inventory could not be loaded from the server.');
    products = await response.json();
    updateBrandOptions();
    renderProducts(currentFilter);
    setStoreStatus(`${products.length} products loaded.`);
    return true;
  } catch (error) {
    setStoreStatus(`${error.message} Configure the Supabase project URL in js/api-config.js and make sure the inventory function is deployed.`, true);
    const grid = document.getElementById('products-grid');
    if (grid) grid.innerHTML = '';
    return false;
  }
}

function renderProducts(filter = currentFilter) {
  currentFilter = filter;
  const grid = document.getElementById('products-grid');
  if (!grid) return;
  const filtered = getFilteredProducts(filter);
  const count = document.getElementById('store-result-count');
  if (count) count.textContent = `Showing ${filtered.length} of ${products.length} products`;
  if (filtered.length === 0) {
    grid.innerHTML = '<p class="store-empty">No products found.</p>';
    return;
  }

  grid.innerHTML = filtered.map(product => {
    const category = getProductCategory(product);
    const categoryLabel = window.MAGENTA_CATEGORIES.find(item => item.value === category)?.label || category;
    const stockStatus = product.stockStatus || (
      product.inStock === false ? 'out-of-stock' : String(product.badge || '').trim().toLocaleLowerCase() === 'new stock'
        ? 'new-stock'
        : 'in-stock'
    );
    const inStock = stockStatus !== 'out-of-stock';
    const image = product.imageUrl
      ? `<img class="product-photo" src="${escapeHtml(window.MagentaApi.assetUrl(product.imageUrl))}" alt="${escapeHtml(product.name)}" loading="lazy">`
      : `<div class="photo-placeholder product-photo-placeholder" role="img" aria-label="Photo space for ${escapeHtml(product.name)}"><span>Product photo</span></div>`;
    return `
      <article class="product-card">
        <div class="product-img">${image}${product.badge ? `<span class="product-badge">${escapeHtml(product.badge)}</span>` : ''}</div>
        <div class="product-body">
          <h3>${escapeHtml(product.name)}</h3>
          <p class="product-specs">${escapeHtml(categoryLabel)}${getProductBrand(product) !== 'Other' ? ` · ${escapeHtml(getProductBrand(product))}` : ''}</p>
          <p class="product-specs">${escapeHtml(product.specs)}</p>
          ${product.description ? `<p class="product-description">${escapeHtml(product.description)}</p>` : ''}
          <p class="product-stock-status${inStock ? '' : ' is-out-of-stock'}">${stockStatus === 'new-stock' ? 'New stock' : inStock ? 'In stock' : 'Out of stock'}</p>
          <div class="product-footer">
            <div class="product-price">Ksh ${Number(product.price).toLocaleString()}</div>
            <button class="btn btn-primary btn-sm add-to-cart-btn" type="button" data-product="${escapeHtml(JSON.stringify(product))}"${inStock ? '' : ' disabled'}>${inStock ? 'Add to Cart' : 'Out of Stock'}</button>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

function renderCategoryFilters() {
  const filters = document.getElementById('category-filters');
  if (!filters) return;
  const categories = [{ value: 'all', label: 'All products' }, ...window.MAGENTA_CATEGORIES];
  filters.innerHTML = categories.map(category => `
    <button class="filter-btn${category.value === currentFilter ? ' active' : ''}" type="button" data-filter="${escapeHtml(category.value)}">
      ${escapeHtml(category.label)}
    </button>
  `).join('');
}

function filterProducts(category) {
  if (category !== 'all' && !window.MAGENTA_CATEGORIES.some(item => item.value === category)) return;
  document.querySelectorAll('.filter-btn').forEach(button => {
    button.classList.toggle('active', button.dataset.filter === category);
  });
  renderProducts(category);
}

document.addEventListener('DOMContentLoaded', () => {
  renderCategoryFilters();
  document.getElementById('category-filters')?.addEventListener('click', event => {
    const button = event.target.closest('.filter-btn');
    if (button) filterProducts(button.dataset.filter);
  });
  const searchForm = document.getElementById('store-search-form');
  searchForm?.addEventListener('input', () => renderProducts());
  searchForm?.addEventListener('change', () => renderProducts());
  searchForm?.addEventListener('reset', () => {
    window.setTimeout(() => {
      currentFilter = 'all';
      document.querySelectorAll('.filter-btn').forEach(button => {
        button.classList.toggle('active', button.dataset.filter === 'all');
      });
      renderProducts();
    });
  });
  loadProducts();
  document.getElementById('products-grid')?.addEventListener('click', event => {
    const addButton = event.target.closest('.add-to-cart-btn');
    if (!addButton) return;
    try {
      window.addToCart(JSON.parse(addButton.dataset.product));
    } catch {
      setStoreStatus('Could not add this product to the cart.', true);
    }
  });
});

window.renderProducts = renderProducts;
window.filterProducts = filterProducts;
