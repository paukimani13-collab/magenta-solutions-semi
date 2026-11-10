/* ============================================
   MAGENTA SOLUTIONS - Main JavaScript
   ============================================ */

const hamburger = document.querySelector('.hamburger');
const navLinks = document.querySelector('.nav-links');
const header = document.querySelector('.header');

if (hamburger) {
  hamburger.addEventListener('click', () => {
    const isOpen = hamburger.classList.toggle('active');
    navLinks?.classList.toggle('open', isOpen);
    hamburger.setAttribute('aria-expanded', String(isOpen));
  });
}

document.querySelectorAll('.nav-links a').forEach(link => {
  link.addEventListener('click', () => {
    hamburger?.classList.remove('active');
    navLinks?.classList.remove('open');
    hamburger?.setAttribute('aria-expanded', 'false');
  });
});

window.addEventListener('scroll', () => {
  if (window.scrollY > 50) {
    header?.classList.add('scrolled');
  } else {
    header?.classList.remove('scrolled');
  }
});

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.animate-on-scroll').forEach(el => observer.observe(el));
} else {
  document.querySelectorAll('.animate-on-scroll').forEach(el => el.classList.add('visible'));
}

document.querySelectorAll('.service-card-slideshow').forEach(slideshow => {
  const images = slideshow.querySelectorAll('img');
  if (images.length < 2) return;

  let activeIndex = 0;
  window.setInterval(() => {
    images[activeIndex].classList.remove('is-active');
    activeIndex = (activeIndex + 1) % images.length;
    images[activeIndex].classList.add('is-active');
  }, Number(slideshow.dataset.interval));
});

function showToast(message, duration = 3000) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

const CART_KEY = 'magenta_cart';
let cartReadFailureShown = false;

function getCart() {
  try {
    const stored = JSON.parse(localStorage.getItem(CART_KEY));
    if (!Array.isArray(stored)) return [];
    return stored.filter(item =>
      item &&
      typeof item.id === 'string' &&
      typeof item.name === 'string' &&
      Number.isFinite(Number(item.price)) &&
      Number(item.price) > 0 &&
      Number.isSafeInteger(Number(item.qty)) &&
      Number(item.qty) > 0
    ).map(item => ({ ...item, price: Number(item.price), qty: Number(item.qty) }));
  } catch {
    if (!cartReadFailureShown) {
      showToast('Your saved cart could not be loaded. Check browser storage and try again.');
      cartReadFailureShown = true;
    }
    return [];
  }
}

function saveCart(cart) {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    updateCartUI();
    return true;
  } catch {
    showToast('Cart could not be saved in this browser. Check storage settings.');
    return false;
  }
}

function addToCart(product) {
  if (product.inStock === false || product.stockStatus === 'out-of-stock') {
    showToast('This product is currently out of stock.');
    return;
  }
  const cart = getCart();
  const existing = cart.find(item => item.id === product.id);
  if (existing) existing.qty = Math.min(existing.qty + 1, 99);
  else cart.push({ ...product, qty: 1 });
  if (saveCart(cart)) showToast(`${product.name} added to cart!`);
}

function removeFromCart(id) {
  if (saveCart(getCart().filter(item => item.id !== id))) showToast('Item removed from cart');
}

function changeCartQuantity(id, amount) {
  const cart = getCart();
  const item = cart.find(product => product.id === id);
  if (!item) return;
  item.qty = Math.min(99, item.qty + amount);
  saveCart(item.qty > 0 ? cart : cart.filter(product => product.id !== id));
}

