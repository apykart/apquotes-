// ─── IMPORTS ───
import { auth, db, provider, signInWithPopup, signOut, onAuthStateChanged } from './config/firebase.js';
import { 
  doc, setDoc, updateDoc, addDoc, getDoc, getDocs,
  collection, onSnapshot, deleteDoc,
  query, where, orderBy, serverTimestamp, limit, increment
} from './config/firebase.js';

// ─── EXPOSE TO GLOBAL ───
window._fbAuth = { auth, provider, signInWithPopup, signOut, onAuthStateChanged };
window._db = db;
window._fsHelpers = {
  db, doc, setDoc, updateDoc, addDoc, getDoc, getDocs,
  collection, onSnapshot, deleteDoc, query, where, orderBy,
  serverTimestamp, limit, increment
};

// ─── CONSTANTS ───
const CATEGORIES = [
  {id:'all', label:'All', img:'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=100&h=100&fit=crop', bg:'linear-gradient(135deg,#2874f0,#3b8aff)'},
  {id:'mobiles', label:'Mobiles', img:'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=100&h=100&fit=crop', bg:'linear-gradient(135deg,#667eea,#764ba2)'},
  {id:'fashion', label:'Fashion', img:'https://images.unsplash.com/photo-1445205170230-053b83016050?w=100&h=100&fit=crop', bg:'linear-gradient(135deg,#f093fb,#f5576c)'},
  {id:'shoes', label:'Shoes', img:'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=100&h=100&fit=crop', bg:'linear-gradient(135deg,#4facfe,#00f2fe)'},
  {id:'electronics', label:'Gadgets', img:'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=100&h=100&fit=crop', bg:'linear-gradient(135deg,#43e97b,#38f9d7)'},
  {id:'audio', label:'Audio', img:'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=100&h=100&fit=crop', bg:'linear-gradient(135deg,#fa709a,#fee140)'},
  {id:'home', label:'Home', img:'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=100&h=100&fit=crop', bg:'linear-gradient(135deg,#a18cd1,#fbc2eb)'},
  {id:'beauty', label:'Beauty', img:'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=100&h=100&fit=crop', bg:'linear-gradient(135deg,#ffecd2,#fcb69f)'},
  {id:'sports', label:'Sports', img:'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=100&h=100&fit=crop', bg:'linear-gradient(135deg,#a1c4fd,#c2e9fb)'},
];

let PRODUCTS = [
  {id:1, name:'iPhone 15 Pro Max', category:'mobiles', images:['https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-15-pro-finish-select-202309-6-7inch-naturaltitanium?wid=5120&hei=2880&fmt=p-jpg&qlt=80&.v=1693009278140'], price:134900, ogPrice:159900, discount:16, rating:4.8, reviews:'12.4k', badge:'HOT', brand:'Apple', desc:'Titanium design, A17 Pro chip, 48MP camera.', features:['A17 Pro chip','48MP Main camera','6.7" Super Retina XDR','USB 3','29hr battery'], status:'approved', sellerId:'system'},
  // ... more products
];

// ─── STATE ───
let cart = [];
let wishlist = [];
let addresses = [];
let orders = [];
let coinData = {balance:0, transactions:[]};
let guestUser = {name:'', email:'', phone:''};
let currentPage = 'home';
let prevPage = 'home';
let currentProductId = null;
let selectedPayment = 'cod';
let useCoinsToggle = false;
let timerInterval;
let buyNowProduct = null;

// Seller variables
let userRole = 'user';
let sellerVerification = null;
let sellerProducts = [];
let sellerEarnings = [];
let withdrawalRequests = [];
let sellerProfile = {bankName:'',accountNumber:'',ifsc:'',upi:''};
let userVideos = [];
let _swiperIdx = 0;

// ─── HERO CAROUSEL ───
let _heroIdx = 0, _heroTimer = null;
let HERO_SLIDES = [];

// ─── XPLOR ───
let _xplorVideos = [];
let _xplorIdx = 0;
let _xplorLiked = {};
let _xplorMuted = true;
let _xplorIsAnimating = false;

// ─── FLASH TIMER ───
let _flashSec = 5*3600 + 42*60 + 18;

// ─── COIN CONSTANTS ───
let _COIN_TO_RUPEE_DEFAULT = 0.10;
let _COIN_MIN_TO_USE_DEFAULT = 1000;
const COIN_KEEP_MIN = 500;

Object.defineProperty(window, 'COIN_TO_RUPEE', { get: () => window._COIN_TO_RUPEE || _COIN_TO_RUPEE_DEFAULT, configurable: true });
Object.defineProperty(window, 'COIN_MIN_TO_USE', { get: () => window._COIN_MIN_TO_USE || _COIN_MIN_TO_USE_DEFAULT, configurable: true });

// ─── HELPERS ───
function getUid() {
  return (window.currentUser && window.currentUser.uid) ? window.currentUser.uid : null;
}

function findProd(id) {
  const sid = String(id);
  return PRODUCTS.find(p => String(p.id) === sid || String(p._fid) === sid);
}

function showToast(msg, type='success') {
  const cont = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  const icons = {
    success: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>',
    info: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2874f0" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    warn: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff6b35" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    coin: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f7c948" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>'
  };
  t.innerHTML = `<div class="toast-icon">${icons[type] || icons.success}</div><div>${msg}</div>`;
  cont.appendChild(t);
  setTimeout(() => { t.classList.add('removing'); setTimeout(() => t.remove(), 300); }, 2800);
}

function updateCartBadge() {
  const n = cart.reduce((s,i) => s + i.qty, 0);
  ['cartBadge','navCartBadge'].forEach(id => {
    const el = document.getElementById(id);
    if(el) { el.textContent = n; el.style.display = n > 0 ? 'flex' : 'none'; }
  });
}

function updateCoinBadge() {
  const el = document.getElementById('headerCoinBalance');
  if (el) el.textContent = coinData.balance;
}

// ─── FIRESTORE FUNCTIONS ───
async function firestoreSetField(field, value) {
  const uid = getUid();
  if (!uid || !window._db) return;
  const { doc, updateDoc, setDoc } = window._fsHelpers;
  try {
    const obj = {}; obj[field] = value; obj['updatedAt'] = Date.now();
    await updateDoc(doc(db, 'users', uid), obj);
  } catch(e) {
    const obj2 = {}; obj2[field] = value; obj2['updatedAt'] = Date.now();
    try { await setDoc(doc(db, 'users', uid), obj2, { merge: true }); }
    catch(e2) {}
  }
}

function saveCart() { updateCartBadge(); firestoreSetField('cart', cart); }
function saveWishlist() { firestoreSetField('wishlist', wishlist); }
function saveAddresses() { firestoreSetField('addresses', addresses); }
function saveCoins() { firestoreSetField('coins', coinData); }
function saveGuest() { firestoreSetField('profile', guestUser); }

// ─── COINS ───
function getUsableCoins() {
  return coinData.balance < window.COIN_MIN_TO_USE ? 0 : Math.max(0, coinData.balance - COIN_KEEP_MIN);
}

function coinDiscountAmount(total) {
  if (!useCoinsToggle) return 0;
  return Math.floor(Math.min(getUsableCoins() * window.COIN_TO_RUPEE, total * 0.20));
}

function coinsToRedeem(total) {
  return Math.ceil(coinDiscountAmount(total) / window.COIN_TO_RUPEE);
}

function addCoins(amount, desc) {
  coinData.balance += amount;
  coinData.transactions.unshift({id:Date.now().toString(), type:'earned', amount, desc, date:new Date().toISOString()});
  saveCoins();
  updateCoinBadge();
}

function deductCoins(amount, desc) {
  coinData.balance = Math.max(0, coinData.balance - amount);
  coinData.transactions.unshift({id:Date.now().toString(), type:'redeemed', amount, desc, date:new Date().toISOString()});
  saveCoins();
  updateCoinBadge();
}

// ─── ROUTING ───
function showPage(page, productId) {
  window.currentPage = page;
  // Stop xplor videos when leaving
  if (currentPage === 'xplor' && page !== 'xplor') {
    document.querySelectorAll('[id^="xvid_"]').forEach(v => {
      try { v.pause(); v.currentTime = 0; } catch(e) {}
    });
    _xplorMuted = true;
  }
  
  prevPage = currentPage;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const el = document.getElementById('page-' + page);
  if (!el) return;
  el.classList.add('active');
  
  const ps = document.getElementById('pageScroll');
  if (ps) { ps.scrollTop = 0; ps.classList.toggle('xplor-active', page === 'xplor'); }
  
  currentPage = page;
  
  const hdr = document.getElementById('appHeader');
  if (hdr) hdr.className = (page === 'home') ? 'app-header' : 'app-header hidden';
  
  const bnav = document.querySelector('.bottom-nav');
  if (bnav) bnav.style.display = page === 'seller-dashboard' ? 'none' : 'flex';
  if (bnav) bnav.style.background = page === 'xplor' ? 'rgba(0,0,0,.85)' : '';
  if (bnav) bnav.style.borderTopColor = page === 'xplor' ? 'rgba(255,255,255,.1)' : '';
  
  if (ps) {
    if (page === 'seller-dashboard') {
      ps.style.display = 'none';
    } else if (page === 'xplor') {
      ps.style.cssText = 'flex:1;min-height:0;overflow:hidden;position:relative;display:block';
    } else {
      ps.style.cssText = '';
      ps.style.display = '';
    }
  }
  
  const navMap = {home:'home',search:'search',xplor:'xplor',cart:'cart',profile:'profile',orders:'profile',wishlist:'profile',wallet:'profile',addresses:'profile',refer:'profile',help:'profile',rate:'profile',terms:'profile',about:'profile','my-videos':'profile','upload-video':'profile'};
  const nav = document.getElementById('nav-' + (navMap[page] || page));
  if (nav) nav.classList.add('active');
  
  // Render page
  if (page === 'detail' && productId) { currentProductId = productId; _swiperIdx = 0; renderDetail(productId); }
  else if (page === 'cart') renderCart();
  else if (page === 'checkout') renderCheckout();
  else if (page === 'success') renderSuccess();
  else if (page === 'profile') renderProfile();
  else if (page === 'orders') renderOrders();
  else if (page === 'wishlist') renderWishlist();
  else if (page === 'wallet') renderWallet();
  else if (page === 'addresses') renderAddresses();
  else if (page === 'refer') renderRefer();
  else if (page === 'help') renderHelp();
  else if (page === 'rate') renderRate();
  else if (page === 'terms') renderTerms();
  else if (page === 'about') renderAbout();
  else if (page === 'seller-dashboard') renderSellerDashboard();
  else if (page === 'xplor') { renderXplor(productId); _xplorMuted = true; }
  else if (page === 'my-videos') renderMyVideos();
  else if (page === 'upload-video') renderVideoUpload();
}

// ─── CLOUDINARY UPLOAD ───
const CLOUD_NAME = 'djcfq7tlf';
const UPLOAD_PRESET = 'Apykart';

async function uploadImg(file, folder, onProgress) {
  if (!file) throw new Error('No file');
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);
  if (folder) formData.append('folder', 'apykart/' + folder);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`);
    xhr.upload.onprogress = e => {
      if (e.lengthComputable && onProgress) onProgress(Math.round(e.loaded / e.total * 100));
    };
    xhr.onload = () => {
      if (xhr.status === 200) resolve(JSON.parse(xhr.responseText).secure_url);
      else reject(new Error('Upload failed'));
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(formData);
  });
}

async function uploadVideo(file, folder, onProgress) {
  if (!file) throw new Error('No file');
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);
  if (folder) formData.append('folder', 'apykart/' + folder);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`);
    xhr.upload.onprogress = e => {
      if (e.lengthComputable && onProgress) onProgress(Math.round(e.loaded / e.total * 100));
    };
    xhr.onload = () => {
      if (xhr.status === 200) resolve(JSON.parse(xhr.responseText).secure_url);
      else reject(new Error('Video upload failed'));
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(formData);
  });
}

async function uploadToStorage(file, path, onProgress) {
  if (!file) return null;
  const isVideo = file.type.startsWith('video/') || path.startsWith('videos/');
  const folder = path.split('/').slice(0, -1).join('/');
  try {
    if (isVideo) return await uploadVideo(file, folder, onProgress);
    else return await uploadImg(file, folder, onProgress);
  } catch(e) {
    console.error('Upload error:', e.message);
    showToast('Upload failed: ' + e.message, 'warn');
    return null;
  }
}
window._uploadToStorage = uploadToStorage;

// ─── INIT ───
function init() {
  renderHome();
  handleSearch('');
  updateCartBadge();
  updateCoinBadge();
  startTimer();
  setTimeout(hideLoadingScreen, 2200);
  if (window._fbReady) {
    loadDynamicBranding();
  } else {
    window.addEventListener('firebase-ready', loadDynamicBranding, { once: true });
    setTimeout(loadDynamicBranding, 3000);
  }
  checkDeepLink();
}

// ─── LOADING SCREEN ───
function hideLoadingScreen() {
  const ls = document.getElementById('loadingScreen');
  if (ls) {
    ls.classList.add('hidden');
    setTimeout(() => { ls.remove(); maybeShowWelcomePopup(); }, 600);
  } else {
    maybeShowWelcomePopup();
  }
}

// ─── WELCOME POPUP ───
const WELCOME_SEEN_KEY = 'apykart_welcome_seen';

function maybeShowWelcomePopup() {
  let seen = false;
  try { seen = localStorage.getItem(WELCOME_SEEN_KEY) === 'true'; } catch(e) {}
  if (!seen) showWelcomePopup();
}

function showWelcomePopup() {
  const portal = document.getElementById('welcomePopupPortal');
  if (!portal) return;
  portal.innerHTML = `
    <div class="welcome-popup-overlay">
      <div class="welcome-popup-card">
        <div class="welcome-popup-emoji">🎉</div>
        <div class="welcome-popup-title">Welcome to Apykart</div>
        <div class="welcome-popup-msg">
          Welcome to Apykart!<br><br>
          <strong>Shop, Sell &amp; Earn</strong> — all in one platform.<br><br>
          Thank you for joining us. We're excited to have you as part of the Apykart community.
        </div>
        <button class="welcome-popup-btn" onclick="closeWelcomePopup()">Get Started</button>
      </div>
    </div>`;
}

function closeWelcomePopup() {
  try { localStorage.setItem(WELCOME_SEEN_KEY, 'true'); } catch(e) {}
  const portal = document.getElementById('welcomePopupPortal');
  if (portal) portal.innerHTML = '';
}

// ─── START TIMER ───
function startTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (_flashSec <= 0) _flashSec = 6 * 3600;
    _flashSec--;
    const h = Math.floor(_flashSec / 3600);
    const m = Math.floor((_flashSec % 3600) / 60);
    const s = _flashSec % 60;
    const pad = n => String(n).padStart(2, '0');
    const hEl = document.getElementById('timerH');
    const mEl = document.getElementById('timerM');
    const sEl = document.getElementById('timerS');
    if (hEl) hEl.textContent = pad(h);
    if (mEl) mEl.textContent = pad(m);
    if (sEl) sEl.textContent = pad(s);
  }, 1000);
}

// ─── BRANDING ───
function loadDynamicBranding() {
  if (window._fbReady) {
    if (window._themeData) _applyTheme(window._themeData);
    if (window._brandingData) _applyBranding(window._brandingData);
    return;
  }
  window.addEventListener('firebase-ready', function onFBReady() {
    window.removeEventListener('firebase-ready', onFBReady);
    setTimeout(() => {
      if (window._themeData) _applyTheme(window._themeData);
      if (window._brandingData) _applyBranding(window._brandingData);
    }, 200);
  });
}

function _applyTheme(t) {
  if (!t) return;
  const root = document.documentElement;
  if (t.primaryColor) root.style.setProperty('--primary', t.primaryColor);
  if (t.accentColor) root.style.setProperty('--accent', t.accentColor);
  if (t.bgColor) root.style.setProperty('--bg', t.bgColor);
  if (t.cardColor) root.style.setProperty('--card', t.cardColor);
  if (t.textColor) root.style.setProperty('--text', t.textColor);
  if (t.successColor) root.style.setProperty('--success', t.successColor);
}

function _applyBranding(b) {
  if (!b) return;
  const name = b.appName || 'apykart';
  const split = parseInt(b.nameSplit) || 3;
  const color = b.nameColor || '#ffd700';
  const p1 = name.slice(0, split);
  const p2 = name.slice(split);
  document.title = name.charAt(0).toUpperCase() + name.slice(1) + ' – Shop Smarter';
  document.querySelectorAll('.header-logo-text, .loading-logo-text').forEach(el => {
    el.innerHTML = `${p1}<span style="color:${color}">${p2}</span>`;
  });
}

// ─── AUTH ───
function signInWithGoogle() {
  if (!window._fbAuth) { showToast('Please wait, loading...', 'info'); return; }
  const { signInWithPopup, auth, provider } = window._fbAuth;
  signInWithPopup(auth, provider)
    .then(() => showToast('Welcome!', 'success'))
    .catch(err => showToast('Login failed: ' + err.message, 'warn'));
}

function logoutUser() {
  if (!window._fbAuth) return;
  const { signOut, auth } = window._fbAuth;
  signOut(auth).then(() => {
    window.currentUser = null;
    cart = []; wishlist = []; addresses = []; orders = [];
    coinData = {balance:0, transactions:[]};
    guestUser = {name:'', email:'', phone:''};
    userRole = 'user'; sellerVerification = null;
    sellerProducts = []; sellerEarnings = [];
    withdrawalRequests = []; sellerProfile = {bankName:'',accountNumber:'',ifsc:'',upi:''};
    userVideos = [];
    updateCartBadge();
    showToast('Logged out', 'info');
    renderProfile();
    renderHome();
  });
}

// ─── FIREBASE LISTENERS ───
function setupProductsListener() {
  try {
    const productsCol = collection(db, 'products');
    const q = query(productsCol, where('status', 'in', ['active', 'approved', 'Active', 'Approved']));
    onSnapshot(q, (snap) => {
      const fromFS = [];
      snap.forEach(docSnap => {
        const x = docSnap.data();
        const fid = docSnap.id;
        if (!x || !x.name) return;
        if (x.approvalStatus === 'rejected') return;
        fromFS.push({
          _fid: fid, id: fid,
          name: x.name || '',
          brand: x.brand || '',
          category: (x.category || 'all').toLowerCase(),
          price: Number(x.price) || 0,
          ogPrice: Number(x.ogPrice) || Number(x.price) || 0,
          discount: Number(x.discount) || 0,
          rating: Number(x.rating) || 4.5,
          reviews: String(x.reviews || '0'),
          badge: x.badge || '',
          desc: x.desc || x.name || '',
          features: Array.isArray(x.features) ? x.features : [],
          sizes: Array.isArray(x.sizes) ? x.sizes : [],
          images: Array.isArray(x.images) && x.images.length ? x.images : (x.img ? [x.img] : []),
          video: x.video || '',
          img: (Array.isArray(x.images) && x.images[0]) ? x.images[0] : (x.img || ''),
          status: 'approved',
          coinsEarned: Number(x.coinsEarned) || 10,
          sellerId: x.sellerId || 'system'
        });
      });
      if (typeof PRODUCTS !== 'undefined') {
        const fsIds = new Set(fromFS.map(p => p.id));
        const staticOnly = fromFS.length === 0 ? PRODUCTS.filter(p => !p._fid) : [];
        PRODUCTS.length = 0;
        fromFS.forEach(p => PRODUCTS.push(p));
        staticOnly.forEach(p => PRODUCTS.push(p));
      }
      if (typeof currentPage !== 'undefined') {
        if (currentPage === 'home') renderHome();
        else if (currentPage === 'search') handleSearch(document.getElementById('searchInput')?.value || '');
        else if (currentPage === 'cart') renderCart();
      }
    }, err => console.warn('Products listener error:', err.message));
  } catch(e) { console.warn('Products setup failed:', e.message); }
}

function setupVideosListener() {
  try {
    const videosCol = collection(db, 'videos');
    const q = query(videosCol, where('status', '==', 'approved'), orderBy('createdAt', 'desc'), limit(50));
    onSnapshot(q, (snap) => {
      const vids = [];
      snap.forEach(docSnap => {
        const v = docSnap.data();
        if (v) vids.push({...v, id: docSnap.id, _fsId: docSnap.id});
      });
      vids.sort((a, b) => {
        const ta = a.createdAt?.seconds || (a.uploadedAt ? new Date(a.uploadedAt).getTime() / 1000 : 0);
        const tb = b.createdAt?.seconds || (b.uploadedAt ? new Date(b.uploadedAt).getTime() / 1000 : 0);
        return tb - ta;
      });
      window._approvedVideos = vids;
      if (typeof currentPage !== 'undefined' && currentPage === 'xplor') renderXplor();
      if (typeof currentPage !== 'undefined' && currentPage === 'home') renderTrendingVideos();
      if (typeof currentPage !== 'undefined' && currentPage === 'my-videos') renderMyVideos();
    }, err => {
      console.warn('Videos listener error:', err.message);
    });
  } catch(e) { console.warn('Videos setup failed:', e.message); }
}

function setupBannersListener() {
  try {
    const bannersCol = collection(db, 'banners');
    onSnapshot(bannersCol, (snap) => {
      const allBanners = snap.docs
        .map(d => ({...d.data(), _bid: d.id}))
        .filter(b => b.active !== false)
        .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
      window._fsBanners = allBanners;
      if (allBanners.length > 0 && typeof HERO_SLIDES !== 'undefined') {
        HERO_SLIDES.length = 0;
        allBanners.forEach((b, i) => {
          const gradients = [
            'linear-gradient(135deg,#7c3aed 0%,#2563eb 100%)',
            'linear-gradient(135deg,#0f172a 0%,#1e3a8a 100%)',
            'linear-gradient(135deg,#be123c 0%,#f97316 100%)'
          ];
          const hasImage = b.imageUrl && b.imageUrl.trim().length > 0;
          const hasText = (b.title && b.title.trim()) || (b.tag && b.tag.trim()) || (b.btn && b.btn.trim());
          HERO_SLIDES.push({
            cls: 'hero-slide-' + ((i % 3) + 1),
            tag: b.tag || '',
            title: b.title || '',
            sub: b.sub || '',
            btn: b.btn || b.btnLabel || '',
            emoji: b.emoji || '',
            action: b.action === 'search' ? "showPage('search')" : (b.action || "showPage('search')"),
            bg: b.bg || gradients[i % 3],
            imageUrl: b.imageUrl || '',
            imageOnly: hasImage && !hasText,
            size: b.size || '3:1'
          });
        });
        if (typeof currentPage !== 'undefined' && currentPage === 'home') {
          initHeroCarousel();
        }
      }
    }, err => {
      console.warn('Banners listener error:', err.message);
      if (typeof HERO_SLIDES !== 'undefined' && HERO_SLIDES.length === 0) {
        const defaultSlides = [
          { cls:'hero-slide-1', tag:'🔥 Big Sale', title:'Up to 70% Off\nTop Brands', sub:'Limited time · Grab before it\'s gone', btn:'Shop Deals', emoji:'🛍️', action:"showPage('search')" },
          { cls:'hero-slide-2', tag:'🆕 Just Arrived', title:'New Season\nCollection', sub:'Latest mobiles, fashion & more', btn:'Explore Now', emoji:'✨', action:"filterByCategory('mobiles')" },
          { cls:'hero-slide-3', tag:'🪙 ApyCoins', title:'Earn & Save\nEvery Order', sub:'Earn coins · Redeem discounts', btn:'Learn More', emoji:'🎁', action:"showPage('wallet')" },
        ];
        defaultSlides.forEach(s => HERO_SLIDES.push(s));
      }
      if (typeof currentPage !== 'undefined' && currentPage === 'home' && typeof initHeroCarousel === 'function') {
        initHeroCarousel();
      }
    });
  } catch(e) { console.warn('Banners setup failed:', e.message); }
}

// ─── AUTH STATE ───
function setupAuthListener() {
  if (!window._fbAuth) {
    setTimeout(setupAuthListener, 100);
    return;
  }
  window._fbAuth.onAuthStateChanged(window._fbAuth.auth, (user) => {
    if (user) {
      window.currentUser = {
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL
      };
      reloadUserData();
      if (!guestUser.name) guestUser.name = user.displayName || '';
      if (!guestUser.email) guestUser.email = user.email || '';
      saveGuest();
    } else {
      window.currentUser = null;
      reloadUserData();
    }
    if (currentPage === 'profile') renderProfile();
    renderCart();
    renderHome();
  });
}

