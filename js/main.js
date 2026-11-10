/* ============================================
   MAGENTA SOLUTIONS - Main JavaScript
   ============================================ */

const hamburger = document.querySelector('.hamburger');
const navLinks = document.querySelector('.nav-links');
const header = document.querySelector('.header');

if (hamburger) {
  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    navLinks.classList.toggle('open');
  });
}

document.querySelectorAll('.nav-links a').forEach(link => {
  link.addEventListener('click', () => {
    hamburger?.classList.remove('active');
    navLinks?.classList.remove('open');
  });
});

window.addEventListener('scroll', () => {
  if (window.scrollY > 50) {
    header?.classList.add('scrolled');
  } else {
    header?.classList.remove('scrolled');
  }
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) entry.target.classList.add('visible');
  });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.animate-on-scroll').forEach(el => observer.observe(el));

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

function getCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
  catch { return []; }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartUI();
}

function addToCart(product) {
  if (product.inStock === false) {
    showToast('This product is currently out of stock.');
    return;
  }
  const cart = getCart();
  const existing = cart.find(item => item.id === product.id);
  if (existing) existing.qty += 1;
  else cart.push({ ...product, qty: 1 });
  saveCart(cart);
  showToast(`${product.name} added to cart!`);
}

function removeFromCart(id) {
  saveCart(getCart().filter(item => item.id !== id));
  showToast('Item removed from cart');
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
      <div class="cart-item-img">ITEM</div>
      <div class="cart-item-info">
        <h4>${item.name}</h4>
        <div class="price">Ksh ${item.price.toLocaleString()} × ${item.qty}</div>
      </div>
      <button class="cart-item-remove" onclick="removeFromCart('${item.id}')" aria-label="Remove">×</button>
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
  showToast(`Order placed! Total: Ksh ${total.toLocaleString()}. We'll contact you shortly.`);
  saveCart([]);
  closeCart();
}

document.addEventListener('DOMContentLoaded', () => {
  updateCartUI();
  document.querySelectorAll('.cart-btn').forEach(btn => btn.addEventListener('click', openCart));
  document.querySelector('.cart-overlay')?.addEventListener('click', closeCart);
  document.querySelector('.cart-close')?.addEventListener('click', closeCart);
});

function handleBookingSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form));
  if (!data.name || !data.phone || !data.device || !data.issue) {
    showToast('Please fill in all required fields');
    return;
  }
  form.style.display = 'none';
  const success = form.parentElement.querySelector('.form-success');
  if (success) {
    success.classList.add('show');
    success.querySelector('.booking-ref').textContent = 'MS-' + Date.now().toString().slice(-6);
  }
  const bookings = JSON.parse(localStorage.getItem('magenta_bookings') || '[]');
  bookings.push({ ...data, id: Date.now(), status: 'pending' });
  localStorage.setItem('magenta_bookings', JSON.stringify(bookings));
  showToast('Booking submitted successfully!');
}

window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.openCart = openCart;
window.closeCart = closeCart;
window.checkout = checkout;
window.handleBookingSubmit = handleBookingSubmit;
window.showToast = showToast;