function openWhatsAppMessage(message) {
  const whatsapp = window.open(`https://wa.me/254703344902?text=${encodeURIComponent(message)}`, '_blank');
  if (!whatsapp) return false;
  whatsapp.opener = null;
  return true;
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

function updateCartUI() {
  const cart = getCart();
  const totalItems = cart.reduce((sum, i) => sum + i.qty, 0);
  document.querySelectorAll('.cart-count').forEach(el => {
    el.textContent = totalItems;
    el.style.display = totalItems > 0 ? 'flex' : 'none';
  });

  const cartItemsEl = document.querySelector('.cart-items');
  const cartTotalEl = document.querySelector('.cart-total-value');
  if (!cartItemsEl) return;

  if (cart.length === 0) {
    cartItemsEl.innerHTML = '<div class="cart-empty">Your cart is empty.<br>Browse our store to add laptops & accessories.</div>';
    if (cartTotalEl) cartTotalEl.textContent = 'Ksh 0';
    return;
  }

  cartItemsEl.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div class="cart-item-img">${item.imageUrl ? `<img src="${escapeHtml(item.imageUrl)}" alt="">` : 'ITEM'}</div>
      <div class="cart-item-info">
        <h4>${escapeHtml(item.name)}</h4>
        <div class="price">Ksh ${item.price.toLocaleString()} each</div>
        <div class="cart-item-quantity">
          <button type="button" class="cart-quantity-btn" data-cart-change="-1" data-product-id="${escapeHtml(item.id)}" aria-label="Decrease ${escapeHtml(item.name)} quantity">−</button>
          <span>${item.qty}</span>
          <button type="button" class="cart-quantity-btn" data-cart-change="1" data-product-id="${escapeHtml(item.id)}" aria-label="Increase ${escapeHtml(item.name)} quantity">+</button>
        </div>
      </div>
      <button class="cart-item-remove" type="button" data-cart-remove="${escapeHtml(item.id)}" aria-label="Remove ${escapeHtml(item.name)} from cart">×</button>
    </div>
  `).join('');

  const total = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  if (cartTotalEl) cartTotalEl.textContent = `Ksh ${total.toLocaleString()}`;
}

function openCart() {
  document.querySelector('.cart-overlay')?.classList.add('open');
  document.querySelector('.cart-sidebar')?.classList.add('open');
  updateCartUI();
}

function closeCart() {
  document.querySelector('.cart-overlay')?.classList.remove('open');
  document.querySelector('.cart-sidebar')?.classList.remove('open');
}

function checkout() {
  const cart = getCart();
  if (cart.length === 0) { showToast('Your cart is empty'); return; }
  const total = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  const lines = cart.map(item => `• ${item.name} × ${item.qty} — Ksh ${(item.price * item.qty).toLocaleString()}`);
  const message = [
    'Hello Magenta Computers, I would like to request these products:',
    '',
    ...lines,
    '',
    `Estimated total: Ksh ${total.toLocaleString()}`,
    'Please confirm availability and collection/delivery details.'
  ].join('\n');
  if (openWhatsAppMessage(message)) {
    showToast('WhatsApp opened with your order request. Send the message to submit it; your cart is unchanged.', 6000);
    closeCart();
  } else {
    showToast('Allow pop-ups to open WhatsApp, or contact us at 0703 344 902.', 6000);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  updateCartUI();
  document.querySelectorAll('.cart-btn').forEach(btn => btn.addEventListener('click', openCart));
  document.querySelector('.cart-overlay')?.addEventListener('click', closeCart);
  document.querySelector('.cart-close')?.addEventListener('click', closeCart);
  document.querySelector('.cart-items')?.addEventListener('click', event => {
    const removeButton = event.target.closest('[data-cart-remove]');
    if (removeButton) {
      removeFromCart(removeButton.dataset.cartRemove);
      return;
    }
    const quantityButton = event.target.closest('[data-cart-change]');
    if (quantityButton) changeCartQuantity(quantityButton.dataset.productId, Number(quantityButton.dataset.cartChange));
  });
});

function handleBookingSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form));
  if (!data.name || !data.phone || !data.device || !data.service || !data.issue || !data.branch) {
    showToast('Please fill in all required fields');
    return;
  }
  const message = [
    'Hello Magenta Computers, I would like to request a repair/service booking:',
    `Name: ${data.name}`,
    `Phone: ${data.phone}`,
    `Email: ${data.email || 'Not provided'}`,
    `Device: ${data.device}`,
    `Brand/model: ${data.brand || 'Not provided'}`,
    `Service: ${data.service}`,
    `Problem: ${data.issue}`,
    `Branch: ${data.branch}`,
    `Preferred date: ${data.preferred_date || 'Flexible'}`,
    `Preferred time: ${data.time || 'Any time'}`
  ].join('\n');
  if (openWhatsAppMessage(message)) {
    showToast('WhatsApp opened with your booking request. Send the message to submit it.', 6000);
  } else {
    showToast('Allow pop-ups to open WhatsApp, or contact us at 0703 344 902.', 6000);
  }
}

function handleContactSubmit(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  if (!data.name || !data.phone || !data.message) {
    showToast('Please complete your name, phone, and message.');
    return;
  }
  const message = [
    'Hello Magenta Computers, I have a question:',
    `Name: ${data.name}`,
    `Phone: ${data.phone}`,
    '',
    data.message
  ].join('\n');
  if (openWhatsAppMessage(message)) {
    showToast('WhatsApp opened with your message. Send it to contact us.', 6000);
    event.currentTarget.reset();
  } else {
    showToast('Allow pop-ups to open WhatsApp, or contact us at 0703 344 902.', 6000);
  }
}

window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.changeCartQuantity = changeCartQuantity;
window.openCart = openCart;
window.closeCart = closeCart;
window.checkout = checkout;
window.handleBookingSubmit = handleBookingSubmit;
window.handleContactSubmit = handleContactSubmit;
window.showToast = showToast;