// ─── APPLY USER DATA ───
window.applyFirestoreUserData = function(d, user) {
  if (!d) return;
  if (d.profile) {
    guestUser.name = d.profile.name || guestUser.name || (user?.displayName || '');
    guestUser.email = d.profile.email || guestUser.email || (user?.email || '');
    guestUser.phone = d.profile.phone || guestUser.phone || '';
  }
  if (Array.isArray(d.cart)) cart = d.cart;
  if (Array.isArray(d.wishlist)) wishlist = d.wishlist;
  if (Array.isArray(d.addresses)) addresses = d.addresses;
  if (d.coins) coinData = d.coins;
  if (d.role) userRole = d.role;
  if (d.seller_verification) sellerVerification = d.seller_verification;
  if (Array.isArray(d.seller_products)) sellerProducts = d.seller_products;
  if (Array.isArray(d.seller_earnings)) sellerEarnings = d.seller_earnings;
  if (Array.isArray(d.withdrawals)) withdrawalRequests = d.withdrawals;
  if (d.seller_profile) sellerProfile = d.seller_profile;
  if (Array.isArray(d.user_videos)) userVideos = d.user_videos;
  updateCartBadge();
  updateCoinBadge();
  if (currentPage === 'profile') renderProfile();
  else if (currentPage === 'cart') renderCart();
  else if (currentPage === 'orders') renderOrders();
  else if (currentPage === 'my-videos') renderMyVideos();
};

window.applyFirestoreOrders = function(orderList) {
  if (Array.isArray(orderList)) orders = orderList;
  if (currentPage === 'orders') renderOrders();
};

window.applyFirestoreUserVideos = function(vids) {
  if (Array.isArray(vids)) userVideos = vids;
  if (currentPage === 'my-videos') renderMyVideos();
};

window.applySellerVerification = function(svData) {
  if (!svData) return;
  sellerVerification = { ...(sellerVerification || {}), ...svData };
  if (svData.status === 'approved') userRole = 'seller';
  if (currentPage === 'profile') renderProfile();
  else if (currentPage === 'seller-dashboard') renderSellerDashboard();
};

function reloadUserData() {
  setTimeout(updateHeaderLocation, 100);
  updateCartBadge();
  updateCoinBadge();
}

function updateHeaderLocation() {
  const el = document.getElementById('headerLocVal');
  if (!el) return;
  const def = addresses.find(a => a.isDefault) || addresses[0];
  const locText = def ? (def.city || def.name || 'India') : 'India';
  el.innerHTML = locText + ' <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>';
}

// ─── PAGE: HOME ───
function renderHome() {
  initHeroCarousel();
  updateHeaderLocation();
  renderTrendingVideos();
  renderCategories();
  renderProducts();
}

function initHeroCarousel() {
  const wrap = document.getElementById('heroCarousel');
  if (!wrap) return;
  if (!HERO_SLIDES || HERO_SLIDES.length === 0) {
    const defaultSlides = [
      { cls:'hero-slide-1', tag:'🔥 Big Sale', title:'Up to 70% Off\nTop Brands', sub:'Limited time · Grab before it\'s gone', btn:'Shop Deals', emoji:'🛍️', action:"showPage('search')" },
      { cls:'hero-slide-2', tag:'🆕 Just Arrived', title:'New Season\nCollection', sub:'Latest mobiles, fashion & more', btn:'Explore Now', emoji:'✨', action:"filterByCategory('mobiles')" },
      { cls:'hero-slide-3', tag:'🪙 ApyCoins', title:'Earn & Save\nEvery Order', sub:'Earn coins · Redeem discounts', btn:'Learn More', emoji:'🎁', action:"showPage('wallet')" },
    ];
    defaultSlides.forEach(s => HERO_SLIDES.push(s));
  }
  wrap.innerHTML = HERO_SLIDES.map((s, i) => {
    if (s.imageOnly && s.imageUrl) {
      return `<div class="hero-slide ${i === 0 ? 'active' : ''}" id="heroSlide${i}" style="position:relative;overflow:hidden;padding:0;background:linear-gradient(135deg,#7c3aed,#2563eb)">
        <img src="${s.imageUrl}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0;display:block" onclick="${s.action || ''}">
      </div>`;
    }
    return `<div class="hero-slide ${s.cls || 'hero-slide-1'} ${i === 0 ? 'active' : ''}" id="heroSlide${i}" style="${s.bg && !s.cls ? 'background:' + s.bg : ''}${s.imageUrl ? ';position:relative;overflow:hidden' : ''}">
      ${s.imageUrl ? `<img src="${s.imageUrl}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.35;z-index:0">` : ''}
      <div style="position:relative;z-index:1;display:flex;flex-direction:column;justify-content:flex-end;height:100%">
        ${s.tag ? `<div class="hero-tag">${s.tag}</div>` : ''}
        ${s.title ? `<div class="hero-title">${s.title.replace('\n', '<br>')}</div>` : ''}
        ${s.sub ? `<div class="hero-sub">${s.sub}</div>` : ''}
        ${s.btn ? `<div class="hero-btn" onclick="${s.action || ''}">${s.btn} →</div>` : ''}
      </div>
      ${s.emoji ? `<div class="hero-emoji">${s.emoji}</div>` : ''}
    </div>`;
  }).join('') +
  `<div class="hero-dots">${HERO_SLIDES.map((_, i) => `<div class="hero-dot ${i === 0 ? 'active' : ''}" onclick="goHeroSlide(${i})" id="heroDot${i}"></div>`).join('')}</div>`;
  if (_heroTimer) clearInterval(_heroTimer);
  _heroTimer = setInterval(() => goHeroSlide((_heroIdx + 1) % HERO_SLIDES.length), 3500);
}

function goHeroSlide(n) {
  document.querySelectorAll('.hero-slide').forEach((s, i) => s.classList.toggle('active', i === n));
  document.querySelectorAll('.hero-dot').forEach((d, i) => d.classList.toggle('active', i === n));
  _heroIdx = n;
}

function renderCategories() {
  document.getElementById('categoriesScroll').innerHTML = CATEGORIES.map(c => `
    <div class="cat-chip" onclick="filterByCategory('${c.id}')">
      <div class="cat-icon" style="background:${c.bg};overflow:hidden;padding:0">
        <img src="${c.img || ''}" alt="${c.label || c.name || ''}" style="width:100%;height:100%;object-fit:cover;border-radius:16px" onerror="this.style.display='none';this.nextElementSibling&&(this.nextElementSibling.style.display='flex')">
        <div style="display:none;width:100%;height:100%;align-items:center;justify-content:center;font-size:22px">${c.icon || '📦'}</div>
      </div>
      <div class="cat-label">${c.label || c.name || c.id}</div>
    </div>
  `).join('');
}

function renderProducts() {
  const grid = document.getElementById('homeGrid');
  if (!PRODUCTS.length) {
    grid.innerHTML = `<div class="products-loading"><div class="products-spinner"></div><div style="font-size:13px;color:var(--text3);font-weight:600;margin-top:8px">Loading products…</div></div>`;
    return;
  }
  const approvedProds = PRODUCTS.filter(p => {
    const st = (p.status || '').toLowerCase();
    return !st || st === 'approved' || st === 'active';
  });
  const deals = [...approvedProds].sort((a, b) => b.discount - a.discount).slice(0, 8);
  grid.innerHTML = `
    <div class="section-header" style="padding-top:6px">
      <div class="section-title">⚡ Top Deals</div>
      <div class="section-link" onclick="showPage('search')">See All →</div>
    </div>
    <div class="deals-scroll">
      ${deals.map(p => {
        const img = (Array.isArray(p.images) && p.images[0]) || p.img || '';
        return `<div class="deal-card" onclick="showPage('detail','${p.id}')">
          <div class="deal-img">
            ${p.discount > 0 ? `<div class="deal-off-badge">-${p.discount}%</div>` : ''}
            ${img ? `<img src="${img}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover;display:block">` : `<span style="font-size:36px">📦</span>`}
          </div>
          <div class="deal-info">
            <div class="deal-name">${p.name}</div>
            <div class="deal-price">₹${Number(p.price).toLocaleString()}</div>
            ${p.ogPrice > p.price ? `<div class="deal-og">₹${Number(p.ogPrice).toLocaleString()}</div>` : ''}
          </div>
        </div>`;
      }).join('')}
    </div>
    <div class="section-header">
      <div class="section-title">🛍️ Recommended for You</div>
      <div class="section-link" onclick="showPage('search')">See All →</div>
    </div>
    <div class="products-grid">${approvedProds.slice(0, 8).map(p => productCardHTML(p)).join('')}</div>`;
  
  const viral = document.getElementById('viralProductsSection');
  if (viral) {
    viral.innerHTML = `
      <div class="section-header">
        <div class="section-title">🌟 More Products</div>
        <div class="section-link" onclick="showPage('search')">See All →</div>
      </div>
      <div class="products-grid">${approvedProds.slice(8).map(p => productCardHTML(p)).join('')}</div>
      <div style="height:20px"></div>
    `;
  }
}

function productCardHTML(p) {
  const wished = wishlist.includes(p.id) || wishlist.includes(p._fid);
  const firstImg = (Array.isArray(p.images) && p.images[0]) ? p.images[0] : (p.img || '');
  const imgTag = firstImg ? `<img src="${firstImg}" alt="${p.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : '';
  const placeholder = `<div class="product-img-placeholder" style="${firstImg ? 'display:none' : ''}">📦</div>`;
  const imgCount = Array.isArray(p.images) ? p.images.length : (p.img ? 1 : 0);
  const multiTag = imgCount > 1 ? `<div style="position:absolute;bottom:5px;right:5px;background:rgba(0,0,0,.5);color:#fff;font-size:9px;font-weight:700;padding:2px 5px;border-radius:5px;z-index:2">${imgCount} photos</div>` : '';
  return `
  <div class="product-card" onclick="showPage('detail','${p.id}')">
    <div class="product-img-wrap">
      ${p.badge ? `<div class="product-badge">${p.badge}</div>` : ''}
      <button class="wish-btn-card" onclick="toggleWishlist(event,'${p.id}')">${wished
        ? `<svg viewBox="0 0 24 24" fill="#dc2626" stroke="#dc2626" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`
        : `<svg viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`
      }</button>
      ${imgTag}${placeholder}${multiTag}
    </div>
    <div class="product-info">
      ${p.brand ? `<div class="product-brand">${p.brand}</div>` : ''}
      <div class="product-name">${p.name}</div>
      <div class="product-meta"><div class="product-rating">★ ${p.rating}</div><div class="product-reviews">(${p.reviews})</div></div>
      <div class="product-price-row">
        <div class="product-price">₹${Number(p.price).toLocaleString()}</div>
        ${p.ogPrice > p.price ? `<div class="product-og-price">₹${Number(p.ogPrice).toLocaleString()}</div>` : ''}
      </div>
      ${p.discount > 0 ? `<div class="product-discount">${p.discount}% off</div>` : ''}
    </div>
    <button class="product-cart-btn" onclick="event.stopPropagation();addToCart('${p.id}')">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
    </button>
  </div>`;
}

function toggleWishlist(e, id) {
  e.stopPropagation();
  const idx = wishlist.indexOf(id);
  if (idx >= 0) { wishlist.splice(idx, 1); showToast('Removed from wishlist', 'info'); }
  else { wishlist.push(id); showToast('Added to wishlist ❤️', 'success'); }
  saveWishlist();
  if (currentPage === 'home') renderHome();
  else if (currentPage === 'search') handleSearch(document.getElementById('searchInput').value);
  else if (currentPage === 'wishlist') renderWishlist();
}

function filterByCategory(catId) {
  showPage('search');
  const inp = document.getElementById('searchInput');
  if (catId === 'all') { inp.value = ''; handleSearch(''); }
  else { const c = CATEGORIES.find(c => c.id === catId); inp.value = c ? c.label : catId; handleSearch(inp.value); }
}

function renderTrendingVideos() {
  const el = document.getElementById('trendingVideosScroll');
  if (!el) return;
  const fsVids = (window._approvedVideos || []).map(v => ({
    id: v.id || v._fsId,
    creator: v.uploaderName || v.creatorName || 'Creator',
    creatorEmoji: '🎬',
    videoSrc: v.videoUrl || v.videoDataUrl || v.url || '',
    thumb: v.thumbnailUrl || v.thumb || '',
    productId: v.productId || '',
    productName: v.productName || '',
    price: Number(v.price) || 0,
    ogPrice: Number(v.ogPrice) || 0,
    desc: v.description || v.title || ''
  }));
  if (!fsVids.length) {
    el.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 20px;gap:10px;text-align:center;width:100%">
        <div style="font-size:52px">🎬</div>
        <div style="font-family:var(--font-head);font-size:16px;font-weight:800;color:var(--text)">No Videos Yet</div>
        <div style="font-size:12px;color:var(--text2)">Be the first to upload a product video!</div>
        <button onclick="openVideoUpload()" style="background:var(--accent);color:#fff;font-size:13px;font-weight:800;padding:10px 22px;border-radius:99px;border:none;cursor:pointer;margin-top:4px">🎬 Upload Video</button>
      </div>`;
    return;
  }
  el.innerHTML = fsVids.slice(0, 8).map((v, i) => {
    const p = findProd(v.productId);
    const priceDisplay = v.price ? `₹${Number(v.price).toLocaleString()}` : (p ? `₹${Number(p.price).toLocaleString()}` : '');
    const productName = v.productName || (p ? p.name : '');
    return `<div class="trending-vid-card" onclick="showPage('xplor', '${v.id}')">
      ${v.videoSrc
        ? `<video src="${v.videoSrc}" muted playsinline loop autoplay style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0;display:block"></video>`
        : v.thumb
          ? `<img src="${v.thumb}" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0;display:block">`
          : `<div style="position:absolute;inset:0;background:linear-gradient(135deg,#0f172a,#1e3a8a);display:flex;align-items:center;justify-content:center;font-size:40px">🎬</div>`
      }
      <div class="trending-vid-overlay"></div>
      <div class="trending-vid-play"><svg width="16" height="16" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg></div>
      <div class="trending-vid-info">
        ${priceDisplay ? `<div class="trending-vid-price">${priceDisplay}</div>` : ''}
        <div class="trending-vid-name">${productName || 'Viral Product'}</div>
        <div class="trending-vid-shop" onclick="event.stopPropagation();showPage('detail','${v.productId}')">Shop Now →</div>
      </div>
    </div>`;
  }).join('');
}

// ─── SEARCH ───
function renderTrendChips() {
  const chips = ['iPhone', 'Sneakers', 'Headphones', 'Jeans', 'MacBook', 'Smart TV', 'boAt', 'Nike'];
  const el = document.getElementById('trendChips');
  if (el) el.innerHTML = chips.map(c => `<div class="search-chip" onclick="setSearch('${c}')">${c}</div>`).join('');
}

function setSearch(t) { document.getElementById('searchInput').value = t; handleSearch(t); }

function handleSearch(q) {
  const clearBtn = document.getElementById('searchClear');
  if (clearBtn) clearBtn.style.display = q ? 'block' : 'none';
  const cont = document.getElementById('searchContent');
  q = q.trim().toLowerCase();
  if (!q) {
    cont.innerHTML = `<div class="search-empty"><div><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#c8d5f0" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div><div style="font-family:var(--font-head);font-size:18px;font-weight:700">Discover Products</div><div style="font-size:14px;color:var(--text2)">Search mobiles, fashion, gadgets and more</div></div><div style="padding:0 14px 8px;font-size:13px;font-weight:800;color:var(--text2);text-transform:uppercase;letter-spacing:.5px">Popular Searches</div><div style="display:flex;flex-wrap:wrap;gap:8px;padding:0 14px" id="trendChips"></div>`;
    renderTrendChips();
    return;
  }
  const res = PRODUCTS.filter(p => {
    const st = (p.status || '').toLowerCase();
    const visible = !st || st === 'approved' || st === 'active';
    return visible && (p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || (p.brand || '').toLowerCase().includes(q));
  });
  if (!res.length) {
    cont.innerHTML = `<div class="search-empty"><div><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#c8d5f0" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M16 16s-1.5-2-4-2-4 2-4 2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg></div><div style="font-family:var(--font-head);font-size:18px;font-weight:700">No Results</div><div style="font-size:14px;color:var(--text2)">Try different keywords</div></div>`;
    return;
  }
  cont.innerHTML = `<div style="padding:12px 14px 4px;font-size:13px;color:var(--text2);font-weight:600">${res.length} result${res.length !== 1 ? 's' : ''} found</div><div class="products-grid" style="padding:4px 12px 16px">${res.map(p => productCardHTML(p)).join('')}</div>`;
}

function clearSearch() { document.getElementById('searchInput').value = ''; handleSearch(''); }

// ─── CART ───
function addToCart(id) {
  const sid = String(id);
  const ex = cart.find(i => String(i.id) === sid);
  if (ex) { ex.qty++; showToast('Quantity updated 🛒', 'success'); }
  else {
    const p = findProd(id);
    cart.push({
      id: sid, qty: 1,
      snap: p ? { name: p.name, price: p.price, ogPrice: p.ogPrice || p.price, img: (Array.isArray(p.images) && p.images[0]) || p.img || '', images: p.images || [] } : null
    });
    showToast(`${p ? p.name : 'Item'} added! 🛒`, 'success');
  }
  saveCart();
  if (currentPage === 'detail') renderDetail(currentProductId);
}

function removeFromCart(id) { const sid = String(id); cart = cart.filter(i => String(i.id) !== sid); saveCart(); renderCart(); }

function updateQty(id, delta) {
  const sid = String(id);
  const item = cart.find(i => String(i.id) === sid);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) { removeFromCart(id); return; }
  saveCart();
  if (currentPage === 'cart') renderCart();
  else if (currentPage === 'detail') renderDetail(currentProductId);
}

function buyNow(id) {
  buyNowProduct = { id, qty: 1 };
  useCoinsToggle = false;
  buyNowProduct._fromPage = currentPage;
  buyNowProduct._productId = id;
  if (currentPage !== 'detail') currentProductId = id;
  showPage('checkout');
}

function renderCart() {
  const cont = document.getElementById('cartContent');
  const cta = document.getElementById('cartCta');
  if (!cont || !cta) return;
  if (!cart.length) {
    cont.innerHTML = `
      <div class="cart-header-section">
        <div class="cart-page-title">My Cart 🛍️</div>
        <div class="cart-count">0 items</div>
      </div>
      <div class="cart-empty">
        <div class="cart-empty-icon"><svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#c8d5f0" stroke-width="1.5"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg></div>
        <div class="cart-empty-title">Your cart is empty</div>
        <div class="cart-empty-sub">Add products to get started!</div>
        <button class="btn-shop-now" onclick="showPage('home')">Start Shopping</button>
      </div>`;
    cta.innerHTML = '';
    return;
  }
  const resolvedItems = cart.map(item => {
    const live = findProd(item.id);
    const data = live || item.snap;
    if (!data) return null;
    return { item, data };
  }).filter(Boolean);
  if (!resolvedItems.length) {
    cont.innerHTML = `
      <div class="cart-header-section">
        <div class="cart-page-title">My Cart 🛍️</div>
        <div class="cart-count">${cart.length} item${cart.length !== 1 ? 's' : ''}</div>
      </div>
      <div class="products-loading" style="padding:60px 20px">
        <div class="products-spinner"></div>
        <div style="font-size:14px;color:var(--text3);font-weight:600;margin-top:12px">Loading your cart...</div>
      </div>`;
    cta.innerHTML = '';
    return;
  }
  const total = resolvedItems.reduce((s, {item, data}) => s + (data.price * item.qty), 0);
  const savings = resolvedItems.reduce((s, {item, data}) => s + ((data.ogPrice || data.price) - data.price) * item.qty, 0);
  const totalItems = cart.reduce((s, i) => s + i.qty, 0);
  cont.innerHTML = `
    <div class="cart-header-section">
      <div class="cart-page-title">My Cart 🛍️</div>
      <div class="cart-count">${totalItems} item${totalItems !== 1 ? 's' : ''}</div>
    </div>
    <div class="cart-items">
      ${resolvedItems.map(({item, data}) => {
        const fi = (Array.isArray(data.images) && data.images[0]) ? data.images[0] : (data.img || '');
        const sid = String(item.id);
        return `
        <div class="cart-item">
          <div class="cart-item-img">${fi ? `<img src="${fi}" alt="${data.name}" onerror="this.outerHTML='<span style=font-size:32px>📦</span>'">` : '<span style="font-size:32px">📦</span>'}</div>
          <div class="cart-item-info">
            <div class="cart-item-name">${data.name}</div>
            <div class="cart-item-price">₹${(data.price * item.qty).toLocaleString()}</div>
            ${savings > 0 ? `<div style="font-size:11px;color:#388e3c;font-weight:700">Save ₹${((data.ogPrice || data.price) - data.price).toLocaleString()} per item</div>` : ''}
            <div class="cart-item-controls">
              <button class="qty-btn" onclick="updateQty('${sid}',-1)">−</button>
              <div class="qty-val">${item.qty}</div>
              <button class="qty-btn" onclick="updateQty('${sid}',1)">+</button>
            </div>
          </div>
          <div class="cart-item-remove" onclick="removeFromCart('${sid}')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </div>
        </div>`;
      }).join('')}
    </div>
    <div class="cart-summary" style="margin-top:10px">
      <div class="cart-summary-title">Price Details</div>
      <div class="cart-summary-row"><span>Price (${totalItems} items)</span><span>₹${(total + savings).toLocaleString()}</span></div>
      <div class="cart-summary-row savings"><span>Discount</span><span>−₹${savings.toLocaleString()}</span></div>
      <div class="cart-summary-row"><span>Delivery</span><span style="color:#388e3c;font-weight:700">FREE 🎉</span></div>
      <div class="cart-summary-row total"><span>Total Amount</span><span>₹${total.toLocaleString()}</span></div>
      ${savings > 0 ? `<div style="margin-top:8px;font-size:12px;color:#388e3c;font-weight:700;text-align:center">🎉 You save ₹${savings.toLocaleString()} on this order!</div>` : ''}
    </div>`;
  cta.innerHTML = `
    <div class="cart-checkout-bar">
      <div class="cart-total-display">
        <div class="cart-total-label">Total Amount</div>
        <div class="cart-total-amount">₹${total.toLocaleString()}</div>
      </div>
      <button class="btn-checkout" onclick="showPage('checkout')">Checkout →</button>
    </div>`;
}

// ─── CHECKOUT ───
function renderCheckout() {
  const total = getCheckoutTotal();
  const savings = getCheckoutSavings();
  const coinDisc = coinDiscountAmount(total);
  const finalAmt = total - coinDisc;
  const items = getCheckoutItems();
  const canUseCoins = coinData.balance >= window.COIN_MIN_TO_USE;
  document.getElementById('checkoutContent').innerHTML = `
    <div class="checkout-back" onclick="checkoutGoBack()">← Back${buyNowProduct ? (buyNowProduct._fromPage === 'xplor' ? ' to Videos' : ' to Product') : ' to Cart'}</div>
    <div class="checkout-section">
      <div class="checkout-card">
        <div class="checkout-card-header"><div class="checkout-card-icon">👤</div><div><div class="checkout-card-title">Your Details</div><div class="checkout-card-sub">Required for order</div></div></div>
        <div class="checkout-user-form">
          <div class="form-group"><label class="form-label">Full Name *</label><input class="form-input" id="co_name" value="${guestUser.name}" placeholder="Enter your full name" oninput="updateGuestField('name',this.value)"><span class="form-error-msg" id="err_name">Please enter your name</span></div>
          <div class="form-group"><label class="form-label">Phone Number * (10 digits)</label><input class="form-input" id="co_phone" type="tel" maxlength="10" value="${guestUser.phone.replace(/\D/g, '').slice(-10)}" placeholder="9876543210" oninput="updateGuestField('phone',this.value)"><span class="form-error-msg" id="err_phone">Enter valid 10-digit number</span></div>
          <div class="form-group"><label class="form-label">Email Address *</label><input class="form-input" id="co_email" type="email" value="${guestUser.email}" placeholder="yourname@gmail.com" oninput="updateGuestField('email',this.value)"><span class="form-error-msg" id="err_email">Enter valid email</span></div>
        </div>
      </div>
      <div class="checkout-card">
        <div class="checkout-card-header"><div class="checkout-card-icon">📍</div><div style="flex:1"><div class="checkout-card-title">Delivery Address</div><div class="checkout-card-sub">Where should we deliver?</div></div></div>
        ${renderCheckoutAddr()}
      </div>
      <div class="coin-toggle-card">
        <div class="coin-toggle-top">
          <div class="coin-toggle-icon">🪙</div>
          <div class="coin-toggle-info"><div class="coin-toggle-title">Use ApyCoins</div><div class="coin-toggle-sub">Balance: <strong>${coinData.balance}</strong> coins</div></div>
          <label class="coin-toggle-switch"><input type="checkbox" id="coinToggle" ${useCoinsToggle && canUseCoins ? 'checked' : ''} onchange="toggleCoins(this.checked)" ${!canUseCoins ? 'disabled' : ''}><span class="coin-toggle-slider"></span></label>
        </div>
        ${!canUseCoins ? `<div class="coin-locked-info">🔒 Need ${window.COIN_MIN_TO_USE} coins to unlock. Earn ${window.COIN_MIN_TO_USE - coinData.balance} more!</div>` : ''}
        ${canUseCoins && useCoinsToggle && coinDisc > 0 ? `<div class="coin-discount-info"><span>🎉</span><div class="coin-discount-text">You save ₹${coinDisc} using ${coinsToRedeem(total)} coins!</div></div>` : ''}
        <div class="coin-earn-badge">💡 You'll earn <strong>+10 ApyCoins</strong> on this order!</div>
      </div>
      <div class="checkout-card">
        <div class="checkout-card-header"><div class="checkout-card-icon">📦</div><div><div class="checkout-card-title">Order Summary</div><div class="checkout-card-sub">${items.length} item(s)</div></div></div>
        <div class="checkout-items-list">
          ${items.map(item => { const p = findProd(item.id); if (!p) return ''; const fi = (Array.isArray(p.images) && p.images[0]) ? p.images[0] : (p.img || ''); return `
          <div class="checkout-item">
            <div class="checkout-item-img">${fi ? `<img src="${fi}" alt="${p.name}" onerror="this.outerHTML='<span style=font-size:22px>📦</span>'">` : '<span style="font-size:22px">📦</span>'}</div>
            <div class="checkout-item-info"><div class="checkout-item-name">${p.name}</div><div class="checkout-item-qty">Qty: ${item.qty}</div></div>
            <div class="checkout-item-price">₹${(p.price * item.qty).toLocaleString()}</div>
          </div>`; }).join('')}
        </div>
        <div style="height:4px"></div>
        <div class="checkout-summary-row"><span>Subtotal</span><span>₹${(total + savings).toLocaleString()}</span></div>
        <div class="checkout-summary-row savings"><span>Discount</span><span>−₹${savings.toLocaleString()}</span></div>
        ${coinDisc > 0 ? `<div class="checkout-summary-row coin-row"><span>🪙 Coins Discount</span><span>−₹${coinDisc}</span></div>` : ''}
        <div class="checkout-summary-row"><span>Delivery</span><span style="color:#388e3c;font-weight:700">FREE</span></div>
        <div class="checkout-summary-row total" style="margin:0 0 10px"><span>Total Payable</span><span>₹${finalAmt.toLocaleString()}</span></div>
      </div>
      <div class="checkout-card">
        <div class="checkout-card-header"><div class="checkout-card-icon">💳</div><div><div class="checkout-card-title">Payment Method</div></div></div>
        <div class="payment-options">
          ${canUseCoins ? `<div class="payment-option ${selectedPayment === 'coin_cod' ? 'selected' : ''}" onclick="selectPayment('coin_cod')"><div class="payment-option-icon">🪙</div><div class="payment-option-text"><div class="payment-option-name">Coins + Cash on Delivery</div><div class="payment-option-sub">Use coin discount & pay rest in cash</div></div><div class="payment-radio"></div></div>` : ''}
          <div class="payment-option ${selectedPayment === 'cod' ? 'selected' : ''}" onclick="selectPayment('cod')"><div class="payment-option-icon">💵</div><div class="payment-option-text"><div class="payment-option-name">Cash on Delivery</div><div class="payment-option-sub">Pay ₹${finalAmt.toLocaleString()} when order arrives</div></div><div class="payment-radio"></div></div>
        </div>
      </div>
    </div>`;
}

function renderCheckoutAddr() {
  const addr = addresses.find(a => a.isDefault) || addresses[0];
  if (addr) return `<div class="checkout-address-box"><div class="checkout-address-name">${addr.name}</div><div class="checkout-address-text">${addr.line1}, ${addr.city}, ${addr.state} – ${addr.pin}</div><div class="checkout-address-phone">📞 ${addr.phone}</div></div><button class="checkout-change-btn" onclick="openChangeAddress()">📍 Change / Add Address</button>`;
  return `<div style="padding:12px 16px"><div style="font-size:13px;color:var(--text2);margin-bottom:10px">Please add a delivery address</div><button class="form-submit-btn" onclick="openAddressForm(null)">+ Add Address</button></div>`;
}

function getCheckoutItems() { return buyNowProduct ? [{id: String(buyNowProduct.id), qty: buyNowProduct.qty}] : cart; }
function getCheckoutTotal() { return getCheckoutItems().reduce((s, i) => { const p = findProd(i.id); return s + (p ? p.price * i.qty : 0); }, 0); }
function getCheckoutSavings() { return getCheckoutItems().reduce((s, i) => { const p = findProd(i.id); return s + (p ? ((p.ogPrice || p.price) - p.price) * i.qty : 0); }, 0); }

function toggleCoins(v) { useCoinsToggle = v; selectedPayment = v ? 'coin_cod' : 'cod'; renderCheckout(); }
function selectPayment(id) { selectedPayment = id; useCoinsToggle = id === 'coin_cod'; renderCheckout(); }

function openChangeAddress() {
  document.getElementById('modalPortal').innerHTML = `
  <div class="modal-overlay" onclick="closeModal()">
    <div class="modal-sheet" onclick="event.stopPropagation()">
      <div class="modal-handle"></div>
      <div class="modal-header"><div class="modal-title">Select Address</div><div class="modal-close" onclick="closeModal()">✕</div></div>
      <div class="modal-body">
        ${addresses.map(a => `
        <div onclick="setDefaultAddress('${a.id}')" style="display:flex;align-items:flex-start;gap:10px;padding:12px;border-radius:12px;border:1.5px solid ${a.isDefault ? 'var(--primary)' : 'var(--border)'};background:${a.isDefault ? 'var(--primary-light)' : '#fff'};margin-bottom:10px;cursor:pointer">
          <div style="width:20px;height:20px;border-radius:50%;border:2px solid ${a.isDefault ? 'var(--primary)' : 'var(--border)'};background:${a.isDefault ? 'var(--primary)' : '#fff'};display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px">${a.isDefault ? '<div style="width:8px;height:8px;background:#fff;border-radius:50%"></div>' : ''}</div>
          <div style="flex:1"><div style="font-size:13px;font-weight:800;color:var(--text)">${a.name} <span style="font-size:11px;background:var(--primary-light);color:var(--primary);padding:1px 6px;border-radius:4px">${a.type}</span></div><div style="font-size:12px;color:var(--text2)">${a.line1}, ${a.city}, ${a.state} – ${a.pin}</div><div style="font-size:11px;color:var(--text3);margin-top:2px">📞 ${a.phone}</div></div>
        </div>`).join('')}
        <button class="form-submit-btn" onclick="closeModal();openAddressForm(null)">+ Add New Address</button>
      </div>
    </div>
  </div>`;
}

function setDefaultAddress(id) {
  addresses = addresses.map(a => ({...a, isDefault: a.id === id}));
  saveAddresses();
  closeModal();
  renderCheckout();
  showToast('Address updated 📍', 'success');
}

function checkoutGoBack() {
  if (!buyNowProduct) { showPage('cart'); return; }
  const fromPage = buyNowProduct._fromPage || prevPage || 'home';
  const pid = buyNowProduct._productId || buyNowProduct.id;
  buyNowProduct = null;
  if (fromPage === 'xplor') showPage('xplor');
  else if (fromPage === 'detail' && pid) showPage('detail', pid);
  else if (pid) showPage('detail', pid);
  else showPage('home');
}

let _guestFieldSaveTimer = null;
function updateGuestField(field, value) {
  guestUser[field] = value;
  clearTimeout(_guestFieldSaveTimer);
  _guestFieldSaveTimer = setTimeout(() => { saveGuest(); }, 700);
}

// ─── PLACE ORDER ───
async function placeOrder() {
  if (!window.currentUser) { showLoginPrompt('order'); return; }
  const nameVal = document.getElementById('co_name')?.value?.trim() || '';
  const phoneVal = document.getElementById('co_phone')?.value?.trim() || '';
  const emailVal = document.getElementById('co_email')?.value?.trim() || '';
  let valid = true;
  
  function valField(inputId, errId, bad) {
    const inp = document.getElementById(inputId), err = document.getElementById(errId);
    if (bad) { inp?.classList.add('input-error'); err?.classList.add('show'); valid = false; }
    else { inp?.classList.remove('input-error'); err?.classList.remove('show'); }
  }
  valField('co_name', 'err_name', !nameVal || nameVal.length < 2);
  valField('co_phone', 'err_phone', phoneVal.replace(/\D/g, '').length !== 10);
  valField('co_email', 'err_email', !emailVal.includes('@') || !emailVal.includes('.') || emailVal.length < 5);
  if (!valid) { showToast('Please fix the highlighted errors', 'warn'); return; }
  
  const addr = addresses.find(a => a.isDefault) || addresses[0];
  if (!addr) { showToast('Please add a delivery address', 'warn'); openAddressForm(null); return; }
  
  guestUser = { name: nameVal, phone: phoneVal.replace(/\D/g, ''), email: emailVal };
  saveGuest();
  
  const btn = document.getElementById('placeOrderBtn');
  const txt = document.getElementById('placeOrderText');
  const spin = document.getElementById('placeSpinner');
  if (btn) btn.disabled = true;
  if (txt) txt.textContent = 'Placing Order…';
  if (spin) spin.classList.remove('hide');
  
  await finalizeOrder();
  
  if (btn) btn.disabled = false;
  if (txt) txt.textContent = '✅ Place Order Securely';
  if (spin) spin.classList.add('hide');
}

async function finalizeOrder() {
  const total = getCheckoutTotal();
  const coinDisc = coinDiscountAmount(total);
  const finalAmt = total - coinDisc;
  const orderId = 'APK' + Date.now().toString().slice(-8).toUpperCase();
  const addr = addresses.find(a => a.isDefault) || addresses[0];
  const coinsEarned = 10;
  
  if (useCoinsToggle && coinDisc > 0) deductCoins(coinsToRedeem(total), `🛒 Used for Order #${orderId}`);
  addCoins(coinsEarned, `🎁 Order Reward #${orderId}`);
  
  const checkoutItems = getCheckoutItems();
  const newOrder = {
    id: orderId,
    items: checkoutItems.map(i => { const p = findProd(i.id); if (!p) return null; return { id: i.id, name: p.name, img: (Array.isArray(p.images) && p.images[0]) || p.img || '', price: p.price, qty: i.qty }; }).filter(Boolean),
    total: finalAmt,
    originalTotal: total,
    savings: getCheckoutSavings() + coinDisc,
    coinsRedeemed: useCoinsToggle ? coinsToRedeem(total) : 0,
    coinsEarned: coinsEarned,
    payment: selectedPayment,
    address: addr,
    customer: { name: guestUser.name, phone: guestUser.phone, email: guestUser.email },
    date: new Date().toISOString(),
    status: 'placed',
    statusHistory: [{ status: 'placed', time: new Date().toISOString() }]
  };
  
  orders.unshift(newOrder);
  // Add seller earnings
  checkoutItems.forEach(item => {
    const prod = findProd(item.id);
    if (prod && prod.sellerId) {
      const commission = prod.price * 0.10;
      const net = prod.price - commission;
      sellerEarnings.push({
        id: 'earn_' + Date.now() + Math.random().toString(36),
        order_id: orderId,
        product_id: prod.id,
        product_name: prod.name,
        product_price: prod.price,
        commission: commission,
        net_earning: net,
        status: 'pending',
        sellerId: prod.sellerId,
        date: new Date().toISOString()
      });
    }
  });
  saveSellerEarnings();
  await saveOrderToFirestore(newOrder);
  window._lastOrder = newOrder;
  if (!buyNowProduct) { cart = []; saveCart(); }
  buyNowProduct = null;
  useCoinsToggle = false;
  selectedPayment = 'cod';
  sendWAConfirmation(newOrder);
  showPage('success');
}

async function saveOrderToFirestore(order) {
  if (!window._fsHelpers) return;
  const { db, doc, setDoc, serverTimestamp } = window._fsHelpers;
  const uid = getUid();
  const orderData = {
    ...order,
    userId: uid || 'guest',
    userName: guestUser.name || window.currentUser?.displayName || '',
    userEmail: guestUser.email || window.currentUser?.email || '',
    userPhone: guestUser.phone || '',
    createdAt: serverTimestamp()
  };
  try { await setDoc(doc(db, 'orders', order.id), orderData); } catch(e) { console.warn('Primary order save failed:', e.message); }
  if (uid) {
    try { await setDoc(doc(db, 'users', uid, 'orders', order.id), {...orderData, orderId: order.id}); }
    catch(e) { console.warn('User order save failed:', e.message); }
  }
}

function sendWAConfirmation(order) {
  const phone = (order.customer?.phone || '').replace(/\D/g, '');
  if (!phone || phone.length < 10) return;
  const lines = order.items.map(i => `• ${i.name} (×${i.qty}) ₹${(i.price * i.qty).toLocaleString()}`).join('\n');
  const dd = new Date(Date.now() + 2 * 864e5).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  const msg = `✅ *Order Confirmed – Apykart*\n\nHi ${order.customer.name} 👋\n\n📦 Order ID: ${order.id}\n${lines}\n\n💰 Total: ₹${order.total.toLocaleString()} (COD)\n📍 Deliver to: ${order.address.city}, ${order.address.state}\n🚚 Expected: ${dd}\n\n🪙 +${order.coinsEarned} ApyCoins credited!\n\nThank you for shopping with Apykart 🛒`;
  window._waMsgData = { phone: (phone.startsWith('91') ? phone : '91' + phone), msg };
}

function openWAConfirmation() {
  const d = window._waMsgData || {};
  if (d.phone && d.msg) window.open(`https://wa.me/${d.phone}?text=${encodeURIComponent(d.msg)}`, '_blank');
}

function saveSellerEarnings() { firestoreSetField('seller_earnings', sellerEarnings); }

// ─── SUCCESS ───
function renderSuccess() {
  const order = window._lastOrder || {};
  const dd = new Date(Date.now() + 2 * 864e5).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  document.getElementById('successContent').innerHTML = `
  <div class="success-page">
    <div class="success-anim">✅</div>
    <div class="success-title">Order Confirmed! 🎉</div>
    <div class="success-subtitle">Placed successfully. Expected delivery <strong>${dd}</strong></div>
    <div class="success-order-id">Order ID: <strong>${order.id || 'APK...'}</strong></div>
    <div class="coin-earned-badge"><span style="font-size:22px">🪙</span><div class="coin-earned-text">+${order.coinsEarned || 10} ApyCoins credited! Total: ${coinData.balance} 🪙</div></div>
    <div class="whatsapp-notif-badge" onclick="openWAConfirmation()"><span style="font-size:22px">📱</span><div class="whatsapp-notif-text">Tap to send confirmation to your WhatsApp →</div></div>
    <div class="success-card">
      <div class="success-card-row"><span>Items</span><span>${order.items?.length || 1} item(s)</span></div>
      <div class="success-card-row"><span>Amount to Pay</span><span style="color:var(--primary);font-weight:800">₹${(order.total || 0).toLocaleString()}</span></div>
      ${order.coinsRedeemed > 0 ? `<div class="success-card-row"><span>Coins Used</span><span>−${order.coinsRedeemed} 🪙</span></div>` : ''}
      <div class="success-card-row"><span>Payment</span><span>${order.payment === 'coin_cod' ? 'Coins + COD' : 'Cash on Delivery'}</span></div>
      <div class="success-card-row"><span>Customer</span><span>${order.customer?.name || ''}</span></div>
      <div class="success-card-row"><span>Deliver To</span><span>${order.address?.city || 'Your address'}</span></div>
      <div class="success-card-row"><span>Est. Delivery</span><span style="color:var(--success)">${dd}</span></div>
    </div>
    <div class="success-actions">
      <button class="btn-continue-shopping" onclick="showPage('home')">🛍️ Continue Shopping</button>
      <button class="btn-track-order" onclick="showPage('orders')">📦 Track My Order</button>
    </div>
    <div style="height:20px"></div>
  </div>`;
}

// ─── ORDERS ───
function renderOrders() {
  const cont = document.getElementById('ordersContent');
  if (!orders.length) {
    cont.innerHTML = `<div class="order-empty"><div><svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="#c8d5f0" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg></div><div style="font-family:var(--font-head);font-size:20px;font-weight:700;color:var(--text);margin-bottom:6px">No Orders Yet</div><div style="font-size:14px;color:var(--text2)">Start shopping to see your orders here!</div><button class="btn-shop-now" style="margin-top:16px" onclick="showPage('home')">Shop Now</button></div>`;
    return;
  }
  const stLabel = { placed: 'Order Placed', confirmed: 'Confirmed ✅', shipped: 'Shipped 🚚', delivered: 'Delivered 📦', cancelled: 'Cancelled ❌', return_requested: 'Return Requested', returned: 'Returned ↩️' };
  cont.innerHTML = orders.map(order => {
    const st = order.status || 'placed';
    const canCancel = ['placed', 'confirmed'].includes(st);
    const canReturn = st === 'delivered';
    const canTrack = ['confirmed', 'shipped'].includes(st);
    const date = new Date(order.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const steps = [{ l: 'Order Placed', done: true }, { l: 'Confirmed', done: ['confirmed', 'shipped', 'delivered'].includes(st) }, { l: 'Shipped', done: ['shipped', 'delivered'].includes(st) }, { l: 'Delivered', done: st === 'delivered' }];
    const doneN = steps.filter(s => s.done).length;
    return `
    <div class="order-card">
      <div class="order-id-row">
        <div><div class="order-id">Order #${order.id}</div><div class="order-date">${date} · ${order.items?.length || 0} item(s)</div></div>
        <div class="order-status status-${st.replace(/_/g, '-')}">${stLabel[st] || st}</div>
      </div>
      <div class="order-items-preview">
        ${(order.items || []).slice(0, 3).map(i => `<div class="order-item-thumb">${i.img ? `<img src="${i.img}" alt="${i.name}" onerror="this.outerHTML='<span style=font-size:20px>📦</span>'">` : '<span style="font-size:20px">📦</span>'}</div>`).join('')}
        ${(order.items || []).length > 3 ? `<div class="order-item-more">+${order.items.length - 3}</div>` : ''}
      </div>
      ${canTrack ? `<div class="order-tracking"><div class="order-track-title">📍 Live Tracking</div>${steps.map((s, i) => { const cur = i === doneN - 1; return `<div class="track-step"><div class="track-dot ${s.done ? (cur ? 'current' : 'done') : ''}"></div><div class="track-label" style="color:${s.done ? 'var(--text)' : 'var(--text3)'}">${s.l}</div></div>`; }).join('')}</div>` : ''}
      <div class="order-total-row">
        <div><div class="order-total-txt">₹${(order.total || 0).toLocaleString()}</div><div style="font-size:11px;color:var(--text3);font-weight:600">Cash on Delivery${order.coinsRedeemed > 0 ? ` · ${order.coinsRedeemed} coins used` : ''}</div></div>
        ${order.coinsEarned ? `<div style="font-size:12px;font-weight:800;color:#92400e;background:var(--coin-bg);padding:4px 10px;border-radius:8px">+${order.coinsEarned} 🪙</div>` : ''}
      </div>
      <div class="order-action-row">
        ${canCancel ? `<button class="order-action-btn btn-cancel-order" onclick="cancelOrder('${order.id}')">❌ Cancel</button>` : ''}
        ${canReturn ? `<button class="order-action-btn btn-return-order" onclick="returnOrder('${order.id}')">↩️ Return</button>` : ''}
        <button class="order-action-btn btn-reorder" onclick="reorder('${order.id}')">🔄 Reorder</button>
      </div>
    </div>`;
  }).join('') + '<div style="height:20px"></div>';
}

function cancelOrder(oid) {
  showReasonModal('Cancel Order', ['Changed my mind', 'Found better price', 'Ordered by mistake', 'Delivery time too long', 'Other'], async r => {
    const order = orders.find(o => o.id === oid);
    orders = orders.map(o => o.id === oid ? {...o, status: 'cancelled', cancelReason: r} : o);
    const earnedCoins = order?.coinsEarned || 0;
    const redeemedCoins = order?.coinsRedeemed || 0;
    const CANCEL_PENALTY = 10;
    if (earnedCoins > 0) deductCoins(earnedCoins, `❌ Order #${oid} cancelled — earned coins reversed`);
    if (redeemedCoins > 0) addCoins(redeemedCoins, `🔄 Order #${oid} cancelled — redeemed coins refunded`);
    deductCoins(CANCEL_PENALTY, `⚠️ Order #${oid} cancellation penalty`);
    showToast(`Order cancelled.`, 'warn');
    renderOrders();
  });
}

function returnOrder(oid) {
  showReasonModal('Return Order', ['Product damaged', 'Wrong item', 'Not as described', 'Quality issue', 'Other'], async r => {
    const order = orders.find(o => o.id === oid);
    orders = orders.map(o => o.id === oid ? {...o, status: 'return_requested', returnReason: r} : o);
    const earnedCoins = order?.coinsEarned || 0;
    const redeemedCoins = order?.coinsRedeemed || 0;
    const RETURN_PENALTY = 15;
    if (earnedCoins > 0) deductCoins(earnedCoins, `↩️ Order #${oid} return — earned coins reversed`);
    if (redeemedCoins > 0) addCoins(redeemedCoins, `🔄 Order #${oid} return — redeemed coins refunded`);
    deductCoins(RETURN_PENALTY, `⚠️ Order #${oid} return penalty`);
    showToast('Return requested.', 'warn');
    renderOrders();
  });
}

function reorder(oid) {
  const order = orders.find(o => o.id === oid);
  if (!order?.items) return;
  order.items.forEach(item => { const ex = cart.find(i => i.id === item.id); if (ex) ex.qty += item.qty; else cart.push({ id: item.id, qty: item.qty }); });
  saveCart();
  showPage('cart');
  showToast('Items added to cart! 🛒', 'success');
}

// ─── REASON MODAL ───
function showReasonModal(title, reasons, onConfirm) {
  window._selReason = reasons[0];
  document.getElementById('modalPortal').innerHTML = `
  <div class="modal-overlay" onclick="closeModal()">
    <div class="modal-sheet" onclick="event.stopPropagation()">
      <div class="modal-handle"></div>
      <div class="modal-header"><div class="modal-title">${title}</div><div class="modal-close" onclick="closeModal()">✕</div></div>
      <div class="modal-body">
        <div style="font-size:13px;font-weight:700;color:var(--text2);margin-bottom:10px">Select a reason:</div>
        <div class="reason-list">
          ${reasons.map((r, i) => `<div class="reason-item ${i === 0 ? 'selected' : ''}" onclick="selReason(this,'${r.replace(/'/g, "\\'")}')"><div class="reason-radio"><div class="reason-radio-dot"></div></div><div class="reason-text">${r}</div></div>`).join('')}
        </div>
        <button class="form-submit-btn" onclick="confirmReason()">Confirm</button>
      </div>
    </div>
  </div>`;
  window._reasonCb = onConfirm;
}

function selReason(el, r) { document.querySelectorAll('.reason-item').forEach(x => x.classList.remove('selected')); el.classList.add('selected'); window._selReason = r; }
function confirmReason() { closeModal(); if (window._reasonCb) window._reasonCb(window._selReason || 'Other'); }
function closeModal() { document.getElementById('modalPortal').innerHTML = ''; }

// ─── PROFILE ───
function renderProfile() {
  const isLoggedIn = !!window.currentUser;
  const name = isLoggedIn ? (window.currentUser.displayName || guestUser.name || 'User') : 'Guest User';
  const email = isLoggedIn ? (window.currentUser.email || '') : '';
  const photo = isLoggedIn && window.currentUser.photoURL;
  const avatarHTML = photo ? `<img src="${photo}" style="width:72px;height:72px;border-radius:20px;object-fit:cover;">` : `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
  
  const verSt = sellerVerification?.status || '';
  let verBannerHTML = '';
  if (verSt === 'pending') {
    verBannerHTML = `<div style="margin:10px 10px 0;background:#fef9e7;border:1.5px solid #f7c948;border-radius:12px;padding:12px 14px;display:flex;align-items:center;gap:10px">
      <div style="font-size:22px">⏳</div>
      <div><div style="font-size:13px;font-weight:800;color:#92400e">Verification Pending</div><div style="font-size:11px;color:#b45309;margin-top:2px">Admin will verify soon</div></div>
    </div>`;
  } else if (verSt === 'approved') {
    verBannerHTML = `<div style="margin:10px 10px 0;background:#dcfce7;border:1.5px solid #86efac;border-radius:12px;padding:12px 14px;display:flex;align-items:center;gap:10px">
      <div style="font-size:22px">✅</div>
      <div style="flex:1"><div style="font-size:13px;font-weight:800;color:#166534">Verified Seller</div><div style="font-size:11px;color:#16a34a;margin-top:2px">You can now list products!</div></div>
      <button onclick="showPage('seller-dashboard')" style="background:#16a34a;color:#fff;font-size:11px;font-weight:800;padding:6px 12px;border-radius:8px;border:none;cursor:pointer;flex-shrink:0">Dashboard →</button>
    </div>`;
  } else if (verSt === 'rejected') {
    verBannerHTML = `<div style="margin:10px 10px 0;background:#fee2e2;border:1.5px solid #fca5a5;border-radius:12px;padding:12px 14px;display:flex;align-items:center;gap:10px">
      <div style="font-size:22px">❌</div>
      <div><div style="font-size:13px;font-weight:800;color:#b91c1c">Verification Rejected</div><div style="font-size:11px;color:#dc2626;margin-top:2px">Please resubmit documents</div></div>
    </div>`;
  }
  
  const sellerStatus = sellerVerification?.status || 'none';
  let sellerBtnHTML = '';
  if (!isLoggedIn) {
    sellerBtnHTML = `<div class="profile-menu-item" onclick="showLoginPrompt('seller')">
      <div class="profile-menu-icon" style="background:#f1f5f9"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg></div>
      <div class="profile-menu-text"><div class="profile-menu-name" style="color:var(--text3)">Become a Seller</div><div class="profile-menu-sub">Sign in with Google to start selling</div></div>
      <div class="profile-menu-arrow" style="color:var(--text3)">🔒</div>
    </div>`;
  } else if (userRole !== 'seller') {
    sellerBtnHTML = `<div class="profile-menu-item" onclick="openSellerVerificationModal()">
      <div class="profile-menu-icon" style="background:#fef9e7"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg></div>
      <div class="profile-menu-text"><div class="profile-menu-name">Become a Seller</div><div class="profile-menu-sub">Start selling on Apykart today</div></div>
      <div class="profile-menu-arrow">›</div>
    </div>`;
  } else if (sellerStatus === 'approved') {
    sellerBtnHTML = `<div class="profile-menu-item" onclick="showPage('seller-dashboard')">
      <div class="profile-menu-icon" style="background:#dcfce7"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg></div>
      <div class="profile-menu-text"><div class="profile-menu-name" style="color:#166534">✅ Seller Dashboard</div><div class="profile-menu-sub">Manage products & earnings</div></div>
      <div class="profile-menu-arrow">›</div>
    </div>`;
  } else if (sellerStatus === 'pending') {
    sellerBtnHTML = `<div class="profile-menu-item" style="cursor:default">
      <div class="profile-menu-icon" style="background:#fef3c7"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
      <div class="profile-menu-text"><div class="profile-menu-name" style="color:#92400e">⏳ Verification Pending</div><div class="profile-menu-sub">Admin will verify your documents soon</div></div>
    </div>`;
  } else if (sellerStatus === 'rejected') {
    sellerBtnHTML = `<div class="profile-menu-item" onclick="openSellerVerificationModal()">
      <div class="profile-menu-icon" style="background:#fee2e2"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></div>
      <div class="profile-menu-text"><div class="profile-menu-name" style="color:#b91c1c">❌ Verification Rejected</div><div class="profile-menu-sub">Tap to resubmit your documents</div></div>
      <div class="profile-menu-arrow">›</div>
    </div>`;
  }
  
  document.getElementById('profileContent').innerHTML = `
    <div class="profile-header-section">
      <div class="profile-avatar-row" style="position:relative">
        <button class="profile-upload-fab" onclick="openVideoUpload()" title="Upload Video">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
        <div class="profile-avatar">${avatarHTML}</div>
        <div class="profile-user-info">
          <div class="profile-name">${name}</div>
          ${email ? `<div class="profile-email">${email}</div>` : `<div class="profile-email" style="color:rgba(255,255,255,.5);font-style:italic">Not signed in</div>`}
          ${isLoggedIn ? `<button class="profile-edit-btn" onclick="logoutUser()" style="margin-top:6px;">🚪 Sign Out</button>` : `<button class="profile-edit-btn" onclick="signInWithGoogle()" style="margin-top:6px;background:rgba(255,255,255,.25);border:1px solid rgba(255,255,255,.4)">🔐 Sign in with Google</button>`}
        </div>
      </div>
      <div class="profile-stats-row">
        <div class="profile-stat"><div class="profile-stat-val">${orders.length}</div><div class="profile-stat-label">Orders</div></div>
        <div class="profile-stat"><div class="profile-stat-val">${wishlist.length}</div><div class="profile-stat-label">Wishlist</div></div>
        <div class="profile-stat"><div class="profile-stat-val">${coinData.balance}</div><div class="profile-stat-label">Coins 🪙</div></div>
        <div class="profile-stat"><div class="profile-stat-val">${addresses.length}</div><div class="profile-stat-label">Addresses</div></div>
      </div>
    </div>
    ${!isLoggedIn ? `<div style="margin:12px;background:linear-gradient(135deg,#2874f0,#3b8aff);border-radius:var(--radius);padding:16px 18px;display:flex;align-items:center;gap:14px;box-shadow:0 4px 16px rgba(40,116,240,.3);cursor:pointer" onclick="signInWithGoogle()">
      <div style="font-size:32px">🔐</div>
      <div style="flex:1"><div style="font-family:var(--font-head);font-size:15px;font-weight:800;color:#fff">Sign in with Google</div><div style="font-size:12px;color:rgba(255,255,255,.8);margin-top:2px">Login to order, sell & earn coins</div></div>
      <div style="color:rgba(255,255,255,.7);font-size:20px">›</div>
    </div>` : ''}
    <div class="profile-menu-group" style="margin-top:${isLoggedIn ? '0' : '4px'}"><div class="profile-menu-card">${sellerBtnHTML}</div></div>
    ${verBannerHTML}
    <div class="coin-wallet-strip" onclick="showPage('wallet')">
      <div class="coin-wallet-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg></div>
      <div class="coin-wallet-info">
        <div class="coin-wallet-bal">${coinData.balance} ApyCoins</div>
        <div class="coin-wallet-label">Apykart Coin Wallet</div>
        <div class="coin-wallet-val">${coinData.balance >= window.COIN_MIN_TO_USE ? `✅ ${getUsableCoins()} coins usable · Tap to view` : `🔒 Need ${window.COIN_MIN_TO_USE - coinData.balance} more to unlock`}</div>
      </div>
      <div style="color:rgba(255,255,255,.6);font-size:20px">›</div>
    </div>
    <div class="profile-menu-group">
      <div class="profile-menu-label">My Activity</div>
      <div class="profile-menu-card">
        ${mi('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>','My Orders','Track & reorder','orders', orders.length > 0 ? `<span class="profile-menu-badge">${orders.length}</span>` : '')}
        ${mi('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>','My Wishlist','Saved products','wishlist', wishlist.length > 0 ? `<span class="profile-menu-badge">${wishlist.length}</span>` : '')}
        ${mi('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>','My Videos',`${userVideos.length} videos uploaded`,'my-videos', userVideos.length > 0 ? `<span class="profile-menu-badge">${userVideos.length}</span>` : '')}
        ${mi('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>','ApyCoins Wallet','Earn & redeem coins','wallet', `<span style="font-size:12px;font-weight:800;color:#92400e">${coinData.balance} 🪙</span>`)}
      </div>
    </div>
    <div class="profile-menu-group">
      <div class="profile-menu-label">Account</div>
      <div class="profile-menu-card">
        ${mi('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>','My Addresses','Delivery locations','addresses','')}
        ${mi('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>','Edit Info','Update your details','_editProfile','')}
        ${mi('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>','Refer & Earn','Get 100 coins per referral','refer','')}
      </div>
    </div>
    <div class="profile-menu-group">
      <div class="profile-menu-label">Support</div>
      <div class="profile-menu-card">
        ${mi('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>','Help & Support','FAQs, chat & contact us','help','')}
        ${mi('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>','Rate the App','Share your experience','rate','')}
        ${mi('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>','Terms & Conditions','Privacy & legal policies','terms','')}
        ${mi('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>','About Apykart','Our story & mission','about','')}
      </div>
    </div>
    <div style="height:20px"></div>`;
}

function mi(icon, name, sub, action, badge) {
  const clickAction = action === '_editProfile' ? 'openEditProfile()' : action === '_soon' ? "showComingSoon('Feature')" : action === 'refer' ? "showPage('refer')" : `showPage('${action}')`;
  return `<div class="profile-menu-item" onclick="${clickAction}">
    <div class="profile-menu-icon" style="background:var(--primary-light)">${icon}</div>
    <div class="profile-menu-text"><div class="profile-menu-name">${name}</div><div class="profile-menu-sub">${sub}</div></div>
    ${badge ? badge : '<div class="profile-menu-arrow">›</div>'}
  </div>`;
}

function openEditProfile() {
  document.getElementById('modalPortal').innerHTML = `
  <div class="modal-overlay" onclick="closeModal()">
    <div class="modal-sheet" onclick="event.stopPropagation()">
      <div class="modal-handle"></div>
      <div class="modal-header"><div class="modal-title">Edit Profile</div><div class="modal-close" onclick="closeModal()">✕</div></div>
      <div class="modal-body">
        <div class="form-group"><label class="form-label">Full Name</label><input class="form-input" id="edit_name" value="${guestUser.name || ''}" placeholder="Your name"></div>
        <div class="form-group"><label class="form-label">Email</label><input class="form-input" id="edit_email" type="email" value="${guestUser.email || ''}" placeholder="your@email.com"></div>
        <div class="form-group"><label class="form-label">Phone</label><input class="form-input" id="edit_phone" type="tel" maxlength="10" value="${guestUser.phone || ''}" placeholder="9876543210"></div>
        <button class="form-submit-btn" onclick="saveProfile()">Save Changes</button>
      </div>
    </div>
  </div>`;
}

function saveProfile() {
  const name = document.getElementById('edit_name')?.value.trim() || '';
  const email = document.getElementById('edit_email')?.value.trim() || '';
  const phone = document.getElementById('edit_phone')?.value.trim() || '';
  if (!name) { showToast('Please enter your name', 'warn'); return; }
  if (!email.includes('@')) { showToast('Enter valid email', 'warn'); return; }
  guestUser = { name, email, phone };
  saveGuest();
  closeModal();
  renderProfile();
  showToast('Profile updated! ✅', 'success');
}

// ─── SELLER VERIFICATION ───
function openSellerVerificationModal() {
  if (!window.currentUser) { showLoginPrompt('seller'); return; }
  document.getElementById('modalPortal').innerHTML = `
    <div class="modal-overlay" onclick="closeModal()">
      <div class="modal-sheet" onclick="event.stopPropagation()">
        <div class="modal-handle"></div>
        <div class="modal-header"><div class="modal-title">Seller Verification</div><div class="modal-close" onclick="closeModal()">✕</div></div>
        <div class="modal-body">
          <select id="docType" class="form-input"><option value="aadhaar">Aadhaar Card</option><option value="pan">PAN Card</option></select>
          <input id="docNumber" placeholder="Document Number (e.g., 1234 5678 9012)" class="form-input" style="margin-top:12px">
          <label style="display:block; margin-top:12px;">Upload Front Image</label>
          <input type="file" id="docFrontImage" accept="image/*" class="form-input">
          <label style="display:block; margin-top:12px;">Upload Back Image (optional)</label>
          <input type="file" id="docBackImage" accept="image/*" class="form-input">
          <button onclick="submitSellerVerificationWithFiles()" style="margin-top:16px; width:100%; padding:14px; background:var(--primary); color:#fff; border-radius:12px;">Submit for Verification</button>
        </div>
      </div>
    </div>`;
}

async function submitSellerVerificationWithFiles() {
  const docType = document.getElementById('docType').value;
  const docNumber = document.getElementById('docNumber').value.trim();
  const frontFile = document.getElementById('docFrontImage').files[0];
  const backFile = document.getElementById('docBackImage')?.files[0];
  const uid = getUid();
  if (!docNumber) { showToast('Document number daal', 'warn'); return; }
  if (!frontFile) { showToast('Front image upload kar', 'warn'); return; }
  if (!uid) { showToast('Login required', 'warn'); return; }
  const btn = document.querySelector('[onclick="submitSellerVerificationWithFiles()"]');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Uploading...'; }
  showToast('Documents upload ho rahe hain...', 'info');
  let frontImageUrl = null, backImageUrl = null;
  try {
    if (window._uploadToStorage) {
      const frontPath = `seller_docs/${uid}/${docType}_front_${Date.now()}.${frontFile.name.split('.').pop()}`;
      frontImageUrl = await window._uploadToStorage(frontFile, frontPath, (pct) => { if (btn) btn.textContent = `⏳ Front: ${pct}%`; });
      if (backFile) {
        const backPath = `seller_docs/${uid}/${docType}_back_${Date.now()}.${backFile.name.split('.').pop()}`;
        backImageUrl = await window._uploadToStorage(backFile, backPath, (pct) => { if (btn) btn.textContent = `⏳ Back: ${pct}%`; });
      }
    }
  } catch(e) {
    console.warn('KYC upload error:', e.message);
    showToast('Upload failed: ' + e.message, 'warn');
    if (btn) { btn.disabled = false; btn.textContent = 'Submit for Verification'; }
    return;
  }
  sellerVerification = {
    docType, docNumber,
    frontImageUrl: frontImageUrl || '',
    backImageUrl: backImageUrl || '',
    status: 'pending',
    submittedAt: new Date().toISOString()
  };
  userRole = 'seller';
  saveSellerData();
  if (uid && window._fsHelpers) {
    const { db, doc, setDoc } = window._fsHelpers;
    setDoc(doc(db, 'users', uid), {
      seller_verification: sellerVerification,
      role: 'seller',
      updatedAt: Date.now()
    }, { merge: true }).catch(e => console.warn('KYC Firestore save:', e.message));
  }
  if (btn) { btn.disabled = false; btn.textContent = 'Submit for Verification'; }
  closeModal();
  showToast('Verification documents submit ho gaye! ✅', 'success');
  renderProfile();
}

function saveSellerData() {
  const uid = getUid();
  if (!uid || !window._db) return;
  const { db, doc, updateDoc } = window._fsHelpers;
  updateDoc(doc(db, 'users', uid), {
    role: userRole,
    seller_verification: sellerVerification || null,
    seller_products: sellerProducts,
    updatedAt: Date.now()
  }).catch(e => console.warn('saveSellerData:', e.message));
}

// ─── ADDRESSES ───
function renderAddresses() {
  const cont = document.getElementById('addressesContent');
  cont.innerHTML = (!addresses.length ? `<div class="order-empty"><div><svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="#c8d5f0" stroke-width="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></div><div style="font-family:var(--font-head);font-size:20px;font-weight:700;color:var(--text)">No Addresses</div><div style="font-size:14px;color:var(--text2)">Add your delivery address</div></div>` :
    addresses.map(a => `<div class="address-card ${a.isDefault ? 'selected-addr' : ''}"><div class="address-type-tag">${a.type}${a.isDefault ? ' · Default' : ''}</div><div class="address-name">${a.name}</div><div class="address-text">${a.line1}, ${a.city}, ${a.state} – ${a.pin}</div><div class="address-phone">📞 ${a.phone}</div><div class="address-actions">${!a.isDefault ? `<button class="address-action-btn addr-select" onclick="setDefaultAddress('${a.id}');renderAddresses()">Set Default</button>` : ''}<button class="address-action-btn addr-edit" onclick="openAddressForm('${a.id}')">Edit</button><button class="address-action-btn addr-delete" onclick="deleteAddress('${a.id}')">Delete</button></div></div>`).join('')) +
    `<button class="add-address-btn" onclick="openAddressForm(null)">+ Add New Address</button><div style="height:20px"></div>`;
}

let _addrType = 'Home', _editAddrId = null;

function openAddressForm(id) {
  _editAddrId = id;
  const a = id ? addresses.find(x => x.id === id) : null;
  _addrType = a ? a.type : 'Home';
  document.getElementById('modalPortal').innerHTML = `
  <div class="modal-overlay" onclick="closeModal()">
    <div class="modal-sheet" onclick="event.stopPropagation()">
      <div class="modal-handle"></div>
      <div class="modal-header"><div class="modal-title">${id ? 'Edit' : 'Add'} Address</div><div class="modal-close" onclick="closeModal()">✕</div></div>
      <div class="modal-body">
        <div style="display:flex;gap:8px;margin-bottom:14px" id="atRow">${['Home','Work','Other'].map(t => `<button class="form-type-btn ${t === _addrType ? 'active' : ''}" onclick="setAT('${t}')">${t}</button>`).join('')}</div>
        <div class="form-group" style="margin-bottom:10px"><label class="form-label">Full Name *</label><input class="form-input" id="af_name" value="${a?.name || ''}" placeholder="Name"></div>
        <div class="form-group" style="margin-bottom:10px"><label class="form-label">Phone *</label><input class="form-input" id="af_phone" type="tel" maxlength="10" value="${a?.phone || ''}" placeholder="9876543210"></div>
        <div class="form-group" style="margin-bottom:10px"><label class="form-label">Street Address *</label><input class="form-input" id="af_line1" value="${a?.line1 || ''}" placeholder="House no., Street, Landmark"></div>
        <div class="form-row" style="margin-bottom:10px"><div class="form-group"><label class="form-label">City *</label><input class="form-input" id="af_city" value="${a?.city || ''}" placeholder="City"></div><div class="form-group"><label class="form-label">Pincode *</label><input class="form-input" id="af_pin" value="${a?.pin || ''}" placeholder="000000" maxlength="6"></div></div>
        <div class="form-group" style="margin-bottom:14px"><label class="form-label">State *</label><input class="form-input" id="af_state" value="${a?.state || ''}" placeholder="State"></div>
        <button class="form-submit-btn" onclick="saveAddress()">Save Address</button>
      </div>
    </div>
  </div>`;
}

function setAT(t) { _addrType = t; document.querySelectorAll('#atRow .form-type-btn').forEach(b => b.classList.toggle('active', b.textContent === t)); }

function saveAddress() {
  const n = document.getElementById('af_name')?.value.trim();
  const ph = document.getElementById('af_phone')?.value.replace(/\D/g, '');
  const l1 = document.getElementById('af_line1')?.value.trim();
  const cy = document.getElementById('af_city')?.value.trim();
  const pi = document.getElementById('af_pin')?.value.trim();
  const st = document.getElementById('af_state')?.value.trim();
  if (!n || !ph || !l1 || !cy || !pi || !st) { showToast('Fill all required fields', 'warn'); return; }
  if (ph.length !== 10) { showToast('Enter valid 10-digit phone', 'warn'); return; }
  if (_editAddrId) { addresses = addresses.map(a => a.id === _editAddrId ? {...a, type: _addrType, name: n, phone: ph, line1: l1, city: cy, state: st, pin: pi} : a); showToast('Address updated ✅', 'success'); }
  else { const isFirst = addresses.length === 0; addresses.push({ id: 'addr' + Date.now(), type: _addrType, name: n, phone: ph, line1: l1, city: cy, state: st, pin: pi, isDefault: isFirst }); showToast('Address saved ✅', 'success'); }
  saveAddresses();
  closeModal();
  if (currentPage === 'addresses') renderAddresses();
  else if (currentPage === 'checkout') renderCheckout();
}

function deleteAddress(id) {
  addresses = addresses.filter(a => a.id !== id);
  if (addresses.length && !addresses.find(a => a.isDefault)) addresses[0].isDefault = true;
  saveAddresses();
  renderAddresses();
  showToast('Address deleted', 'info');
}

// ─── WISHLIST ───
function renderWishlist() {
  const cont = document.getElementById('wishlistContent');
  if (!wishlist.length) {
    cont.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;padding:60px 20px;gap:12px;text-align:center"><div><svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="#c8d5f0" stroke-width="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></div><div style="font-family:var(--font-head);font-size:20px;font-weight:700">Wishlist is Empty</div><div style="font-size:14px;color:var(--text2)">Save products you love</div><button class="btn-shop-now" style="margin-top:8px" onclick="showPage('home')">Explore Products</button></div>`;
    return;
  }
  cont.innerHTML = `<div class="wishlist-grid">${wishlist.map(id => { const p = findProd(id); if (!p) return ''; const fi = (Array.isArray(p.images) && p.images[0]) ? p.images[0] : (p.img || ''); return `<div class="wishlist-item" onclick="showPage('detail','${p.id}')"><button class="wishlist-remove" onclick="event.stopPropagation();toggleWishlist(event,'${p.id}')">✕</button><div class="wishlist-img">${fi ? `<img src="${fi}" alt="${p.name}" onerror="this.outerHTML='<span style=font-size:48px>📦</span>'">` : '<span style="font-size:48px">📦</span>'}</div><div class="wishlist-info"><div class="wishlist-name">${p.name}</div><div class="wishlist-price">₹${p.price.toLocaleString()}</div><button class="wishlist-add-btn" onclick="event.stopPropagation();addToCart('${p.id}')">Add to Cart</button></div></div>`; }).join('')}</div><div style="height:20px"></div>`;
}

// ─── WALLET ───
function renderWallet() {
  const earned = coinData.transactions.filter(t => t.type === 'earned' || t.type === 'bonus').reduce((s, t) => s + t.amount, 0);
  const redeemed = coinData.transactions.filter(t => t.type === 'redeemed').reduce((s, t) => s + t.amount, 0);
  document.getElementById('walletContent').innerHTML = `
    <div class="wallet-balance-card">
      <div class="wallet-bal-label">Total Balance</div>
      <div class="wallet-bal-amount">${coinData.balance} 🪙</div>
      <div class="wallet-bal-rupee">≈ ₹${(coinData.balance * window.COIN_TO_RUPEE).toFixed(0)} discount value</div>
      <div class="wallet-bal-stats"><div class="wallet-stat"><div class="wallet-stat-val">${earned}</div><div class="wallet-stat-label">Earned</div></div><div class="wallet-stat"><div class="wallet-stat-val">${redeemed}</div><div class="wallet-stat-label">Redeemed</div></div><div class="wallet-stat"><div class="wallet-stat-val">${coinData.transactions.length}</div><div class="wallet-stat-label">Transactions</div></div></div>
    </div>
    <div class="wallet-usable-info" style="margin-top:12px">
      <div class="wallet-usable-title">🔓 Coin Redemption Rules</div>
      ${coinData.balance < window.COIN_MIN_TO_USE ? `<div class="wallet-usable-sub">🔒 Need <strong>${window.COIN_MIN_TO_USE} coins</strong> minimum. You have <strong>${coinData.balance}</strong> — earn <strong>${window.COIN_MIN_TO_USE - coinData.balance}</strong> more!</div>` : `<div class="wallet-usable-sub">✅ You can use <strong>${getUsableCoins()} coins</strong> (₹${(getUsableCoins() * window.COIN_TO_RUPEE).toFixed(0)} discount). 500 coins always kept in reserve.</div>`}
    </div>
    <div class="wallet-how-earn" style="margin-top:8px">
      <div style="padding:12px 14px;font-size:13px;font-weight:800;color:var(--text)">How to Earn Coins</div>
      ${[{ i: '🛒', t: 'Every Order', s: 'Earn +10 coins on every order', a: '+10' }, { i: '❌', t: 'Cancel Penalty', s: 'Order cancel karne par −10 coins katenge', a: '−10' }, { i: '↩️', t: 'Return Penalty', s: 'Return/Refund karne par −15 coins katenge', a: '−15' }, { i: '👥', t: 'Refer a Friend', s: 'Both earn 100 coins', a: '+100' }, { i: '⭐', t: 'Leave a Review', s: 'Rate any product you bought', a: '+10' }, { i: '🎂', t: 'Birthday Bonus', s: 'Special coins on your birthday', a: '+100' }].map(e => `<div class="wallet-earn-item"><div class="wallet-earn-icon">${e.i}</div><div class="wallet-earn-text"><div class="wallet-earn-title">${e.t}</div><div class="wallet-earn-sub">${e.s}</div></div><div class="wallet-earn-amt" style="${e.a.startsWith('−') ? 'color:var(--danger);background:#fee2e2' : 'color:#166534;background:#dcfce7'}">${e.a}</div></div>`).join('')}
    </div>
    <div style="padding:12px 12px 6px;font-size:13px;font-weight:800;color:var(--text)">Transaction History</div>
    ${coinData.transactions.length ? `<div class="tx-list">${coinData.transactions.slice(0, 30).map(tx => `<div class="tx-item"><div class="tx-dot ${tx.type}">${tx.type === 'earned' ? '⬆️' : tx.type === 'redeemed' ? '⬇️' : '🎁'}</div><div class="tx-info"><div class="tx-desc">${tx.desc}</div><div class="tx-date">${new Date(tx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div></div><div class="tx-amount ${tx.type}">${tx.type === 'redeemed' ? '−' : '+'} ${tx.amount} 🪙</div></div>`).join('')}</div>` : `<div style="text-align:center;padding:30px;color:var(--text3);font-size:14px">No transactions yet. Place an order to earn coins!</div>`}
    <div style="height:20px"></div>`;
}

// ─── REFER ───
function renderRefer() {
  const code = 'APY' + (guestUser.name.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, '') || 'USR') + '100';
  const referUrl = `https://apykart.vercel.app?ref=${code}`;
  const waMsg = `🛒 Join *Apykart* — India's smartest shopping app!\n\nUse my referral code *${code}* to get ₹10 off on your first order 🎁\n\nWe both get *100 ApyCoins* when you shop! 🪙\n\n👉 Download & Shop: ${referUrl}`;
  document.getElementById('referContent').innerHTML = `
    <div class="refer-hero">
      <div class="refer-hero-icon">🎁</div>
      <div class="refer-hero-title">Refer & Earn 100 Coins!</div>
      <div class="refer-hero-sub">Share your code — friend gets ₹10 off, you both earn 100 ApyCoins 🪙</div>
      <div class="refer-code-box"><div class="refer-code-val">${code}</div><button class="refer-copy-btn" onclick="navigator.clipboard?.writeText('${code}').then(()=>showToast('Code copied! 🎉','success'))">Copy</button></div>
      <div style="margin-bottom:12px;background:rgba(255,255,255,.15);border-radius:10px;padding:10px 12px">
        <div style="font-size:11px;color:rgba(255,255,255,.7);font-weight:600;margin-bottom:4px">Your Referral Link</div>
        <div style="display:flex;align-items:center;gap:8px">
          <div style="flex:1;font-size:12px;color:#fff;font-weight:700;word-break:break-all">${referUrl}</div>
          <button onclick="navigator.clipboard?.writeText('${referUrl}').then(()=>showToast('Link copied! 🔗','success'))" style="background:#fff;color:var(--primary);font-size:11px;font-weight:800;padding:5px 10px;border-radius:7px;border:none;cursor:pointer;flex-shrink:0">Copy</button>
        </div>
      </div>
      <div class="refer-share-row">
        <button class="refer-share-btn" style="background:#25d366;color:#fff" onclick="window.open('https://wa.me/?text='+encodeURIComponent('${waMsg.replace(/'/g, "\\'")}'),'_blank')">📱 WhatsApp</button>
        <button class="refer-share-btn" style="background:rgba(255,255,255,.2);color:#fff;border:1px solid rgba(255,255,255,.3)" onclick="navigator.clipboard?.writeText('${referUrl}').then(()=>showToast('Link copied!','success'))">🔗 Copy Link</button>
      </div>
    </div>
    <div class="refer-steps">
      <div class="refer-steps-title">🚀 How it Works</div>
      <div class="refer-step"><div class="refer-step-num">1</div><div class="refer-step-text"><div class="refer-step-title">Share your referral link</div><div class="refer-step-sub">Send via WhatsApp or any platform • apykart.vercel.app</div></div></div>
      <div class="refer-step"><div class="refer-step-num">2</div><div class="refer-step-text"><div class="refer-step-title">Friend shops & orders</div><div class="refer-step-sub">They get ₹10 discount at checkout</div></div></div>
      <div class="refer-step"><div class="refer-step-num">3</div><div class="refer-step-text"><div class="refer-step-title">You both earn 100 coins! 🪙</div><div class="refer-step-sub">Auto-credited after first delivery</div></div></div>
    </div>
    <div style="height:20px"></div>`;
}

// ─── LOGIN PROMPT ───
function showLoginPrompt(reason) {
  const msgs = {
    order: { title: 'Login Required', sub: 'Order place karne ke liye Google se sign in karo', icon: '🛒' },
    seller: { title: 'Sign in to Sell', sub: 'Seller banne ke liye pehle Google account se login karo', icon: '🏪' },
    default: { title: 'Login Required', sub: 'Yeh feature use karne ke liye sign in karo', icon: '🔐' }
  };
  const m = msgs[reason] || msgs.default;
  document.getElementById('modalPortal').innerHTML = `
  <div class="modal-overlay" onclick="closeModal()">
    <div class="modal-sheet" onclick="event.stopPropagation()">
      <div class="modal-handle"></div>
      <div class="modal-header"><div class="modal-title">${m.title}</div><div class="modal-close" onclick="closeModal()">✕</div></div>
      <div class="modal-body" style="text-align:center;padding:20px 20px 28px">
        <div style="font-size:52px;margin-bottom:12px">${m.icon}</div>
        <div style="font-family:var(--font-head);font-size:17px;font-weight:800;color:var(--text);margin-bottom:6px">${m.title}</div>
        <div style="font-size:13px;color:var(--text2);margin-bottom:20px;line-height:1.5">${m.sub}</div>
        <button onclick="closeModal();signInWithGoogle()" style="width:100%;background:linear-gradient(135deg,#2874f0,#3b8aff);color:#fff;font-size:14px;font-weight:800;padding:14px;border-radius:12px;box-shadow:0 4px 14px rgba(40,116,240,.3);display:flex;align-items:center;justify-content:center;gap:8px;border:none;cursor:pointer">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Sign in with Google
        </button>
      </div>
    </div>
  </div>`;
}

function handleBecomeSellerCTA() {
  if (!window.currentUser) { showLoginPrompt('seller'); return; }
  const verSt = sellerVerification?.status || '';
  if (userRole === 'seller' && verSt === 'approved') showPage('seller-dashboard');
  else { showPage('profile'); setTimeout(() => openSellerVerificationModal(), 150); }
}

// ─── SELLER DASHBOARD ───
function renderSellerDashboard() {
  if (!window.currentUser) { showLoginPrompt('seller'); showPage('profile'); return; }
  const verSt = sellerVerification?.status || '';
  if (verSt === 'approved') userRole = 'seller';
  if (userRole !== 'seller' && verSt !== 'approved') { showPage('profile'); openSellerVerificationModal(); return; }
  const sellerStatus = sellerVerification?.status || 'pending';
  if (sellerStatus === 'rejected') {
    document.getElementById('sellerDisplayName').textContent = window.currentUser.displayName || 'Seller';
    const statusEl = document.getElementById('sellerVerificationStatus');
    statusEl.style.cssText = 'background:#fee2e2;color:#b91c1c;';
    statusEl.textContent = '❌ Verification Rejected';
    document.getElementById('sellerTabContent').innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 24px;text-align:center;min-height:300px">
        <div style="font-size:64px;margin-bottom:16px">❌</div>
        <div style="font-family:var(--font-head);font-size:20px;font-weight:800;color:var(--text);margin-bottom:8px">Verification Rejected</div>
        <div style="font-size:14px;color:var(--text2);line-height:1.6;margin-bottom:20px">Documents accept nahi hue. Sahi documents ke saath dobara apply karo.</div>
        <button onclick="showPage('profile');openSellerVerificationModal()" style="background:var(--primary);color:#fff;font-size:14px;font-weight:800;padding:13px 28px;border-radius:12px;border:none;cursor:pointer">🔄 Reapply Now</button>
      </div>`;
    return;
  }
  if (sellerStatus === 'pending') {
    document.getElementById('sellerDisplayName').textContent = window.currentUser.displayName || 'Seller';
    const statusEl = document.getElementById('sellerVerificationStatus');
    statusEl.style.cssText = 'background:#fef3c7;color:#92400e;';
    statusEl.textContent = '⏳ Pending Verification';
    document.querySelectorAll('.seller-tab-item').forEach(item => {
      const allowed = ['overview', 'products', 'add-product'].includes(item.dataset.tab);
      item.style.opacity = allowed ? '1' : '0.35';
      item.style.pointerEvents = allowed ? 'auto' : 'none';
      item.classList.toggle('active', item.dataset.tab === (window._sellerActiveTab || 'overview'));
      item.onclick = allowed ? () => {
        document.querySelectorAll('.seller-tab-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        window._sellerActiveTab = item.dataset.tab;
        renderSellerTab(item.dataset.tab);
      } : null;
    });
    const tab = window._sellerActiveTab || 'overview';
    if (tab === 'add-product') {
      const myProds = sellerProducts.filter(p => p.sellerId === window.currentUser?.uid);
      const slotsLeft = Math.max(0, 5 - myProds.length);
      if (slotsLeft <= 0) {
        document.getElementById('sellerTabContent').innerHTML = `
          <div style="padding:40px 20px;text-align:center">
            <div style="font-size:48px;margin-bottom:12px">🔒</div>
            <div style="font-family:var(--font-head);font-size:18px;font-weight:800;color:var(--text);margin-bottom:8px">Product Limit Reached</div>
            <div style="font-size:14px;color:var(--text2)">Pending verification mein max 5 products allowed hain. Approval ke baad unlimited list kar sakte ho!</div>
          </div>`;
      } else { renderAddProductFormWithLimit(slotsLeft); }
    } else if (tab === 'products') { renderMyProducts(); }
    else { renderOverview(); }
    return;
  }
  document.getElementById('sellerDisplayName').textContent = window.currentUser.displayName || 'Seller';
  const statusEl = document.getElementById('sellerVerificationStatus');
  statusEl.style.cssText = 'background:#dcfce7;color:#166534;';
  statusEl.textContent = '✅ Verified Seller';
  const activeTab = window._sellerActiveTab || 'overview';
  document.querySelectorAll('.seller-tab-item').forEach(item => {
    item.classList.toggle('active', item.dataset.tab === activeTab);
    item.onclick = () => {
      document.querySelectorAll('.seller-tab-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      window._sellerActiveTab = item.dataset.tab;
      renderSellerTab(item.dataset.tab);
    };
  });
  renderSellerTab(activeTab);
}

function renderSellerTab(tab) {
  switch(tab) {
    case 'overview': renderOverview(); break;
    case 'products': renderMyProducts(); break;
    case 'add-product': renderAddProductFormWithLimit(5); break;
    case 'earnings': renderEarnings(); break;
    case 'withdraw': renderWithdrawPage(); break;
    case 'profile': renderSellerSettings(); break;
  }
}

function renderOverview() {
  const myEarnings = sellerEarnings.filter(e => e.sellerId === window.currentUser?.uid);
  const totalEarnings = myEarnings.reduce((sum, t) => sum + t.net_earning, 0);
  const available = myEarnings.filter(t => t.status === 'available').reduce((s, t) => s + t.net_earning, 0);
  const pending = myEarnings.filter(t => t.status === 'pending').reduce((s, t) => s + t.net_earning, 0);
  const totalProducts = sellerProducts.filter(p => p.sellerId === window.currentUser?.uid).length;
  const totalOrders = myEarnings.length;
  document.getElementById('sellerTabContent').innerHTML = `
    <div class="seller-section">
      <div class="seller-page-title">📊 Overview</div>
      <div class="seller-stat-grid">
        <div class="stat-card"><div class="stat-card-icon">💰</div><div class="stat-card-value">₹${totalEarnings.toFixed(0)}</div><div class="stat-card-label">Total Earnings</div></div>
        <div class="stat-card"><div class="stat-card-icon">✅</div><div class="stat-card-value">₹${available.toFixed(0)}</div><div class="stat-card-label">Available</div></div>
        <div class="stat-card"><div class="stat-card-icon">⏳</div><div class="stat-card-value">₹${pending.toFixed(0)}</div><div class="stat-card-label">Pending</div></div>
        <div class="stat-card"><div class="stat-card-icon">📦</div><div class="stat-card-value">${totalProducts}</div><div class="stat-card-label">Products</div></div>
        <div class="stat-card"><div class="stat-card-icon">🛒</div><div class="stat-card-value">${totalOrders}</div><div class="stat-card-label">Orders</div></div>
      </div>
      <div class="seller-card">
        <div class="seller-card-header">Recent Transactions</div>
        ${myEarnings.slice(0, 5).map(t => `
          <div class="seller-tx-item">
            <div class="seller-tx-dot">🛒</div>
            <div class="seller-tx-info"><div class="seller-tx-name">${t.product_name}</div><div class="seller-tx-date">${new Date(t.date || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div></div>
            <div><div class="seller-tx-amount">₹${t.net_earning}</div><div style="font-size:10px;font-weight:700;padding:2px 6px;border-radius:10px;margin-top:3px;background:${t.status === 'available' ? '#dcfce7' : '#fef3c7'};color:${t.status === 'available' ? '#166534' : '#92400e'}">${t.status}</div></div>
          </div>`).join('') || '<div style="padding:20px;text-align:center;color:var(--text3);font-size:13px">No transactions yet</div>'}
      </div>
    </div>`;
}

function renderMyProducts() {
  const myProds = sellerProducts.filter(p => p.sellerId === window.currentUser?.uid);
  document.getElementById('sellerTabContent').innerHTML = `
    <div class="seller-section">
      <div class="seller-page-title">📦 My Products</div>
      <div class="seller-card">
        ${myProds.length ? myProds.map(p => `
          <div class="seller-prod-item">
            ${p.images?.[0] ? `<img src="${p.images[0]}" class="seller-prod-img" onerror="this.outerHTML='<div class=seller-prod-img-placeholder>📦</div>'">` : '<div class="seller-prod-img-placeholder">📦</div>'}
            <div class="seller-prod-info"><div class="seller-prod-name">${p.name}</div><div class="seller-prod-price">₹${Number(p.price).toLocaleString()}</div><span class="seller-prod-status prod-status-${p.status}">${p.status}</span></div>
            <button class="seller-prod-del-btn" onclick="deleteProduct('${p.id}')">🗑</button>
          </div>`).join('') : '<div style="padding:30px;text-align:center;color:var(--text3);font-size:13px">No products yet. Add your first product!</div>'}
      </div>
    </div>`;
}

function deleteProduct(id) {
  sellerProducts = sellerProducts.filter(p => p.id !== id);
  PRODUCTS = PRODUCTS.filter(p => p.id !== id);
  saveSellerData();
  renderMyProducts();
  showToast('Product deleted', 'info');
}

function renderAddProductFormWithLimit(slotsLeft) {
  document.getElementById('sellerTabContent').innerHTML = `
    <div class="seller-section">
      <div style="background:#fef9e7;border:1.5px solid #f7c948;border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:12px;font-weight:700;color:#92400e">⚡ ${slotsLeft} product slot${slotsLeft !== 1 ? 's' : ''} remaining</div>
      <div class="seller-page-title">➕ Add Product</div>
      <div class="seller-card" style="padding:14px">
        <div style="font-size:12px;font-weight:800;color:var(--primary);margin-bottom:8px;text-transform:uppercase">📦 Product Details</div>
        <div class="seller-input-group" style="margin-bottom:10px"><label class="form-label">Product Name *</label><input type="text" id="prodName" placeholder="e.g. Nike Air Max 270" class="form-input"></div>
        <div class="seller-input-group" style="margin-bottom:10px"><label class="form-label">Category</label><select id="prodCategory" class="form-input" onchange="toggleSizeOptions()"><option value="mobiles">📱 Mobiles</option><option value="fashion">👗 Fashion</option><option value="shoes">👟 Shoes</option><option value="electronics">💻 Electronics</option><option value="audio">🎧 Audio</option><option value="home">🏠 Home</option><option value="beauty">💄 Beauty</option><option value="sports">⚽ Sports</option></select></div>
        <div class="seller-input-group" id="sizeGroupWrap" style="margin-bottom:10px;display:none"><label class="form-label">Available Sizes</label><div id="sizeOptionsRow" style="display:flex;flex-wrap:wrap;gap:8px"></div><div style="font-size:10px;color:var(--text3);margin-top:4px">Stock me jo sizes available hain unhe select karo</div></div>
        <div class="seller-input-group" style="margin-bottom:10px"><label class="form-label">Key Features (ek line me ek feature likho)</label><textarea id="prodFeatures" placeholder="100% Cotton&#10;Machine Washable&#10;Slim Fit" class="form-input" style="height:80px;resize:none"></textarea><div style="font-size:10px;color:var(--text3);margin-top:4px">Har feature naye line par — product page par "Key Highlights" me dikhega</div></div>
        <div class="seller-input-group" style="margin-bottom:10px"><label class="form-label">Description</label><textarea id="prodDesc" placeholder="Describe your product..." class="form-input" style="height:80px;resize:none"></textarea></div>
        <div class="seller-input-group" style="margin-bottom:10px"><label class="form-label">Product Images (up to 5)</label><input type="file" id="prodImages" accept="image/*" multiple class="form-input"></div>
        <div id="imagePreview" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"></div>
        <div class="seller-input-group" style="margin-bottom:16px"><label class="form-label">Stock Quantity *</label><input type="number" id="prodStock" placeholder="10" value="10" class="form-input"></div>
        <div style="font-size:12px;font-weight:800;color:var(--primary);margin-bottom:8px;text-transform:uppercase;border-top:1px solid var(--border);padding-top:14px">💰 Pricing</div>
        <div style="display:flex;gap:8px;margin-bottom:16px"><div class="seller-input-group" style="flex:1"><label class="form-label">MRP (₹) *</label><input type="number" id="prodMRP" placeholder="1200" class="form-input" oninput="updateProductCalc()"></div><div class="seller-input-group" style="flex:1"><label class="form-label">Selling Price (₹) *</label><input type="number" id="prodPrice" placeholder="1000" class="form-input" oninput="updateProductCalc()"></div></div>
        <div style="font-size:12px;font-weight:800;color:var(--primary);margin-bottom:8px;text-transform:uppercase;border-top:1px solid var(--border);padding-top:14px">🤝 Affiliate</div>
        <div class="seller-input-group" style="margin-bottom:16px"><label class="form-label">Affiliate Commission (%)</label><input type="number" id="prodAffiliateCommission" placeholder="5" value="5" min="0" max="50" class="form-input" oninput="updateProductCalc()"></div>
        <div style="font-size:12px;font-weight:800;color:var(--primary);margin-bottom:8px;text-transform:uppercase;border-top:1px solid var(--border);padding-top:14px">🪙 Buyer Rewards</div>
        <div class="seller-input-group" style="margin-bottom:16px"><label class="form-label">Buyer Coin Reward</label><input type="number" id="prodCoinReward" placeholder="50" value="50" min="0" class="form-input" oninput="updateProductCalc()"></div>
        <div style="font-size:12px;font-weight:800;color:var(--primary);margin-bottom:8px;text-transform:uppercase;border-top:1px solid var(--border);padding-top:14px">🚚 Shipping</div>
        <div class="seller-input-group" style="margin-bottom:16px"><label class="form-label">Weight (grams)</label><input type="number" id="prodWeight" placeholder="500" class="form-input"></div>
        <div style="font-size:12px;font-weight:800;color:var(--primary);margin-bottom:8px;text-transform:uppercase;border-top:1px solid var(--border);padding-top:14px">🏪 Product Status</div>
        <div class="seller-input-group" style="margin-bottom:16px"><select id="prodAvailability" class="form-input"><option value="active">✅ Active</option><option value="out_of_stock">🚫 Out of Stock</option></select></div>
        <div style="background:#f1f5f9;border-radius:10px;padding:12px 14px;margin-bottom:16px"><div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:12px;font-weight:800;color:var(--text)">🏢 Platform Fee</span><span style="font-size:13px;font-weight:800;color:var(--text3)">Fixed 10% 🔒</span></div><div style="font-size:11px;color:var(--text3);margin-top:4px">Apykart charges a fixed 10% platform fee on every successful order.</div></div>
        <div id="calcBox" style="background:linear-gradient(135deg,#eff6ff,#dbeafe);border:1.5px solid #bfdbfe;border-radius:12px;padding:14px;margin-bottom:16px"><div style="font-size:12px;font-weight:800;color:var(--primary);margin-bottom:8px">💡 Earnings Breakdown</div><div style="font-size:12px;color:var(--text3)">Enter Selling Price to see calculation</div></div>
        <button onclick="submitNewProductBtn()" class="form-submit-btn">🚀 Submit for Approval</button>
      </div>
    </div>`;
  document.getElementById('prodImages').addEventListener('change', previewImages);
  toggleSizeOptions();
}

function toggleSizeOptions() {
  const cat = document.getElementById('prodCategory')?.value;
  const wrap = document.getElementById('sizeGroupWrap');
  const row = document.getElementById('sizeOptionsRow');
  if (!wrap || !row) return;
  const sizes = { fashion: ['XS', 'S', 'M', 'L', 'XL', 'XXL'], shoes: ['6', '7', '8', '9', '10', '11', '12'] }[cat];
  if (!sizes) { wrap.style.display = 'none'; row.innerHTML = ''; return; }
  wrap.style.display = 'block';
  row.innerHTML = sizes.map(s => `<label style="display:flex;align-items:center;gap:5px;background:var(--bg);border:1.5px solid var(--border);border-radius:8px;padding:6px 10px;font-size:12px;font-weight:700;cursor:pointer"><input type="checkbox" value="${s}" class="prodSizeChk" style="accent-color:var(--primary)"> ${s}</label>`).join('');
}

function previewImages(e) {
  const files = e.target.files;
  const previewDiv = document.getElementById('imagePreview');
  if (!previewDiv) return;
  previewDiv.innerHTML = '';
  for (let file of files) {
    const url = URL.createObjectURL(file);
    const img = document.createElement('img');
    img.src = url;
    img.style.cssText = 'width:80px;height:80px;object-fit:cover;border-radius:8px;border:2px solid var(--border)';
    img.onload = () => URL.revokeObjectURL(url);
    previewDiv.appendChild(img);
  }
}

function updateProductCalc() {
  const price = parseFloat(document.getElementById('prodPrice')?.value) || 0;
  const commissionPct = parseFloat(document.getElementById('prodAffiliateCommission')?.value) || 0;
  const coins = parseFloat(document.getElementById('prodCoinReward')?.value) || 0;
  const box = document.getElementById('calcBox');
  if (!box) return;
  if (price <= 0) { box.innerHTML = `<div style="font-size:12px;font-weight:800;color:var(--primary);margin-bottom:8px">💡 Earnings Breakdown</div><div style="font-size:12px;color:var(--text3)">Enter Selling Price to see calculation</div>`; return; }
  const platformFee = price * 0.10;
  const affiliateAmt = price * (commissionPct / 100);
  const coinRate = window.COIN_TO_RUPEE || 0.10;
  const coinValue = coins * coinRate;
  const sellerReceives = Math.max(0, price - platformFee - affiliateAmt - coinValue);
  box.innerHTML = `
    <div style="font-size:12px;font-weight:800;color:var(--primary);margin-bottom:10px">💡 Earnings Breakdown</div>
    <div style="display:flex;flex-direction:column;gap:6px;font-size:12px">
      <div style="display:flex;justify-content:space-between"><span style="color:var(--text2)">Selling Price</span><span style="font-weight:700">₹${price.toFixed(0)}</span></div>
      <div style="display:flex;justify-content:space-between"><span style="color:var(--text2)">Platform Fee (10%)</span><span style="font-weight:700;color:var(--danger)">−₹${platformFee.toFixed(0)}</span></div>
      <div style="display:flex;justify-content:space-between"><span style="color:var(--text2)">Affiliate Commission (${commissionPct}%)</span><span style="font-weight:700;color:var(--danger)">−₹${affiliateAmt.toFixed(0)}</span></div>
      <div style="display:flex;justify-content:space-between"><span style="color:var(--text2)">Buyer Reward (${coins} coins)</span><span style="font-weight:700;color:var(--danger)">−₹${coinValue.toFixed(0)}</span></div>
      <div style="border-top:1px solid #bfdbfe;margin-top:4px;padding-top:8px;display:flex;justify-content:space-between"><span style="font-weight:800;color:var(--text)">Estimated You Receive</span><span style="font-weight:900;color:#166534;font-size:14px">₹${sellerReceives.toFixed(0)}</span></div>
    </div>`;
}

async function submitNewProductBtn() {
  if (!window.currentUser) { showToast('Pehle login karo bhai', 'warn'); return; }
  const name = (document.getElementById('prodName')?.value || '').trim();
  const mrp = parseFloat(document.getElementById('prodMRP')?.value || 0);
  const price = parseFloat(document.getElementById('prodPrice')?.value || 0);
  const desc = document.getElementById('prodDesc')?.value || '';
  const featuresRaw = document.getElementById('prodFeatures')?.value || '';
  const features = featuresRaw.split('\n').map(f => f.trim()).filter(Boolean).slice(0, 10);
  const sizes = Array.from(document.querySelectorAll('.prodSizeChk:checked')).map(c => c.value);
  const category = document.getElementById('prodCategory')?.value || 'all';
  const stock = parseInt(document.getElementById('prodStock')?.value) || 10;
  const affiliateCommission = parseFloat(document.getElementById('prodAffiliateCommission')?.value) || 0;
  const buyerCoinReward = parseInt(document.getElementById('prodCoinReward')?.value) || 0;
  const weightGrams = parseFloat(document.getElementById('prodWeight')?.value) || 0;
  const availabilityStatus = document.getElementById('prodAvailability')?.value || 'active';
  if (!name) { showToast('Product name dalo', 'warn'); return; }
  if (!mrp || mrp <= 0) { showToast('Valid MRP dalo', 'warn'); return; }
  if (!price || price <= 0) { showToast('Valid Selling Price dalo', 'warn'); return; }
  if (price > mrp) { showToast('Selling Price, MRP se zyada nahi ho sakti', 'warn'); return; }
  const discount = Math.round(((mrp - price) / mrp) * 100);
  const imageFiles = Array.from(document.getElementById('prodImages')?.files || []).slice(0, 5);
  const uid = getUid();
  const btn = document.querySelector('[onclick="submitNewProductBtn()"]');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Uploading images...'; }
  showToast('Images upload ho rahi hain...', 'info');
  let imageUrls = [];
  try {
    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      if (file.size > 5 * 1024 * 1024) { showToast(`Image ${i+1} 5MB se badi hai, skip kar raha hoon`, 'warn'); continue; }
      if (!file.type.startsWith('image/')) { showToast(`File ${i+1} image nahi hai`, 'warn'); continue; }
      const path = `images/${uid}/products/${Date.now()}_${i}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      if (window._uploadToStorage) {
        const url = await window._uploadToStorage(file, path, (pct) => { if (btn) btn.textContent = `⏳ Image ${i+1}/${imageFiles.length}: ${pct}%`; });
        if (url) imageUrls.push(url);
      }
    }
  } catch(e) { console.warn('Image upload error:', e.message); showToast('Image upload mein issue: ' + e.message, 'warn'); }
  if (btn) { btn.disabled = false; btn.textContent = '🚀 Submit for Approval'; }
  const prodId = 'sp_' + Date.now();
  const sellerNameResolved = window.currentUser?.displayName || guestUser?.name || window.currentUser?.email?.split('@')[0] || 'Seller';
  const newProduct = {
    id: prodId, name, ogPrice: mrp, price, discount, category, images: imageUrls, img: imageUrls[0] || '',
    desc, features, sizes, stock, affiliateCommission, buyerCoinReward, weightGrams, availabilityStatus,
    platformFeePct: 10, status: 'pending', approvalStatus: 'pending', submittedAt: new Date().toISOString(),
    sellerId: uid, sellerName: sellerNameResolved, sellerEmail: window.currentUser?.email || '',
    rating: 0, reviews: '0', coinsEarned: buyerCoinReward || 10, createdAt: new Date().toISOString()
  };
  if (uid && window._fsHelpers) {
    try {
      const { db, addDoc, collection, serverTimestamp } = window._fsHelpers;
      const ref = await addDoc(collection(db, 'products'), {...newProduct, createdAt: serverTimestamp(), submittedAt: serverTimestamp()});
      newProduct._fsId = ref.id; newProduct.id = ref.id;
    } catch(e) { console.warn('Firestore product add error:', e.message); }
  }
  sellerProducts.push(newProduct);
  saveSellerData();
  showToast('Product submit ho gaya! Approval ka wait karo ✅', 'success');
  document.querySelectorAll('.seller-tab-item').forEach(i => i.classList.toggle('active', i.dataset.tab === 'products'));
  window._sellerActiveTab = 'products';
  renderMyProducts();
}

function renderEarnings() {
  const myEarnings = sellerEarnings.filter(e => e.sellerId === window.currentUser?.uid);
  const available = myEarnings.filter(t => t.status === 'available').reduce((s, t) => s + t.net_earning, 0);
  const pending = myEarnings.filter(t => t.status === 'pending').reduce((s, t) => s + t.net_earning, 0);
  document.getElementById('sellerTabContent').innerHTML = `
    <div class="seller-section">
      <div class="seller-page-title">💰 Earnings</div>
      <div class="seller-stat-grid" style="margin-bottom:14px">
        <div class="stat-card"><div class="stat-card-icon">✅</div><div class="stat-card-value">₹${available.toFixed(0)}</div><div class="stat-card-label">Available</div></div>
        <div class="stat-card"><div class="stat-card-icon">⏳</div><div class="stat-card-value">₹${pending.toFixed(0)}</div><div class="stat-card-label">Pending</div></div>
      </div>
      <div class="seller-card">
        <div class="seller-card-header">Transaction History</div>
        ${myEarnings.length ? myEarnings.map(t => `
          <div class="seller-tx-item">
            <div class="seller-tx-dot">💸</div>
            <div class="seller-tx-info"><div class="seller-tx-name">${t.product_name}</div><div class="seller-tx-date">Order: ${t.order_id || '—'} · ${new Date(t.date || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div></div>
            <div style="text-align:right"><div class="seller-tx-amount">₹${t.net_earning}</div><div style="font-size:10px;margin-top:2px;font-weight:700;padding:2px 6px;border-radius:8px;background:${t.status === 'available' ? '#dcfce7' : '#fef3c7'};color:${t.status === 'available' ? '#166534' : '#92400e'}">${t.status}</div></div>
          </div>`).join('') : '<div style="padding:30px;text-align:center;color:var(--text3);font-size:13px">No earnings yet</div>'}
      </div>
    </div>`;
}

function renderWithdrawPage() {
  const myEarnings = sellerEarnings.filter(e => e.sellerId === window.currentUser?.uid && e.status === 'available');
  const available = myEarnings.reduce((s, t) => s + t.net_earning, 0);
  const myWithdrawals = withdrawalRequests.filter(w => w.sellerId === window.currentUser?.uid);
  document.getElementById('sellerTabContent').innerHTML = `
    <div class="seller-section">
      <div class="seller-page-title">🏦 Withdraw</div>
      <div class="seller-withdraw-bar">
        <div><div style="font-size:11px;color:var(--text3);font-weight:600;margin-bottom:2px">Available Balance</div><div class="seller-withdraw-amount">₹${available.toFixed(2)}</div></div>
        <button class="btn-withdraw" onclick="openWithdrawModal()">Withdraw →</button>
      </div>
      <div class="seller-card">
        <div class="seller-card-header">Withdrawal History</div>
        ${myWithdrawals.length ? myWithdrawals.map(w => `
          <div class="seller-tx-item">
            <div class="seller-tx-dot" style="background:#e8f0fe">🏦</div>
            <div class="seller-tx-info"><div class="seller-tx-name">₹${w.amount} Withdrawal</div><div class="seller-tx-date">${new Date(w.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div></div>
            <div style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:8px;background:${w.status === 'completed' ? '#dcfce7' : w.status === 'rejected' ? '#fee2e2' : '#fef3c7'};color:${w.status === 'completed' ? '#166534' : w.status === 'rejected' ? '#b91c1c' : '#92400e'}">${w.status}</div>
          </div>`).join('') : '<div style="padding:30px;text-align:center;color:var(--text3);font-size:13px">No withdrawal requests yet</div>'}
      </div>
    </div>`;
}

function openWithdrawModal() {
  const available = sellerEarnings.filter(e => e.sellerId === window.currentUser?.uid && e.status === 'available').reduce((s, t) => s + t.net_earning, 0);
  document.getElementById('modalPortal').innerHTML = `
    <div class="modal-overlay" onclick="closeModal()">
      <div class="modal-sheet" onclick="event.stopPropagation()">
        <div class="modal-handle"></div>
        <div class="modal-header"><div class="modal-title">Request Withdrawal</div><div class="modal-close" onclick="closeModal()">✕</div></div>
        <div class="modal-body">
          <p>Available: ₹${available.toFixed(2)}</p>
          <input type="number" id="withdrawAmount" placeholder="Enter amount" class="form-input">
          <button class="form-submit-btn" onclick="submitWithdrawal()">Submit Request</button>
        </div>
      </div>
    </div>`;
}

function submitWithdrawal() {
  const amount = parseFloat(document.getElementById('withdrawAmount').value);
  const available = sellerEarnings.filter(e => e.sellerId === window.currentUser?.uid && e.status === 'available').reduce((s, t) => s + t.net_earning, 0);
  if (isNaN(amount) || amount <= 0 || amount > available) { showToast('Invalid amount', 'warn'); return; }
  withdrawalRequests.push({ id: 'wd_' + Date.now(), amount, status: 'pending', sellerId: window.currentUser.uid, date: new Date().toISOString() });
  saveWithdrawals();
  closeModal();
  showToast('Withdrawal request submitted!', 'success');
  renderWithdrawPage();
}

function saveWithdrawals() { firestoreSetField('withdrawals', withdrawalRequests); }

function renderSellerSettings() {
  document.getElementById('sellerTabContent').innerHTML = `
    <div class="seller-section">
      <div class="seller-page-title">⚙️ Settings</div>
      <div class="seller-card" style="padding:14px">
        <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:12px">🏦 Bank Details</div>
        <div class="seller-input-group" style="margin-bottom:10px"><label class="form-label">Bank Name</label><input type="text" id="bankName" value="${sellerProfile.bankName || ''}" placeholder="e.g. SBI, HDFC" class="form-input"></div>
        <div class="seller-input-group" style="margin-bottom:10px"><label class="form-label">Account Number</label><input type="text" id="accountNumber" value="${sellerProfile.accountNumber || ''}" placeholder="Account number" class="form-input"></div>
        <div class="seller-input-group" style="margin-bottom:10px"><label class="form-label">IFSC Code</label><input type="text" id="ifsc" value="${sellerProfile.ifsc || ''}" placeholder="e.g. SBIN0001234" class="form-input"></div>
        <div class="seller-input-group" style="margin-bottom:14px"><label class="form-label">UPI ID</label><input type="text" id="upi" value="${sellerProfile.upi || ''}" placeholder="yourname@upi" class="form-input"></div>
        <button onclick="saveSellerSettingsBtn()" class="form-submit-btn">💾 Save Settings</button>
      </div>
    </div>`;
}

function saveSellerSettingsBtn() {
  sellerProfile = {
    bankName: document.getElementById('bankName')?.value || '',
    accountNumber: document.getElementById('accountNumber')?.value || '',
    ifsc: document.getElementById('ifsc')?.value || '',
    upi: document.getElementById('upi')?.value || ''
  };
  saveSellerProfile();
  showToast('Settings saved! ✅', 'success');
}

function saveSellerProfile() { firestoreSetField('seller_profile', sellerProfile); }

// ─── HELP ───
function renderHelp() {
  const faqs = [
    { q: 'How do I track my order?', a: 'Go to Profile → My Orders. You can see real-time status and tracking for all your orders. We also send WhatsApp confirmation after every order.' },
    { q: 'Can I cancel my order?', a: 'Yes! You can cancel orders in "Placed" or "Confirmed" status. Go to My Orders and tap Cancel. Note: −10 coins cancel penalty + earned coins reversed. For returns: −15 coins penalty applies.' },
    { q: 'What is Cash on Delivery (COD)?', a: 'COD means you pay in cash when your order is delivered to your doorstep. We do not charge any extra fee for COD orders.' },
    { q: 'How do I earn ApyCoins?', a: 'You earn 10 ApyCoins on every successful order. Referrals give 100 coins each. Coins can be redeemed for discounts once you have 1,000+ coins.' },
    { q: 'What is the return policy?', a: 'We offer 7-day returns on most products. Simply go to My Orders, tap Return on the delivered order, and select your reason. Our team will arrange a pickup.' },
    { q: 'How do I become a seller?', a: 'Tap "Become a Seller" on your Profile page. Submit your Aadhaar/PAN card for verification. Once approved, you can list products and earn directly to your bank account.' },
  ];
  document.getElementById('helpContent').innerHTML = `
    <div style="padding:0 0 24px">
      <div style="margin:14px 12px;background:linear-gradient(135deg,#2874f0,#3b8aff);border-radius:16px;padding:20px 18px">
        <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,.75);letter-spacing:1px;text-transform:uppercase;margin-bottom:5px">We're here for you</div>
        <div style="font-family:var(--font-head);font-size:20px;font-weight:800;color:#fff;margin-bottom:4px">How can we help? 🤝</div>
        <div style="font-size:13px;color:rgba(255,255,255,.8)">Average response time: <strong style="color:#fff">under 2 hours</strong></div>
      </div>
      <div style="padding:0 12px;margin-bottom:4px">
        <div style="font-family:var(--font-head);font-size:14px;font-weight:700;color:var(--text);margin-bottom:10px">📞 Contact Us Directly</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <a href="https://wa.me/919999999999?text=Hi%20Apykart%20Support%2C%20I%20need%20help%20with%20my%20order." target="_blank" style="display:flex;flex-direction:column;align-items:center;gap:6px;background:#dcfce7;border:1.5px solid #86efac;border-radius:14px;padding:16px 12px;text-decoration:none;cursor:pointer">
            <div style="font-size:28px">💬</div><div style="font-size:13px;font-weight:800;color:#166534">WhatsApp</div><div style="font-size:11px;color:#16a34a;font-weight:600">Fastest response</div>
          </a>
          <a href="mailto:support@apykart.in?subject=Support%20Request" style="display:flex;flex-direction:column;align-items:center;gap:6px;background:#e8f0fe;border:1.5px solid #a8c0f8;border-radius:14px;padding:16px 12px;text-decoration:none;cursor:pointer">
            <div style="font-size:28px">📧</div><div style="font-size:13px;font-weight:800;color:#1d4ed8">Email Us</div><div style="font-size:11px;color:#2563eb;font-weight:600">support@apykart.in</div>
          </a>
          <a href="tel:+919999999999" style="display:flex;flex-direction:column;align-items:center;gap:6px;background:#fff7ed;border:1.5px solid #fed7aa;border-radius:14px;padding:16px 12px;text-decoration:none;cursor:pointer">
            <div style="font-size:28px">📞</div><div style="font-size:13px;font-weight:800;color:#c2410c">Call Us</div><div style="font-size:11px;color:#ea580c;font-weight:600">Mon–Sat, 9am–7pm</div>
          </a>
        </div>
      </div>
      <div style="padding:18px 12px 0">
        <div style="font-family:var(--font-head);font-size:14px;font-weight:700;color:var(--text);margin-bottom:10px">🙋 Frequently Asked Questions</div>
        <div id="faqList">${faqs.map((f, i) => `
          <div class="faq-item" id="faq${i}" onclick="toggleFaq(${i})" style="background:#fff;border-radius:12px;margin-bottom:8px;border:1.5px solid var(--border);overflow:hidden;cursor:pointer">
            <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px">
              <div style="font-size:13px;font-weight:700;color:var(--text);flex:1;line-height:1.4">${f.q}</div>
              <div id="faqArrow${i}" style="font-size:18px;color:var(--primary);font-weight:300;margin-left:8px;transition:transform .25s;flex-shrink:0">+</div>
            </div>
            <div id="faqAns${i}" style="display:none;padding:0 16px 14px">
              <div style="font-size:13px;color:var(--text2);line-height:1.7;border-top:1px solid var(--border);padding-top:12px">${f.a}</div>
            </div>
          </div>`).join('')}</div>
      </div>
      <div style="margin:12px 12px 0;background:#f8faff;border:1.5px solid var(--border);border-radius:14px;padding:16px">
        <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:10px">🕐 Support Hours</div>
        ${[['Monday – Friday', '9:00 AM – 7:00 PM', '✅'], ['Saturday', '10:00 AM – 5:00 PM', '✅'], ['Sunday', 'Closed', '❌']].map(([day, time, status]) => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--border)">
          <div style="font-size:13px;font-weight:600;color:var(--text)">${day}</div>
          <div style="display:flex;align-items:center;gap:6px"><div style="font-size:12px;color:var(--text2)">${time}</div><div>${status}</div></div>
        </div>`).join('')}
      </div>
      <div style="height:20px"></div>
    </div>`;
}

function toggleFaq(i) {
  const ans = document.getElementById('faqAns' + i);
  const arrow = document.getElementById('faqArrow' + i);
  const isOpen = ans.style.display === 'block';
  document.querySelectorAll('[id^="faqAns"]').forEach(el => el.style.display = 'none');
  document.querySelectorAll('[id^="faqArrow"]').forEach(el => { el.textContent = '+'; el.style.transform = 'rotate(0deg)'; });
  if (!isOpen) { ans.style.display = 'block'; arrow.textContent = '−'; arrow.style.transform = 'rotate(0deg)'; }
}

// ─── RATE ───
let _selectedRating = 0;

function renderRate() {
  const stored = window._userRating || null;
  document.getElementById('rateContent').innerHTML = `
    <div style="padding:20px 16px 40px;display:flex;flex-direction:column;align-items:center">
      <div style="width:90px;height:90px;background:linear-gradient(135deg,#1a5ec7,#3b8aff);border-radius:24px;display:flex;align-items:center;justify-content:center;margin-bottom:14px;box-shadow:0 8px 28px rgba(40,116,240,.35)">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
      </div>
      <div style="font-family:var(--font-head);font-size:22px;font-weight:800;color:var(--text);margin-bottom:4px">Apykart</div>
      <div style="font-size:13px;color:var(--text3);font-weight:600;margin-bottom:24px">Shop Smarter · Save Better</div>
      ${stored ? `
      <div style="background:linear-gradient(135deg,#fef9e7,#fffbec);border:1.5px solid #f7c948;border-radius:16px;padding:22px 24px;text-align:center;width:100%;margin-bottom:20px">
        <div style="font-size:40px;margin-bottom:8px">⭐</div>
        <div style="font-family:var(--font-head);font-size:18px;font-weight:800;color:#92400e;margin-bottom:4px">You rated us ${stored.rating} stars!</div>
        <div style="font-size:13px;color:#b45309;margin-bottom:14px">Thank you for your feedback 🙏</div>
        <div style="display:flex;justify-content:center;gap:6px;font-size:36px;margin-bottom:4px">${'⭐'.repeat(stored.rating)}${'☆'.repeat(5 - stored.rating)}</div>
        ${stored.review ? `<div style="margin-top:12px;font-size:13px;color:var(--text2);font-style:italic;line-height:1.5">"${stored.review}"</div>` : ''}
      </div>
      <button onclick="window._userRating = null; firestoreSetField('app_rating', null); renderRate()" style="background:var(--bg);color:var(--text2);font-size:13px;font-weight:700;padding:11px 24px;border-radius:10px;border:1.5px solid var(--border);cursor:pointer">Edit My Review</button>
      ` : `
      <div style="font-family:var(--font-head);font-size:16px;font-weight:700;color:var(--text);margin-bottom:16px;text-align:center">How was your experience?</div>
      <div style="display:flex;gap:10px;margin-bottom:6px" id="starRow">${[1, 2, 3, 4, 5].map(n => `<div onclick="setRating(${n})" id="star${n}" style="font-size:44px;cursor:pointer;transition:transform .15s;line-height:1" onmouseover="hoverRating(${n})" onmouseout="resetHover()">☆</div>`).join('')}</div>
      <div id="ratingLabel" style="font-size:13px;font-weight:700;color:var(--text3);margin-bottom:20px;min-height:20px"></div>
      <div style="width:100%;margin-bottom:16px"><div style="font-size:13px;font-weight:700;color:var(--text2);margin-bottom:8px">Write a review (optional)</div><textarea id="reviewText" placeholder="Tell us what you love, or how we can improve..." style="width:100%;background:var(--bg);border:1.5px solid var(--border);border-radius:12px;padding:12px 14px;font-size:13px;font-weight:600;color:var(--text);outline:none;height:100px;resize:none;font-family:var(--font-body);line-height:1.6"></textarea></div>
      <div style="width:100%;background:#f0f9ff;border:1.5px solid #bae6fd;border-radius:12px;padding:14px;margin-bottom:20px"><div style="font-size:12px;font-weight:800;color:#0369a1;margin-bottom:8px">✨ Recently Improved</div>${['Faster loading & smooth navigation', 'New Seller Dashboard for entrepreneurs', 'ApyCoins loyalty reward system', '7-day hassle-free returns'].map(i => `<div style="font-size:12px;color:#0c4a6e;padding:3px 0;display:flex;align-items:center;gap:6px"><span style="color:#0ea5e9">✓</span>${i}</div>`).join('')}</div>
      <button onclick="submitRating()" style="width:100%;background:linear-gradient(135deg,#2874f0,#3b8aff);color:#fff;font-size:14px;font-weight:800;padding:15px;border-radius:14px;border:none;cursor:pointer;box-shadow:0 6px 20px rgba(40,116,240,.35)">⭐ Submit My Review</button>
      `}
      <div style="width:100%;display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:20px">${[['4.8★', 'App Rating'], ['50K+', 'Downloads'], ['12K+', 'Reviews']].map(([v, l]) => `<div style="background:#fff;border:1.5px solid var(--border);border-radius:12px;padding:14px 10px;text-align:center"><div style="font-family:var(--font-head);font-size:18px;font-weight:800;color:var(--primary)">${v}</div><div style="font-size:11px;color:var(--text3);font-weight:600;margin-top:3px">${l}</div></div>`).join('')}</div>
    </div>`;
  _selectedRating = stored ? stored.rating : 0;
}

function hoverRating(n) { [1,2,3,4,5].forEach(i => { document.getElementById('star'+i).textContent = i <= n ? '⭐' : '☆'; }); }
function resetHover() { [1,2,3,4,5].forEach(i => { document.getElementById('star'+i).textContent = i <= _selectedRating ? '⭐' : '☆'; }); }
function setRating(n) { _selectedRating = n; const labels = ['', '😕 Poor', '😐 Fair', '🙂 Good', '😊 Great', '🤩 Excellent!']; document.getElementById('ratingLabel').textContent = labels[n] || ''; resetHover(); }

function submitRating() {
  if (!_selectedRating) { showToast('Please select a star rating', 'warn'); return; }
  const review = document.getElementById('reviewText')?.value.trim() || '';
  window._userRating = { rating: _selectedRating, review, date: new Date().toISOString() };
  firestoreSetField('app_rating', window._userRating);
  addCoins(50, '⭐ App review bonus');
  showToast('Thank you for your review! +50 coins credited 🪙', 'coin');
  renderRate();
}

// ─── TERMS ───
function renderTerms() {
  const sections = [
    { title: '1. Acceptance of Terms', icon: '📋', body: 'By accessing or using the Apykart platform — including our website, mobile application, and related services — you agree to be bound by these Terms & Conditions. If you do not agree with any part of these terms, you must discontinue use of our services immediately. Apykart reserves the right to modify these terms at any time. Continued use following any modification constitutes acceptance of the updated terms.' },
    { title: '2. Eligibility', icon: '👤', body: 'You must be at least 18 years of age to use Apykart\'s services, or have the consent of a parent or legal guardian. By using the platform, you represent and warrant that you meet this eligibility requirement. Apykart reserves the right to terminate accounts of users found to be underage without prior notice.' },
    { title: '3. Account & Security', icon: '🔐', body: 'You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. Immediately notify Apykart of any unauthorized use of your account. We use Google OAuth for secure authentication. Apykart will never ask for your password via email, phone, or chat.' },
    { title: '4. Orders & Payments', icon: '🛒', body: 'All orders placed on Apykart are subject to availability and confirmation. We currently offer Cash on Delivery (COD) as our primary payment method. Prices are listed in Indian Rupees (₹) and are inclusive of applicable taxes. Apykart reserves the right to cancel any order due to pricing errors, stock unavailability, or suspected fraud.' },
    { title: '5. Delivery Policy', icon: '🚚', body: 'Estimated delivery timelines are 2–5 business days within India. Delivery times may vary based on location, product availability, and circumstances beyond our control such as natural disasters or government restrictions. Apykart is not liable for delays caused by third-party logistics partners.' },
    { title: '6. Returns & Refunds', icon: '↩️', body: 'Apykart offers a 7-day return window from the date of delivery for most products. Items must be unused, in original packaging, and accompanied by proof of purchase. Refunds are processed within 5–7 business days of successful pickup. Certain categories including personal care, innerwear, and perishables are non-returnable.' },
    { title: '7. ApyCoins & Rewards', icon: '🪙', body: 'ApyCoins are a loyalty reward currency issued by Apykart. They hold no monetary value outside the platform. Coins cannot be transferred, sold, or exchanged for cash. Apykart reserves the right to modify the earning or redemption rate of coins without prior notice. Coins expire after 12 months of account inactivity.' },
    { title: '8. Seller Policy', icon: '🏪', body: 'Sellers on Apykart must complete identity verification using government-issued documents. By listing products, sellers certify that they are the legal owner or authorized distributor of the listed goods. Apykart charges a 10% commission on each sale. Sellers are prohibited from listing counterfeit, illegal, or restricted goods. Violations result in immediate account suspension.' },
  ];
  document.getElementById('termsContent').innerHTML = `
    <div style="padding:0 0 30px">
      <div style="margin:14px 12px;background:linear-gradient(135deg,#1e2a3b,#2d3f55);border-radius:16px;padding:20px 18px">
        <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,.6);letter-spacing:1px;text-transform:uppercase;margin-bottom:5px">Legal Document</div>
        <div style="font-family:var(--font-head);font-size:19px;font-weight:800;color:#fff;margin-bottom:4px">Terms & Conditions</div>
        <div style="font-size:12px;color:rgba(255,255,255,.6)">Last updated: <strong style="color:rgba(255,255,255,.9)">January 1, 2025</strong> · Version 2.1</div>
      </div>
      <div style="margin:0 12px 12px;background:#fef3c7;border:1.5px solid #f7c948;border-radius:12px;padding:12px 14px;display:flex;gap:10px;align-items:flex-start">
        <div style="font-size:20px;flex-shrink:0">⚠️</div>
        <div style="font-size:12px;color:#92400e;font-weight:600;line-height:1.6">Please read these terms carefully. By using Apykart, you agree to all terms listed below. These terms constitute a legally binding agreement.</div>
      </div>
      <div style="padding:0 12px">${sections.map((s, i) => `
        <div onclick="toggleTerms(${i})" style="background:#fff;border-radius:12px;margin-bottom:8px;border:1.5px solid var(--border);overflow:hidden;cursor:pointer">
          <div style="display:flex;align-items:center;gap:10px;padding:14px 16px">
            <div style="font-size:20px;flex-shrink:0">${s.icon}</div>
            <div style="font-size:13px;font-weight:700;color:var(--text);flex:1;line-height:1.4">${s.title}</div>
            <div id="tArrow${i}" style="font-size:18px;color:var(--primary);font-weight:300;flex-shrink:0;transition:transform .25s">+</div>
          </div>
          <div id="tBody${i}" style="display:none;padding:0 16px 14px"><div style="font-size:13px;color:var(--text2);line-height:1.8;border-top:1px solid var(--border);padding-top:12px">${s.body}</div></div>
        </div>`).join('')}</div>
      <div style="margin:4px 12px;background:#f8faff;border:1.5px solid var(--border);border-radius:14px;padding:16px">
        <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:6px">📬 Legal Inquiries</div>
        <div style="font-size:12px;color:var(--text2);line-height:1.7">For legal notices or compliance matters, please contact our legal team at <strong style="color:var(--primary)">legal@apykart.in</strong> or write to:<br><br><strong>Apykart Technologies Pvt. Ltd.</strong><br>New Delhi, India – 110001</div>
      </div>
      <div style="height:20px"></div>
    </div>`;
}

function toggleTerms(i) {
  const body = document.getElementById('tBody' + i);
  const arrow = document.getElementById('tArrow' + i);
  const isOpen = body.style.display === 'block';
  document.querySelectorAll('[id^="tBody"]').forEach(el => el.style.display = 'none');
  document.querySelectorAll('[id^="tArrow"]').forEach(el => el.textContent = '+');
  if (!isOpen) { body.style.display = 'block'; arrow.textContent = '−'; }
}

// ─── ABOUT ───
function renderAbout() {
  document.getElementById('aboutContent').innerHTML = `
    <div style="padding:0 0 30px">
      <div style="margin:14px 12px;background:linear-gradient(135deg,#ff6b35 0%,#f7c948 100%);border-radius:18px;padding:24px 20px;text-align:center">
        <div style="width:72px;height:72px;background:rgba(255,255,255,.25);border-radius:20px;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;border:2px solid rgba(255,255,255,.4)">
          <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
        </div>
        <div style="font-family:var(--font-head);font-size:28px;font-weight:900;color:#fff;letter-spacing:-1px">apykart</div>
        <div style="font-size:13px;color:rgba(255,255,255,.9);font-weight:600;margin-top:4px">Shop Smarter · Save Better · Earn More</div>
      </div>
      <div style="padding:0 12px;margin-bottom:14px">
        <div style="background:#fff;border-radius:14px;border:1.5px solid var(--border);padding:18px">
          <div style="font-size:13px;font-weight:800;color:var(--primary);text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px">🎯 Our Mission</div>
          <div style="font-size:14px;color:var(--text);line-height:1.8;font-weight:600">To democratize e-commerce in India by empowering every buyer to <strong>save more</strong> and every seller to <strong>earn more</strong> — through a transparent, rewarding, and delightful shopping experience.</div>
        </div>
      </div>
      <div style="padding:0 12px;margin-bottom:14px">
        <div style="font-family:var(--font-head);font-size:14px;font-weight:700;color:var(--text);margin-bottom:10px">📊 Apykart in Numbers</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">${[['50K+', 'App Downloads', '🔽'], ['500+', 'Cities Covered', '📍'], ['12K+', 'Happy Customers', '😊'], ['200+', 'Verified Sellers', '🏪'], ['4.8★', 'App Rating', '⭐'], ['<2hr', 'Support Response', '💬']].map(([v, l, e]) => `
          <div style="background:#fff;border:1.5px solid var(--border);border-radius:14px;padding:16px 14px;display:flex;align-items:center;gap:10px">
            <div style="font-size:26px">${e}</div>
            <div><div style="font-family:var(--font-head);font-size:18px;font-weight:800;color:var(--primary)">${v}</div><div style="font-size:11px;color:var(--text3);font-weight:600;margin-top:2px">${l}</div></div>
          </div>`).join('')}</div>
      </div>
      <div style="margin:0 12px;background:linear-gradient(135deg,#1e2a3b,#2d3f55);border-radius:16px;padding:20px">
        <div style="font-size:13px;font-weight:800;color:rgba(255,255,255,.9);margin-bottom:12px">📬 Get in Touch</div>
        ${[['🌐', 'Website', 'apykart.vercel.app'], ['📧', 'Email', 'apykartbusiness@gmail.com'], ['📍', 'Office', 'Uttar Pradesh, India – 211013'], ['📞', 'Phone', '+91 6392550611']].map(([e, l, v]) => `
        <div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.1)">
          <div style="font-size:18px;width:26px">${e}</div>
          <div style="font-size:12px;color:rgba(255,255,255,.5);font-weight:600;min-width:56px">${l}</div>
          <div style="font-size:12px;color:rgba(255,255,255,.9);font-weight:700">${v}</div>
        </div>`).join('')}
        <div style="margin-top:14px;font-size:11px;color:rgba(255,255,255,.4);text-align:center">© 2025 Apykart Technologies Pvt. Ltd. All rights reserved.</div>
      </div>
      <div style="height:20px"></div>
    </div>`;
}

// ─── VIDEO UPLOAD ───
function openVideoUpload() {
  if (!window.currentUser) { showLoginPrompt('video'); return; }
  _uploadStep = 1;
  _uploadVideoFile = null;
  _uploadVideoDataUrl = null;
  _uploadSelectedProductId = null;
  showPage('upload-video');
}

let _uploadStep = 1;
let _uploadVideoFile = null;
let _uploadVideoDataUrl = null;
let _uploadSelectedProductId = null;

function renderVideoUpload() {
  const cont = document.getElementById('uploadVideoContent');
  if (!cont) return;
  const steps = ['Select Video', 'Details', 'Product', 'Publish'];
  const stepsHTML = steps.map((s, i) => `<div class="upload-step-tab ${i + 1 === _uploadStep ? 'active' : i + 1 < _uploadStep ? 'done' : ''}" onclick="${i + 1 < _uploadStep ? `_uploadStep=${i + 1};renderVideoUpload()` : ''}">${i + 1 < _uploadStep ? '✓ ' : ''} ${s}</div>`).join('');
  let bodyHTML = '';
  if (_uploadStep === 1) {
    bodyHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:55vh;gap:0">
        ${!_uploadVideoDataUrl ? `
          <div style="display:flex;flex-direction:column;align-items:center;gap:20px">
            <div style="width:96px;height:96px;border-radius:50%;background:linear-gradient(135deg,#f97316,#ea580c);display:flex;align-items:center;justify-content:center;box-shadow:0 8px 28px rgba(249,115,22,.35)">
              <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M8 10l4 2-4 2V10z"/><line x1="2" y1="7" x2="22" y2="7"/></svg>
            </div>
            <div style="text-align:center"><div style="font-family:var(--font-head);font-size:20px;font-weight:800;color:var(--text);margin-bottom:6px">Choose your Video</div><div style="font-size:13px;color:var(--text3);font-weight:500">MP4, MOV • 15–60 sec recommended</div></div>
            <button onclick="document.getElementById('videoFileInput').click()" style="background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;font-size:15px;font-weight:800;padding:15px 40px;border-radius:99px;border:none;cursor:pointer;box-shadow:0 6px 20px rgba(249,115,22,.4)">📂 Choose from Gallery</button>
            <input type="file" id="videoFileInput" accept="video/*" style="display:none" onchange="handleVideoSelect(this)">
          </div>
        ` : `
          <div style="width:100%">
            <video src="${_uploadVideoDataUrl}" muted playsinline style="width:100%;max-height:220px;object-fit:cover;border-radius:14px;display:block"></video>
            <div style="display:flex;gap:10px;margin-top:14px">
              <button onclick="_uploadVideoDataUrl=null;_uploadVideoFile=null;renderVideoUpload()" style="flex:1;background:#fee2e2;color:#b91c1c;font-size:13px;font-weight:700;padding:13px;border-radius:12px;border:none;cursor:pointer">✕ Change</button>
              <button onclick="_uploadStep=2;renderVideoUpload()" style="flex:2;background:var(--primary);color:#fff;font-size:14px;font-weight:800;padding:13px;border-radius:12px;border:none;cursor:pointer;box-shadow:0 4px 14px rgba(37,99,235,.3)">Continue →</button>
            </div>
          </div>
        `}
      </div>
    `;
  } else if (_uploadStep === 2) {
    bodyHTML = `
      <div style="display:flex;flex-direction:column;gap:12px">
        <div><label style="font-size:12px;font-weight:700;color:var(--text2);display:block;margin-bottom:5px">Video Title *</label><input class="form-input" id="vUploadTitle" maxlength="150" oninput="document.getElementById('vTitleCount').textContent=this.value.length+'/150'" placeholder="E.g. Best earbuds under ₹2000!" value="${window._vTitle || ''}"><div id="vTitleCount" style="text-align:right;font-size:11px;color:var(--text3);margin-top:3px">${(window._vTitle || '').length}/150</div></div>
        <div><label style="font-size:12px;font-weight:700;color:var(--text2);display:block;margin-bottom:5px">Description</label><textarea class="form-input" id="vUploadDesc" placeholder="Tell viewers about this product..." rows="3" style="resize:none">${window._vDesc || ''}</textarea></div>
        <div><label style="font-size:12px;font-weight:700;color:var(--text2);display:block;margin-bottom:5px">Tags (optional, max 5)</label><input class="form-input" id="vUploadTags" placeholder="earbuds, wireless, budget" value="${window._vTags || ''}"></div>
        <button onclick="window._vTitle=document.getElementById('vUploadTitle').value;window._vDesc=document.getElementById('vUploadDesc').value;window._vTags=document.getElementById('vUploadTags').value;if(!window._vTitle){showToast('Title zaroor daalo','warn');return;}_uploadStep=3;renderVideoUpload()" style="background:var(--primary);color:#fff;font-size:14px;font-weight:800;padding:14px;border-radius:12px;border:none;cursor:pointer;margin-top:4px">Next: Attach Product →</button>
      </div>
    `;
  } else if (_uploadStep === 3) {
    const approvedProds = PRODUCTS.filter(p => !p.status || p.status === 'approved' || p.status === 'active').slice(0, 20);
    bodyHTML = `
      <div style="margin-bottom:12px"><div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:4px">⚠️ Product attachment is mandatory</div><div style="font-size:12px;color:var(--text2)">Your video must showcase this product to be approved.</div></div>
      <div style="display:flex;flex-direction:column;gap:8px">${approvedProds.map(p => { const fi = (Array.isArray(p.images) && p.images[0]) || p.img || ''; const sel = _uploadSelectedProductId === String(p.id); return `<div onclick="_uploadSelectedProductId='${p.id}';renderVideoUpload()" style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:10px;border:1.5px solid ${sel ? 'var(--primary)' : 'var(--border)'};background:${sel ? 'var(--primary-light)' : '#fff'};cursor:pointer">
        <div style="width:44px;height:44px;border-radius:8px;overflow:hidden;background:#f8fafc;flex-shrink:0">${fi ? `<img src="${fi}" style="width:100%;height:100%;object-fit:contain;padding:3px">` : '<span style="font-size:22px;margin:auto;display:flex;align-items:center;justify-content:center;height:100%">📦</span>'}</div>
        <div style="flex:1"><div style="font-size:13px;font-weight:700;color:var(--text)">${p.name}</div><div style="font-size:12px;color:var(--text2);font-weight:600">₹${Number(p.price).toLocaleString()}</div></div>
        ${sel ? '<span style="font-size:18px">✅</span>' : ''}
      </div>`; }).join('')}</div>
      <button onclick="if(!_uploadSelectedProductId){showToast('Product select karo','warn');return;}_uploadStep=4;renderVideoUpload()" style="width:100%;background:var(--primary);color:#fff;font-size:14px;font-weight:800;padding:14px;border-radius:12px;border:none;cursor:pointer;margin-top:16px">Next: Publish →</button>
    `;
  } else if (_uploadStep === 4) {
    const prod = findProd(_uploadSelectedProductId);
    bodyHTML = `
      <div style="text-align:center;padding:20px 0"><div style="font-size:48px;margin-bottom:12px">🚀</div><div style="font-family:var(--font-head);font-size:18px;font-weight:800;color:var(--text);margin-bottom:8px">Ready to Upload!</div><div style="font-size:13px;color:var(--text2);margin-bottom:20px">Your video will be reviewed by admin before going live on the feed.</div></div>
      <div style="background:#f8fafc;border-radius:12px;padding:14px;margin-bottom:20px;border:1px solid var(--border)">
        <div style="font-size:12px;font-weight:700;color:var(--text2);margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px">Upload Summary</div>
        <div style="display:flex;flex-direction:column;gap:7px">
          <div style="display:flex;justify-content:space-between"><span style="font-size:12px;color:var(--text3)">Title</span><span style="font-size:12px;font-weight:700;color:var(--text);text-align:right;max-width:60%">${window._vTitle || '—'}</span></div>
          <div style="display:flex;justify-content:space-between"><span style="font-size:12px;color:var(--text3)">Product</span><span style="font-size:12px;font-weight:700;color:var(--primary)">${prod ? prod.name : '—'}</span></div>
          <div style="display:flex;justify-content:space-between"><span style="font-size:12px;color:var(--text3)">Status</span><span style="font-size:12px;font-weight:700;color:#92400e;background:#fef3c7;padding:2px 8px;border-radius:5px">Pending Review</span></div>
        </div>
      </div>
      <button onclick="submitVideoUpload()" style="width:100%;background:linear-gradient(135deg,var(--accent),#ea580c);color:#fff;font-size:15px;font-weight:800;padding:15px;border-radius:12px;border:none;cursor:pointer;box-shadow:0 4px 16px rgba(249,115,22,.4)">⚡ Submit for Review</button>
    `;
  }
  cont.innerHTML = `<div style="overflow-x:auto;display:flex;padding:0 16px;gap:0;border-bottom:1px solid var(--border);scrollbar-width:none">${stepsHTML}</div><div style="flex:1;overflow-y:auto;padding:16px;padding-bottom:20px">${bodyHTML}</div>`;
}

function handleVideoSelect(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 100 * 1024 * 1024) { showToast('Video 100MB se chhota hona chahiye', 'warn'); return; }
  _uploadVideoFile = file;
  _uploadVideoDataUrl = URL.createObjectURL(file);
  renderVideoUpload();
}

async function submitVideoUpload() {
  if (!_uploadVideoFile) { showToast('Pehle video select karo', 'warn'); return; }
  if (!_uploadSelectedProductId) { showToast('Product select karo', 'warn'); return; }
  const prod = findProd(_uploadSelectedProductId);
  const uid = getUid();
  const name = window.currentUser?.displayName || guestUser.name || 'Anonymous';
  const btn = document.querySelector('[onclick="submitVideoUpload()"]');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Uploading...'; }
  let videoUrl = '';
  try {
    showToast('Video upload shuru... ⏳', 'info');
    const folder = `videos/${uid}`;
    videoUrl = await uploadVideo(_uploadVideoFile, folder, (pct) => { if (btn) btn.textContent = `⏳ ${pct}% uploaded...`; });
    showToast('Video upload complete! ✅', 'success');
  } catch(e) {
    showToast('Upload failed: ' + e.message, 'warn');
    if (btn) { btn.disabled = false; btn.textContent = '⚡ Submit for Review'; }
    return;
  }
  if (!videoUrl) { showToast('Video URL nahi mila, dobara try karo', 'warn'); if (btn) { btn.disabled = false; btn.textContent = '⚡ Submit for Review'; } return; }
  const newVid = {
    id: 'vid_' + Date.now(),
    title: window._vTitle || 'Untitled',
    description: window._vDesc || '',
    tags: (window._vTags || '').split(',').map(t => t.trim()).filter(Boolean),
    productId: _uploadSelectedProductId,
    productName: prod ? prod.name : '',
    price: prod ? prod.price : 0,
    ogPrice: prod ? (prod.ogPrice || prod.price) : 0,
    videoUrl: videoUrl,
    thumbnailUrl: '',
    status: 'pending',
    uploaderName: name,
    uploaderUid: uid || 'guest',
    uploadedAt: new Date().toISOString(),
    views: 0,
    likes: 0
  };
  if (uid && window._fsHelpers) {
    try {
      const { db, addDoc, collection, serverTimestamp } = window._fsHelpers;
      const ref = await addDoc(collection(db, 'videos'), {...newVid, uploadedAt: serverTimestamp(), createdAt: serverTimestamp()});
      newVid.id = ref.id;
      newVid._fsId = ref.id;
    } catch(e) { console.warn('Firestore save error:', e.message); }
  }
  userVideos.unshift(newVid);
  saveUserVideos();
  window._vTitle = '';
  window._vDesc = '';
  window._vTags = '';
  _uploadVideoFile = null;
  _uploadVideoDataUrl = null;
  _uploadSelectedProductId = null;
  if (btn) { btn.disabled = false; btn.textContent = '⚡ Submit for Review'; }
  showToast('Video submit ho gaya! Admin approve karega ⏳', 'success');
  showPage('my-videos');
}

function saveUserVideos() { firestoreSetField('user_videos', userVideos); }

// ─── MY VIDEOS ───
function renderMyVideos() {
  const cont = document.getElementById('myVideosContent');
  if (!cont) return;
  const name = window.currentUser?.displayName || guestUser.name || 'Creator';
  const photo = window.currentUser?.photoURL;
  const avatarHTML = photo ? `<img src="${photo}" style="width:100%;height:100%;object-fit:cover;border-radius:14px">` : `<span style="font-size:26px">${name.charAt(0).toUpperCase() || '👤'}</span>`;
  const uid = getUid();
  const fsVidMap = {};
  (window._approvedVideos || []).forEach(v => { fsVidMap[v._fsId || v.id] = v; });
  const approvedVids = userVideos.filter(v => v.status === 'approved');
  const pendingVids = userVideos.filter(v => v.status === 'pending');
  const totalViews = approvedVids.reduce((s, v) => { const fsV = fsVidMap[v.id] || fsVidMap[v._fsId] || {}; return s + (Number(fsV.views) || Number(v.views) || 0); }, 0);
  const uid2 = getUid() || window.currentUser?.uid;
  const myRealEarnings = sellerEarnings.filter(e => e.sellerId === uid2 || e.sellerId === uid);
  const totalSales = myRealEarnings.length;
  const totalEarnings = myRealEarnings.reduce((s, e) => s + (Number(e.net_earning) || 0), 0);
  const now = Date.now();
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const monthAgo = now - 30 * 24 * 60 * 60 * 1000;
  const todayEarn = myRealEarnings.filter(e => new Date(e.date || e.createdAt?.seconds * 1000 || 0) >= todayStart).reduce((s, e) => s + (Number(e.net_earning) || 0), 0);
  const weekEarn = myRealEarnings.filter(e => new Date(e.date || e.createdAt?.seconds * 1000 || 0).getTime() >= weekAgo).reduce((s, e) => s + (Number(e.net_earning) || 0), 0);
  const monthEarn = myRealEarnings.filter(e => new Date(e.date || e.createdAt?.seconds * 1000 || 0).getTime() >= monthAgo).reduce((s, e) => s + (Number(e.net_earning) || 0), 0);
  cont.innerHTML = `
    <div class="creator-header-wrap">
      <div class="creator-profile-row">
        <div class="creator-avatar">${avatarHTML}</div>
        <div class="creator-info"><div class="creator-name">${name}</div><div class="creator-badge"><svg width="10" height="10" viewBox="0 0 24 24" fill="#fb923c"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg><span class="creator-badge-text">VIDEO CREATOR</span></div></div>
        <div class="sub-page-back" onclick="showPage('profile')" style="width:36px;height:36px;background:rgba(255,255,255,.12);border-radius:10px;display:flex;align-items:center;justify-content:center;cursor:pointer;border:1px solid rgba(255,255,255,.2)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </div>
      </div>
      <div class="creator-earnings-big"><div class="creator-earn-label">💰 Total Earnings</div><div class="creator-earn-amount">₹${monthEarn.toLocaleString()}</div><div class="creator-earn-sub">${totalSales} sales · ${totalViews.toLocaleString()} views</div></div>
      <div class="creator-stats-grid">
        <div class="creator-stat-card"><div class="creator-stat-val">${userVideos.length}</div><div class="creator-stat-label">Videos</div></div>
        <div class="creator-stat-card"><div class="creator-stat-val">${approvedVids.length}</div><div class="creator-stat-label">Live</div></div>
        <div class="creator-stat-card"><div class="creator-stat-val">${pendingVids.length}</div><div class="creator-stat-label">Pending</div></div>
      </div>
    </div>
    <div class="creator-body">
      <div class="creator-section-title">📊 Earnings Breakdown</div>
      <div class="creator-earn-breakdown">
        <div class="creator-earn-period"><div class="creator-earn-period-amt">₹${todayEarn}</div><div class="creator-earn-period-label">Today</div></div>
        <div class="creator-earn-period"><div class="creator-earn-period-amt">₹${weekEarn}</div><div class="creator-earn-period-label">This Week</div></div>
        <div class="creator-earn-period"><div class="creator-earn-period-amt">₹${monthEarn}</div><div class="creator-earn-period-label">This Month</div></div>
      </div>
      <div class="creator-section-title">🎬 My Videos</div>
      ${userVideos.length === 0 ? `
        <div style="background:#fff;border:1.5px dashed var(--border);border-radius:14px;padding:40px 20px;text-align:center">
          <div style="font-size:48px;margin-bottom:10px">🎬</div>
          <div style="font-family:var(--font-head);font-size:17px;font-weight:700;color:var(--text);margin-bottom:6px">No Videos Yet</div>
          <div style="font-size:13px;color:var(--text2);margin-bottom:16px">Upload your first product video and start earning real money!</div>
          <button onclick="openVideoUpload()" style="background:var(--accent);color:#fff;font-size:13px;font-weight:800;padding:12px 24px;border-radius:12px;border:none;cursor:pointer">🎬 Upload First Video</button>
        </div>
      ` : `
        <div class="creator-video-list">${userVideos.map((v, i) => {
          const prod = findProd(v.productId);
          const fsV = fsVidMap[v.id] || fsVidMap[v._fsId] || {};
          const vViews = Number(fsV.views) || Number(v.views) || 0;
          const videoProductId = v.productId || v._productId || '';
          const vidRealEarns = sellerEarnings.filter(e => e.product_id === videoProductId && (e.sellerId === uid || e.sellerId === getUid()));
          const vSales = vidRealEarns.length;
          const vEarn = Math.floor(vidRealEarns.reduce((s, e) => s + (Number(e.net_earning) || 0), 0));
          return `<div class="creator-video-card" onclick="previewMyVideo(${i})">
            <div class="creator-video-thumb">
              ${(v.videoUrl || v.videoDataUrl) ? `<video src="${v.videoUrl || v.videoDataUrl}" muted playsinline preload="metadata" class="creator-video-thumb-bg" onerror="this.style.display='none'"></video>` : `<div style="position:absolute;inset:0;background:linear-gradient(135deg,#0f172a,#1e3a8a);display:flex;align-items:center;justify-content:center;font-size:24px">🎬</div>`}
              <div class="creator-video-thumb-overlay"><svg width="18" height="18" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg></div>
              <div style="position:absolute;top:4px;left:4px" class="my-video-status ${v.status}">${v.status === 'pending' ? '⏳' : v.status === 'approved' ? '✅' : '❌'}</div>
            </div>
            <div class="creator-video-details">
              <div class="creator-video-title">${v.title || 'Untitled Video'}</div>
              <div style="font-size:10px;font-weight:700;color:var(--primary);margin-bottom:5px">${prod ? prod.name : v.productName || '—'}</div>
              <div class="creator-video-meta"><div class="creator-video-stat">👁 ${vViews.toLocaleString()}</div><div class="creator-video-stat">🛒 ${vSales} sales</div></div>
              ${v.status === 'approved' ? `<div class="creator-video-earn">+₹${vEarn} earned</div>` : ''}
              ${v.status === 'pending' ? `<div style="font-size:10px;color:#92400e;font-weight:600">⏳ Under review</div>` : ''}
              ${v.status === 'rejected' ? `<div style="font-size:10px;color:#b91c1c;font-weight:600">❌ Rejected</div>` : ''}
            </div>
          </div>`;
        }).join('')}</div>
      `}
      <div style="background:linear-gradient(135deg,#eff6ff,#dbeafe);border:1px solid #bfdbfe;border-radius:14px;padding:14px 16px;margin-top:4px">
        <div style="font-family:var(--font-head);font-size:13px;font-weight:800;color:var(--primary);margin-bottom:8px">💡 Earn More Tips</div>
        <div style="font-size:12px;color:var(--text2);display:flex;flex-direction:column;gap:5px">
          <div>✅ Tag products clearly in your video</div>
          <div>✅ Use trending hashtags & good lighting</div>
          <div>✅ Upload 3+ videos to 3× your reach</div>
          <div>✅ 12% commission on every sale via your video</div>
        </div>
      </div>
    </div>
    <button class="creator-upload-fab" onclick="openVideoUpload()">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
    </button>
  `;
}

function previewMyVideo(idx) {
  const v = userVideos[idx];
  if (!v) return;
  const prod = findProd(v.productId);
  document.getElementById('modalPortal').innerHTML = `
    <div class="modal-overlay" onclick="closeModal()">
      <div class="modal-sheet" onclick="event.stopPropagation()" style="border-radius:22px 22px 0 0">
        <div class="modal-handle"></div>
        <div class="modal-header"><div class="modal-title">${v.title}</div><div class="modal-close" onclick="closeModal()">✕</div></div>
        <div class="modal-body">
          ${(v.videoUrl || v.videoDataUrl) ? `<video src="${v.videoUrl || v.videoDataUrl}" controls playsinline style="width:100%;border-radius:10px;max-height:240px;object-fit:cover;background:#000;display:block;margin-bottom:12px"></video>` : ''}
          <div style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:6px">Product: <strong style="color:var(--primary)">${prod ? prod.name : v.productName || '—'}</strong></div>
          <div style="font-size:12px;color:var(--text3)">${v.description || ''}</div>
          <div style="display:flex;align-items:center;gap:8px;margin-top:12px"><span class="my-video-status ${v.status}" style="position:static;font-size:11px">${v.status === 'pending' ? '⏳ Pending Review' : v.status === 'approved' ? '✅ Approved & Live' : '❌ Rejected'}</span></div>
          ${v.status === 'pending' ? `<div style="margin-top:10px;padding:10px;background:#fef9e7;border-radius:8px;font-size:12px;color:#92400e">Admin review mein hai. Approved hone ke baad feed mein show hoga.</div>` : ''}
          <button onclick="deleteMyVideo('${v.id}');closeModal()" style="width:100%;margin-top:14px;background:#fee2e2;color:#b91c1c;font-size:13px;font-weight:700;padding:11px;border-radius:10px;border:none;cursor:pointer">🗑️ Delete Video</button>
        </div>
      </div>
    </div>`;
}

function deleteMyVideo(id) {
  userVideos = userVideos.filter(v => v.id !== id);
  saveUserVideos();
  renderMyVideos();
  showToast('Video deleted', 'info');
}

// ─── XPLOR ───
function renderXplor(videoId = null) {
  const cont = document.getElementById('xplorContent');
  if (!cont) return;
  const fsVideos = (window._approvedVideos || []).map(v => ({
    id: v.id || v._fsId,
    creator: v.uploaderName || v.creatorName || 'Creator',
    creatorEmoji: '🎬',
    videoSrc: v.videoUrl || v.videoDataUrl || v.url || '',
    thumb: v.thumbnailUrl || v.thumb || '',
    productId: v.productId || '',
    productName: v.productName || '',
    price: Number(v.price) || 0,
    ogPrice: Number(v.ogPrice) || 0,
    desc: v.description || v.title || '',
    views: Number(v.views) || 0,
    _fsId: v._fsId || v.id
  }));
  _xplorVideos = fsVideos;
  if (!_xplorVideos.length) { cont.innerHTML = `<div class="xplor-empty">No videos yet</div>`; return; }
  let targetIdx = 0;
  if (videoId) { const found = _xplorVideos.findIndex(v => v.id === videoId || v._fsId === videoId); if (found !== -1) targetIdx = found; }
  _xplorIdx = targetIdx;
  _xplorBuildFeed();
  _xplorInitSwipe(cont);
}

function _xplorBuildFeed() {
  const cont = document.getElementById('xplorContent');
  if (!cont) return;
  const oldWrapper = document.getElementById('xplorWrapper');
  if (oldWrapper) oldWrapper.remove();
  const contH = cont.clientHeight;
  if (contH <= 0) return;
  const wrapper = document.createElement('div');
  wrapper.id = 'xplorWrapper';
  wrapper.style.cssText = `position:absolute;top:0;left:0;width:100%;height:${_xplorVideos.length * contH}px;transition:transform 0.4s cubic-bezier(0.25,0.46,0.45,0.94);will-change:transform;`;
  _xplorVideos.forEach((v, i) => {
    const slide = document.createElement('div');
    slide.className = 'xplor-slide';
    slide.style.cssText = `position:relative;width:100%;height:${contH}px;background:#000;overflow:hidden;`;
    slide.innerHTML = _xplorSlideHTML(v, i);
    wrapper.appendChild(slide);
  });
  cont.appendChild(wrapper);
  _xplorDoScroll(_xplorIdx, false);
}

function _xplorSlideHTML(v, i) {
  const discount = v.ogPrice > v.price ? Math.round((v.ogPrice - v.price) / v.ogPrice * 100) : 0;
  return `
    ${v.videoSrc ? `<video id="xvid_${i}" src="${v.videoSrc}" loop playsinline muted style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;" onerror="this.style.display='none'"></video>` : v.thumb ? `<img src="${v.thumb}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block">` : `<div style="position:absolute;inset:0;background:linear-gradient(135deg,#0f172a,#1e3a8a);display:flex;align-items:center;justify-content:center;font-size:64px">🎬</div>`}
    <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.88) 0%,rgba(0,0,0,.1) 35%,rgba(0,0,0,.05) 60%,rgba(0,0,0,.3) 100%);pointer-events:none"></div>
    <div style="position:absolute;top:14px;left:14px;right:14px;display:flex;align-items:center;justify-content:space-between;pointer-events:none">
      <div style="display:flex;align-items:center;gap:8px"><div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#f97316,#ec4899);display:flex;align-items:center;justify-content:center;font-size:15px;border:2px solid rgba(255,255,255,.4);flex-shrink:0">${v.creatorEmoji || '🎬'}</div><div style="font-size:13px;font-weight:700;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.5)">${v.creator || 'Creator'}</div></div>
      <div style="background:rgba(0,0,0,.4);backdrop-filter:blur(6px);color:#fff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:99px;border:1px solid rgba(255,255,255,.15)">${i + 1}/${_xplorVideos.length}</div>
    </div>
    <div id="xplayicon_${i}" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;opacity:0;transition:opacity .2s">
      <div style="width:64px;height:64px;background:rgba(0,0,0,.55);backdrop-filter:blur(8px);border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid rgba(255,255,255,.5)">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      </div>
    </div>
    <div style="position:absolute;bottom:130px;right:12px;display:flex;flex-direction:column;gap:18px;align-items:center;z-index:15">
      <div onclick="xplorLike(${i})" style="display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="${_xplorLiked[i] ? '#ef4444' : 'none'}" stroke="${_xplorLiked[i] ? '#ef4444' : 'white'}" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        <span style="font-size:10px;font-weight:700;color:rgba(255,255,255,.9)">Like</span>
      </div>
      <div onclick="shareXplorVideo('${v.id}','${v.productId}')" style="display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
        <span style="font-size:10px;font-weight:700;color:rgba(255,255,255,.9)">Share</span>
      </div>
      <div onclick="showPage('detail','${v.productId}')" style="display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        <span style="font-size:10px;font-weight:700;color:rgba(255,255,255,.9)">${v.views || 0}</span>
      </div>
    </div>
    <div style="position:absolute;bottom:0;left:0;right:0;padding:0 14px 14px;z-index:15">
      <div style="margin-bottom:10px">
        ${v.productName ? `<div style="font-family:var(--font-head);font-size:16px;font-weight:800;color:#fff;margin-bottom:4px;text-shadow:0 2px 8px rgba(0,0,0,.5);max-width:75%">${v.productName}</div>` : ''}
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          ${v.price ? `<span style="font-size:15px;font-weight:800;color:#fff">₹${Number(v.price).toLocaleString()}</span>` : ''}
          ${discount > 0 ? `<span style="background:#f97316;color:#fff;font-size:10px;font-weight:800;padding:2px 8px;border-radius:99px">${discount}% OFF</span>` : ''}
          ${v.ogPrice > v.price ? `<span style="font-size:12px;color:rgba(255,255,255,.55);text-decoration:line-through">₹${Number(v.ogPrice).toLocaleString()}</span>` : ''}
        </div>
        ${v.desc ? `<div id="xdesc_${i}" style="display:none;font-size:12px;color:rgba(255,255,255,.85);margin-top:6px;max-width:85%;background:rgba(0,0,0,.35);padding:8px 10px;border-radius:8px;line-height:1.5">${v.desc}</div>` : ''}
      </div>
      <div style="display:flex;gap:8px">
        <button onclick="addToCart('${v.productId}');showToast('Added to cart! 🛒','success')" style="flex:1;background:rgba(255,255,255,.18);backdrop-filter:blur(12px);border:1.5px solid rgba(255,255,255,.35);color:#fff;font-size:13px;font-weight:800;padding:12px 10px;border-radius:12px;cursor:pointer">🛒 Add to Cart</button>
        <button onclick="buyNow('${v.productId}')" style="flex:1;background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;font-size:13px;font-weight:800;padding:12px 10px;border-radius:12px;border:none;cursor:pointer;box-shadow:0 4px 16px rgba(249,115,22,.45)">⚡ Buy Now</button>
      </div>
    </div>
  `;
}

function _xplorDoScroll(idx, animate) {
  if (idx < 0 || idx >= _xplorVideos.length) return;
  _xplorIdx = idx;
  const wrapper = document.getElementById('xplorWrapper');
  const cont = document.getElementById('xplorContent');
  if (!wrapper || !cont) return;
  const contH = cont.clientHeight;
  if (contH <= 0) return;
  _xplorIsAnimating = true;
  wrapper.style.transition = animate ? 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none';
  wrapper.style.transform = `translateY(-${idx * contH}px)`;
  if (animate) { setTimeout(() => { _xplorIsAnimating = false; }, 400); } else { _xplorIsAnimating = false; }
  _xplorVideos.forEach((v, i) => {
    const vid = document.getElementById('xvid_' + i);
    if (!vid) return;
    if (i === idx) { vid.muted = _xplorMuted; vid.currentTime = 0; vid.play().catch(() => {}); } 
    else { vid.pause(); vid.currentTime = 0; }
  });
}

function _xplorInitSwipe(cont) {
  let startY = 0, startTime = 0, isDragging = false, lastY = 0;
  if (cont._xplorCleanup) cont._xplorCleanup();
  const onTouchStart = (e) => { if (_xplorIsAnimating) return; startY = e.touches[0].clientY; lastY = startY; startTime = Date.now(); isDragging = false; const wrapper = document.getElementById('xplorWrapper'); if (wrapper) wrapper.style.transition = 'none'; };
  const onTouchMove = (e) => { if (_xplorIsAnimating || startY === 0) return; const currentY = e.touches[0].clientY; const diff = currentY - startY; lastY = currentY; if (Math.abs(diff) > 10) { isDragging = true; e.preventDefault(); const wrapper = document.getElementById('xplorWrapper'); const contH = cont.clientHeight; if (wrapper && contH > 0) { const baseTransform = -_xplorIdx * contH; const newTransform = baseTransform + diff; const maxTransform = 0; const minTransform = -(_xplorVideos.length - 1) * contH; let finalTransform; if (newTransform > maxTransform) finalTransform = maxTransform + (newTransform - maxTransform) * 0.3; else if (newTransform < minTransform) finalTransform = minTransform + (newTransform - minTransform) * 0.3; else finalTransform = newTransform; wrapper.style.transform = `translateY(${finalTransform}px)`; } } };
  const onTouchEnd = (e) => { if (startY === 0) return; const diff = lastY - startY; const dt = Date.now() - startTime; const contH = cont.clientHeight; const velocity = Math.abs(diff) / dt; const threshold = contH * 0.15; const shouldChange = Math.abs(diff) > threshold || (Math.abs(diff) > 30 && velocity > 0.5); if (shouldChange) { if (diff < 0 && _xplorIdx < _xplorVideos.length - 1) _xplorDoScroll(_xplorIdx + 1, true); else if (diff > 0 && _xplorIdx > 0) _xplorDoScroll(_xplorIdx - 1, true); else _xplorDoScroll(_xplorIdx, true); } else { _xplorDoScroll(_xplorIdx, true); } startY = 0; lastY = 0; isDragging = false; };
  cont.addEventListener('touchstart', onTouchStart, { passive: false });
  cont.addEventListener('touchmove', onTouchMove, { passive: false });
  cont.addEventListener('touchend', onTouchEnd, { passive: false });
  let wheelAccumulator = 0, wheelTimeout;
  const onWheel = (e) => { e.preventDefault(); if (_xplorIsAnimating) return; wheelAccumulator += e.deltaY; clearTimeout(wheelTimeout); wheelTimeout = setTimeout(() => { if (Math.abs(wheelAccumulator) > 50) { if (wheelAccumulator > 0 && _xplorIdx < _xplorVideos.length - 1) _xplorDoScroll(_xplorIdx + 1, true); else if (wheelAccumulator < 0 && _xplorIdx > 0) _xplorDoScroll(_xplorIdx - 1, true); } wheelAccumulator = 0; }, 150); };
  cont.addEventListener('wheel', onWheel, { passive: false });
  cont._xplorCleanup = () => { cont.removeEventListener('touchstart', onTouchStart); cont.removeEventListener('touchmove', onTouchMove); cont.removeEventListener('touchend', onTouchEnd); cont.removeEventListener('wheel', onWheel); };
}

function xplorLike(idx) {
  _xplorLiked[idx] = !_xplorLiked[idx];
  if (_xplorLiked[idx]) showToast('❤️ Liked!', 'success');
}

function shareXplorVideo(vid, productId) {
  const url = `https://apykart.vercel.app?video=${vid}&product=${productId}`;
  if (navigator.clipboard) { navigator.clipboard.writeText(url).then(() => showToast('Link copied!', 'success')); } 
  else { const ta = document.createElement('textarea'); ta.value = url; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); showToast('Link copied!', 'success'); }
}

// ─── DETAIL ───
function renderDetail(id) {
  const p = findProd(id);
  if (!p) return;
  const wished = wishlist.includes(p.id) || wishlist.includes(p._fid);
  const cartItem = cart.find(i => i.id === id || i.id == id);
  const inQty = cartItem ? cartItem.qty : 0;
  const media = getProductMedia(p);
  const heartFilled = `<svg viewBox="0 0 24 24" fill="#000" stroke="#000" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
  const heartEmpty = `<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
  const shareIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`;
  const swiperHTML = buildSwiperWithBtns(media, p.discount, p.id, wished ? heartFilled : heartEmpty);
  document.getElementById('detailContent').innerHTML = `
    <div class="detail-back" onclick="showPage('${prevPage || 'home'}')"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg> Back</div>
    ${swiperHTML}
    <div class="detail-info">
      ${p.brand ? `<div class="detail-brand" style="display:flex;align-items:center;gap:4px"><span style="width:6px;height:6px;background:var(--primary);border-radius:50%;display:inline-block"></span> ${p.brand}</div>` : ''}
      <div class="detail-title">${p.name}</div>
      <div class="detail-rating-row">
        <div class="detail-rating-chip">★ ${p.rating}</div>
        <div style="font-size:12px;color:var(--text3);font-weight:600">${p.reviews} Ratings & Reviews</div>
        <div style="flex:1"></div>
        <div onclick="shareProduct('${p.id}')" style="width:32px;height:32px;border-radius:9px;background:var(--primary-light);border:1px solid var(--primary-mid);display:flex;align-items:center;justify-content:center;cursor:pointer">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
        </div>
      </div>
      <div class="detail-price-section">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
          <div class="detail-price-row" style="margin-bottom:0"><div class="detail-price">₹${Number(p.price).toLocaleString()}</div>${p.ogPrice > p.price ? `<div class="detail-og-price">₹${Number(p.ogPrice).toLocaleString()}</div>` : ''}</div>
          ${p.discount > 0 ? `<div style="background:#16a34a;color:#fff;font-size:12px;font-weight:800;padding:4px 10px;border-radius:99px">${p.discount}% OFF</div>` : ''}
        </div>
        ${p.ogPrice > p.price ? `<div style="display:flex;align-items:center;gap:6px"><span style="font-size:12px;color:#15803d;font-weight:700">🏷️ You save ₹${(p.ogPrice - p.price).toLocaleString()}</span><span style="font-size:11px;color:var(--text3)">incl. all taxes</span></div>` : ''}
      </div>
      ${(p.sizes || []).length ? `<div class="chip-row" style="margin:0 0 4px">${p.sizes.map(s => `<div class="chip">Size: ${s}</div>`).join('')}</div>` : ''}
      ${(p.features || []).length ? `<div style="margin:0 0 14px;padding:14px;background:#f8faff;border-radius:12px;border:1px solid var(--border)"><div class="detail-feat-title" style="margin-bottom:10px">⚡ Key Highlights</div>${p.features.map(f => `<div class="detail-feat-item">${f}</div>`).join('')}</div>` : ''}
      <div style="margin-bottom:14px"><div class="detail-desc-title" style="margin-bottom:8px">📝 About this Product</div><div class="detail-desc">${p.desc || ''}</div></div>
    </div>`;
  initSwiperTouch();
  document.getElementById('detailCta').innerHTML = inQty > 0 ? `<div style="flex:1;display:flex;align-items:center;gap:8px;background:var(--primary-light);border-radius:var(--radius-sm);padding:10px 14px"><span style="font-size:13px;font-weight:700;color:var(--primary);flex:1">In Cart (${inQty})</span><button class="qty-btn" onclick="updateQty('${p.id}',-1)">−</button><div class="qty-val">${inQty}</div><button class="qty-btn" onclick="updateQty('${p.id}',1)">+</button></div><button class="btn-buy-now" onclick="buyNow('${p.id}')">⚡ Buy Now</button>` : `<button class="btn-add-cart" onclick="addToCart('${p.id}')">🛒 Add to Cart</button><button class="btn-buy-now" onclick="buyNow('${p.id}')">⚡ Buy Now</button>`;
}

function getProductMedia(p) {
  const media = [];
  const imgs = Array.isArray(p.images) && p.images.length ? p.images : (p.img ? [p.img] : []);
  imgs.forEach(src => { if (src) media.push({ type: 'image', src }); });
  if (p.video) media.push({ type: 'video', src: p.video });
  return media;
}

function buildSwiperWithBtns(media, discount, pid, heartHTML) {
  if (!media.length) return `<div class="media-swiper-wrap" style="height:280px;position:relative"><div style="display:flex;align-items:center;justify-content:center;height:100%;background:linear-gradient(160deg,#dce8ff,#eef4ff)"><div style="font-size:80px">📦</div></div>${discount > 0 ? `<div class="detail-discount-badge">-${discount}%</div>` : ''}<button class="detail-wishlist" onclick="toggleWishlistDetail('${pid}')" id="wishBtn${pid}">${heartHTML}</button><button class="detail-share-btn" onclick="shareProduct('${pid}')"><svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg></button></div>`;
  const slides = media.map((m, i) => {
    if (m.type === 'video') return `<div class="media-slide"><video id="prodVideo_${i}" src="${m.src}" playsinline preload="metadata" loop style="width:100%;height:100%;object-fit:cover;display:block;background:#000"></video><div class="media-play-overlay"><button class="media-play-btn" onclick="toggleVideo(${i})">▶️</button></div></div>`;
    else return `<div class="media-slide"><img src="${m.src}" alt="Product image ${i+1}" style="width:100%;height:100%;object-fit:contain;padding:10px;display:block" onerror="this.style.display='none'"><button class="media-slide-preview-btn" onclick="event.stopPropagation();openImgPreview('${m.src}','Product Image ${i+1}')"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg> Preview</button></div>`;
  }).join('');
  const dots = media.length > 1 ? `<div class="swiper-dots" id="swiperDots">${media.map((_, i) => `<div class="swiper-dot ${i === 0 ? 'active' : ''}" onclick="goSlide(${i})"></div>`).join('')}</div>` : '';
  const arrows = media.length > 1 ? `<button class="swiper-prev" onclick="swiperPrev()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg></button><button class="swiper-next" onclick="swiperNext()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg></button>` : '';
  return `<div class="media-swiper-wrap" id="mediaSwiperWrap" style="position:relative"><div class="media-swiper-track" id="mediaSwiperTrack">${slides}</div>${discount > 0 ? `<div class="detail-discount-badge">-${discount}%</div>` : ''}${arrows}${dots}<button class="detail-wishlist" onclick="toggleWishlistDetail('${pid}')" id="wishBtn${pid}">${heartHTML}</button><button class="detail-share-btn" onclick="shareProduct('${pid}')"><svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg></button></div>`;
}

function toggleWishlistDetail(id) {
  const idx = wishlist.indexOf(id);
  if (idx >= 0) { wishlist.splice(idx, 1); showToast('Removed from wishlist', 'info'); } else { wishlist.push(id); showToast('Added to wishlist ❤️', 'success'); }
  saveWishlist();
  const btn = document.getElementById('wishBtn' + id);
  if (btn) { const filled = wishlist.includes(id); btn.innerHTML = filled ? `<svg viewBox="0 0 24 24" fill="#000" stroke="#000" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>` : `<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`; }
}

function toggleVideo(i) {
  const vid = document.getElementById('prodVideo_' + i);
  if (!vid) return;
  if (vid.paused) { vid.play(); vid.parentElement.querySelector('.media-play-overlay').style.display = 'none'; } 
  else { vid.pause(); vid.parentElement.querySelector('.media-play-overlay').style.display = 'flex'; }
}

function swiperNext() {
  const p = findProd(currentProductId);
  if (!p) return;
  const total = getProductMedia(p).length;
  _swiperIdx = (_swiperIdx + 1) % total;
  updateSwiperUI(total);
}

function swiperPrev() {
  const p = findProd(currentProductId);
  if (!p) return;
  const total = getProductMedia(p).length;
  _swiperIdx = (_swiperIdx - 1 + total) % total;
  updateSwiperUI(total);
}

function goSlide(i) {
  _swiperIdx = i;
  const p = findProd(currentProductId);
  if (p) updateSwiperUI(getProductMedia(p).length);
}

function updateSwiperUI(total) {
  const track = document.getElementById('mediaSwiperTrack');
  if (track) track.style.transform = `translateX(-${_swiperIdx * 100}%)`;
  const dots = document.querySelectorAll('#swiperDots .swiper-dot');
  dots.forEach((d, i) => d.classList.toggle('active', i === _swiperIdx));
}

function initSwiperTouch() {
  const wrap = document.getElementById('mediaSwiperWrap');
  if (!wrap) return;
  let startX = 0;
  wrap.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
  wrap.addEventListener('touchend', e => { const dx = e.changedTouches[0].clientX - startX; if (Math.abs(dx) > 40) { if (dx < 0) swiperNext(); else swiperPrev(); } }, { passive: true });
}

function openImgPreview(src, caption) {
  const modal = document.getElementById('imgPreviewModal');
  const img = document.getElementById('imgPreviewSrc');
  const cap = document.getElementById('imgPreviewCaption');
  if (!modal || !img) return;
  img.src = src;
  if (cap) cap.textContent = caption || '';
  modal.classList.add('open');
}

function closeImgPreview() {
  const modal = document.getElementById('imgPreviewModal');
  if (modal) modal.classList.remove('open');
}

function shareProduct(id) {
  const p = findProd(id);
  if (!p) return;
  const url = `https://apykart.vercel.app?product=${id}`;
  const text = `🛒 Check out *${p.name}* on Apykart!\n💰 Only ₹${Number(p.price).toLocaleString()}${p.discount > 0 ? ' (' + p.discount + '% off)' : ''}\n\n${url}`;
  if (navigator.share) { navigator.share({ title: p.name, text: `Check out ${p.name} on Apykart!`, url }).catch(() => {}); } 
  else { navigator.clipboard?.writeText(text).then(() => showToast('Product link copied! 🔗', 'success')).catch(() => window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')); }
}

// ─── COMING SOON ───
function showComingSoon(f) { document.getElementById('comingSoonTitle').textContent = `${f} Coming Soon!`; document.getElementById('comingSoonOverlay').style.display = 'flex'; }
function hideComingSoon() { document.getElementById('comingSoonOverlay').style.display = 'none'; }

// ─── DEEP LINK ───
function checkDeepLink(onDone) {
  const params = new URLSearchParams(window.location.search);
  const productId = params.get('product');
  const videoId = params.get('video');
  const finish = () => { if (typeof onDone === 'function') onDone(); };
  if (productId) { let attempts = 0; const maxAttempts = 24; const tryOpen = () => { const p = findProd(productId); if (p) { showPage('detail', productId); setTimeout(finish, 200); return; } attempts++; if (attempts < maxAttempts) { setTimeout(tryOpen, 500); } else { showToast('Product not found or removed', 'warn'); finish(); } }; tryOpen(); } 
  else if (videoId) { let attempts = 0; const maxAttempts = 24; const tryOpenVid = () => { const vids = window._approvedVideos || []; const found = vids.find(v => v.id === videoId || v._fsId === videoId); if (found) { showPage('xplor', videoId); setTimeout(finish, 200); return; } attempts++; if (attempts < maxAttempts) { setTimeout(tryOpenVid, 500); } else { showPage('xplor'); finish(); } }; tryOpenVid(); } 
  else { finish(); }
}

// ─── APPLY USER DATA ─── (already defined earlier)

// ─── INIT ───
init();
