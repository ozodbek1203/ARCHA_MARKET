
// ==========================================
// ARCHA MARKET — SUPABASE ULANISHI
// ==========================================

const SUPABASE_URL = "https://puzxpbxglrehivbjjxwd.supabase.co";
const SUPABASE_KEY = "sb_publishable_cmu-7u_9VtCu8sVhxQNCrQ_VzuHZcPo";

const ADMIN_EMAIL = "ozodbek.220423@gmail.com";
const ADMIN_UID = "09e00062-465f-48e5-b3b2-fb908cbea6fb";

const { createClient } = supabase;
const dbClient = createClient(SUPABASE_URL, SUPABASE_KEY);

let products = [];
let orders = [];
let cart = [];
let adminLoggedIn = false;
let editingProductId = null;

// ==========================================
// YORDAMCHI FUNKSIYALAR
// ==========================================

function money(value) {
  return new Intl.NumberFormat("uz-UZ").format(Number(value) || 0) + " so'm";
}

function safe(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function notify(message) {
  alert(message);
}

function showOnly(id) {
  ["sellerPage", "cartPage", "adminLogin", "adminPage"].forEach(pageId => {
    const el = document.getElementById(pageId);
    if (el) el.style.display = pageId === id ? "block" : "none";
  });
}

function showSeller() {
  showOnly("sellerPage");
  renderProducts();
}

function toggleCart() {
  showOnly("cartPage");
  renderCart();
}

function openAdmin() {
  showOnly(adminLoggedIn ? "adminPage" : "adminLogin");
  if (adminLoggedIn) refreshAdmin();
}

function updateCartCount() {
  const count = cart.reduce((sum, item) => sum + item.qty, 0);
  const el = document.getElementById("cartCount");
  if (el) el.textContent = count;
}

// ==========================================
// SUPABASE MAHSULOTLARINI YUKLASH
// ==========================================

async function loadProducts() {
  const { data, error } = await dbClient
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    notify("Mahsulotlarni yuklashda xatolik: " + error.message);
    return;
  }

  products = data || [];
  renderProducts();

  if (adminLoggedIn) renderAdminProducts();
}

function renderProducts() {
  const grid = document.getElementById("productGrid");
  if (!grid) return;

  const search = (document.getElementById("search")?.value || "").toLowerCase();
  const category = document.getElementById("categoryFilter")?.value || "";

  const filtered = products.filter(product => {
    const matchesSearch =
      (product.name || "").toLowerCase().includes(search) ||
      (product.description || "").toLowerCase().includes(search);

    const matchesCategory = !category || product.category === category;
    return matchesSearch && matchesCategory;
  });

  if (!filtered.length) {
    grid.innerHTML = "<p>Hozircha mahsulotlar mavjud emas.</p>";
    return;
  }

  grid.innerHTML = filtered.map(product => `
    <div class="product-card">
      <img src="${safe(product.image || "")}" alt="${safe(product.name)}">
      <h3>${safe(product.name)}</h3>
      <p>${safe(product.description || "")}</p>
      <p>Omborda: ${Number(product.stock) || 0} dona</p>
      <h3>${money(product.price)}</h3>
      <button onclick="addToCart('${safe(product.id)}')"
        ${Number(product.stock) <= 0 ? "disabled" : ""}>
        🛒 Savatga qo'shish
      </button>
    </div>
  `).join("");
}

// ==========================================
// SAVATCHA
// ==========================================

function addToCart(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) return;

  if (Number(product.stock) <= 0) {
    notify("Bu mahsulot omborda qolmagan.");
    return;
  }

  const existing = cart.find(item => item.id === productId);

  if (existing) {
    if (existing.qty >= Number(product.stock)) {
      notify("Omborda bundan ko'p mahsulot yo'q.");
      return;
    }
    existing.qty++;
  } else {
    cart.push({ id: productId, qty: 1 });
  }

  updateCartCount();
  notify("Mahsulot savatga qo'shildi.");
}

function renderCart() {
  const container = document.getElementById("cartItems");
  const totalEl = document.getElementById("cartTotal");
  if (!container) return;

  let total = 0;

  if (!cart.length) {
    container.innerHTML = "<p>Savatcha hozircha bo'sh.</p>";
    if (totalEl) totalEl.textContent = money(0);
    return;
  }

  container.innerHTML = cart.map(item => {
    const product = products.find(p => p.id === item.id);
    if (!product) return "";

    const subtotal = Number(product.price) * item.qty;
    total += subtotal;

    return `
      <div class="cart-item">
        <strong>${safe(product.name)}</strong>
        <p>${money(product.price)} × ${item.qty}</p>
        <button type="button" onclick="changeQty('${safe(item.id)}', -1)">−</button>
        <span>${item.qty}</span>
        <button type="button" onclick="changeQty('${safe(item.id)}', 1)">+</button>
        <button type="button" onclick="removeCart('${safe(item.id)}')">O'chirish</button>
        <p>Jami: ${money(subtotal)}</p>
      </div>
    `;
  }).join("");

  if (totalEl) totalEl.textContent = money(total);
}

function changeQty(productId, change) {
  const item = cart.find(i => i.id === productId);
  const product = products.find(p => p.id === productId);
  if (!item || !product) return;

  const newQty = item.qty + change;

  if (newQty < 1) {
    removeCart(productId);
    return;
  }

  if (newQty > Number(product.stock)) {
    notify("Omborda yetarli mahsulot yo'q.");
    return;
  }

  item.qty = newQty;
  renderCart();
  updateCartCount();
}

function removeCart(productId) {
  cart = cart.filter(item => item.id !== productId);
  renderCart();
  updateCartCount();
}

// ==========================================
// BUYURTMANI SUPABASE'GA JO'NATISH
// ==========================================

document.getElementById("orderForm")?.addEventListener("submit", async function(event) {
  event.preventDefault();

  if (!cart.length) {
    notify("Avval savatga mahsulot qo'shing.");
    return;
  }

  const customer = document.getElementById("customerName")?.value.trim();
  const phone = document.getElementById("customerPhone")?.value.trim();
  const address = document.getElementById("customerAddress")?.value.trim();
  const note = document.getElementById("customerNote")?.value.trim() || "";

  if (!customer || !phone || !address) {
    notify("Ism, telefon va manzilni to'ldiring.");
    return;
  }

  const orderId = crypto.randomUUID();
  const items = cart.map(item => ({
    id: item.id,
    qty: item.qty
  }));

  const submitButton = this.querySelector('button[type="submit"]');
  if (submitButton) submitButton.disabled = true;

  const { data, error } = await dbClient.rpc("place_order", {
    p_order_id: orderId,
    p_customer: customer,
    p_phone: phone,
    p_address: address,
    p_note: note,
    p_items: items
  });

  if (submitButton) submitButton.disabled = false;

  if (error) {
    console.error(error);
    notify("Buyurtma yuborilmadi: " + error.message);
    return;
  }

  notify("Buyurtmangiz muvaffaqiyatli yuborildi! Buyurtma raqami: " + data.id);

  cart = [];
  this.reset();
  updateCartCount();

  await loadProducts();
  renderCart();
  showSeller();
});

// ==========================================
// ADMIN LOGIN — SUPABASE AUTH
// ==========================================

document.getElementById("adminLoginForm")?.addEventListener("submit", async function(event) {
  event.preventDefault();

  const password = document.getElementById("adminPassword")?.value;
  const errorBox = document.getElementById("loginError");

  const { data, error } = await dbClient.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password
  });

  if (error) {
    if (errorBox) errorBox.textContent = "Email yoki parol noto'g'ri.";
    else notify("Kirish amalga oshmadi: " + error.message);
    return;
  }

  if (data.user?.id !== ADMIN_UID) {
    await dbClient.auth.signOut();
    notify("Bu foydalanuvchiga admin ruxsati berilmagan.");
    return;
  }

  adminLoggedIn = true;
  if (errorBox) errorBox.textContent = "";
  this.reset();

  showOnly("adminPage");
  await refreshAdmin();
});

async function adminLogout() {
  await dbClient.auth.signOut();
  adminLoggedIn = false;
  showOnly("sellerPage");
}

// Sahifa yangilanganda admin sessiyasini tekshirish
async function checkAdminSession() {
  const { data } = await dbClient.auth.getUser();

  if (data.user?.id === ADMIN_UID) {
    adminLoggedIn = true;
    showOnly("adminPage");
    await refreshAdmin();
  } else {
    adminLoggedIn = false;
    showOnly("sellerPage");
  }
}

// ==========================================
// ADMIN PANEL
// ==========================================

function adminTab(tab) {
  document.querySelectorAll(".admin-tab-content").forEach(el => {
    el.style.display = "none";
  });

  const target = document.getElementById("admin-" + tab);
  if (target) target.style.display = "block";

  refreshAdmin();
}

async function refreshAdmin() {
  if (!adminLoggedIn) return;

  await Promise.all([loadProducts(), loadOrders()]);
  renderDashboard();
  renderAdminProducts();
  renderOrders();
  renderReports();
}

function renderDashboard() {
  const revenue = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const sold = orders.reduce((sum, order) => {
    return sum + (order.items || []).reduce((n, item) => n + Number(item.qty || 0), 0);
  }, 0);

  const today = new Date().toDateString();
  const todayOrders = orders.filter(o => new Date(o.date || o.created_at).toDateString() === today);

  if (document.getElementById("statRevenue"))
    document.getElementById("statRevenue").textContent = money(revenue);

  if (document.getElementById("statOrders"))
    document.getElementById("statOrders").textContent = orders.length;

  if (document.getElementById("statProducts"))
    document.getElementById("statProducts").textContent = products.length;

  if (document.getElementById("statSold"))
    document.getElementById("statSold").textContent = sold;

  const recent = document.getElementById("recentOrders");
  if (recent) {
    recent.innerHTML = todayOrders.slice(0, 5).map(order => `
      <div class="recent-order">
        <b>${safe(order.customer)}</b> — ${money(order.total)}
        <span>${safe(order.status)}</span>
      </div>
    `).join("") || "<p>Hozircha buyurtmalar yo'q.</p>";
  }
}

// ==========================================
// ADMIN MAHSULOTLARI
// ==========================================

function renderAdminProducts() {
  const container = document.getElementById("adminProducts");
  if (!container) return;

  container.innerHTML = products.map(product => `
    <div class="admin-product">
      <img src="${safe(product.image || "")}" alt="${safe(product.name)}" width="70">
      <div>
        <b>${safe(product.name)}</b>
        <p>${money(product.price)} | Omborda: ${Number(product.stock)}</p>
      </div>
      <button onclick="editProduct('${safe(product.id)}')">Tahrirlash</button>
      <button onclick="deleteProduct('${safe(product.id)}')">O'chirish</button>
    </div>
  `).join("") || "<p>Mahsulotlar hali qo'shilmagan.</p>";
}

async function uploadProductImage(file) {
  if (!file) return null;

  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const filePath = `${crypto.randomUUID()}.${extension}`;

  const { error } = await dbClient.storage
    .from("product-images")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false
    });

  if (error) throw error;

  const { data } = dbClient.storage
    .from("product-images")
    .getPublicUrl(filePath);

  return data.publicUrl;
}

document.getElementById("productForm")?.addEventListener("submit", async function(event) {
  event.preventDefault();

  if (!adminLoggedIn) {
    notify("Avval admin sifatida kiring.");
    return;
  }

  const name = document.getElementById("productName")?.value.trim();
  const category = document.getElementById("productCategory")?.value;
  const price = Number(document.getElementById("productPrice")?.value);
  const stock = Number(document.getElementById("productStock")?.value);
  const description = document.getElementById("productDescription")?.value.trim();
  const file = document.getElementById("productImage")?.files?.[0];

  if (!name || !category || price < 0 || stock < 0) {
    notify("Mahsulot ma'lumotlarini to'g'ri kiriting.");
    return;
  }

  try {
    let image = null;

    if (file) {
      image = await uploadProductImage(file);
    }

    if (editingProductId) {
      const oldProduct = products.find(p => p.id === editingProductId);
      const updateData = { name, category, price, stock, description };

      if (image) updateData.image = image;
      else if (oldProduct?.image) updateData.image = oldProduct.image;

      const { error } = await dbClient
        .from("products")
        .update(updateData)
        .eq("id", editingProductId);

      if (error) throw error;

      notify("Mahsulot yangilandi.");
      editingProductId = null;
    } else {
      const { error } = await dbClient
        .from("products")
        .insert({
          id: crypto.randomUUID(),
          name,
          category,
          price,
          stock,
          image,
          description
        });

      if (error) throw error;

      notify("Yangi mahsulot qo'shildi.");
    }

    this.reset();
    await loadProducts();
    renderAdminProducts();
  } catch (error) {
    console.error(error);
    notify("Mahsulotni saqlashda xatolik: " + error.message);
  }
});

function editProduct(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) return;

  editingProductId = productId;

  document.getElementById("productName").value = product.name || "";
  document.getElementById("productCategory").value = product.category || "";
  document.getElementById("productPrice").value = product.price || 0;
  document.getElementById("productStock").value = product.stock || 0;
  document.getElementById("productDescription").value = product.description || "";

  document.getElementById("productForm")?.scrollIntoView({ behavior: "smooth" });
}

async function deleteProduct(productId) {
  if (!confirm("Ushbu mahsulotni o'chirmoqchimisiz?")) return;

  const { error } = await dbClient
    .from("products")
    .delete()
    .eq("id", productId);

  if (error) {
    notify("O'chirishda xatolik: " + error.message);
    return;
  }

  await loadProducts();
  renderAdminProducts();
  notify("Mahsulot o'chirildi.");
}

// ==========================================
// BUYURTMALAR
// ==========================================

async function loadOrders() {
  if (!adminLoggedIn) return;

  const { data, error } = await dbClient
    .from("orders")
    .select("*")
    .order("date", { ascending: false });

  if (error) {
    console.error(error);
    notify("Buyurtmalarni yuklashda xatolik: " + error.message);
    return;
  }

  orders = data || [];
}

function renderOrders() {
  const container = document.getElementById("allOrders");
  if (!container) return;

  container.innerHTML = orders.map(order => `
    <div class="order-card">
      <h3>Buyurtma: ${safe(order.id)}</h3>
      <p><b>Mijoz:</b> ${safe(order.customer)}</p>
      <p><b>Telefon:</b> ${safe(order.phone)}</p>
      <p><b>Manzil:</b> ${safe(order.address)}</p>
      <p><b>Izoh:</b> ${safe(order.note || "")}</p>
      <p><b>Mahsulotlar:</b></p>
      ${(order.items || []).map(item => `
        <p>${safe(item.name)} — ${item.qty} dona × ${money(item.price)}</p>
      `).join("")}
      <h3>${money(order.total)}</h3>
      <p><b>Holati:</b> ${safe(order.status)}</p>
      <button onclick="changeOrderStatus('${safe(order.id)}', 'Qabul qilindi')">Qabul qilish</button>
      <button onclick="changeOrderStatus('${safe(order.id)}', 'Tayyor')">Tayyor</button>
      <button onclick="changeOrderStatus('${safe(order.id)}', 'Yetkazildi')">Yetkazildi</button>
      <button onclick="deleteOrder('${safe(order.id)}')">O'chirish</button>
    </div>
  `).join("") || "<p>Hozircha buyurtmalar yo'q.</p>";
}

async function changeOrderStatus(orderId, status) {
  const { error } = await dbClient
    .from("orders")
    .update({ status })
    .eq("id", orderId);

  if (error) {
    notify("Holatni o'zgartirishda xatolik: " + error.message);
    return;
  }

  await loadOrders();
  renderOrders();
  renderDashboard();
}

async function deleteOrder(orderId) {
  if (!confirm("Buyurtmani o'chirmoqchimisiz?")) return;

  const { error } = await dbClient
    .from("orders")
    .delete()
    .eq("id", orderId);

  if (error) {
    notify("Buyurtmani o'chirishda xatolik: " + error.message);
    return;
  }

  await loadOrders();
  renderOrders();
  renderDashboard();
}

// ==========================================
// HISOBOTLAR
// ==========================================

function renderReports() {
  const now = new Date();
  const today = now.toDateString();
  const month = now.getMonth();
  const year = now.getFullYear();

  const todayOrders = orders.filter(o =>
    new Date(o.date || o.created_at).toDateString() === today
  );

  const monthOrders = orders.filter(o => {
    const d = new Date(o.date || o.created_at);
    return d.getMonth() === month && d.getFullYear() === year;
  });

  const sum = list => list.reduce((total, o) => total + Number(o.total || 0), 0);

  if (document.getElementById("reportToday"))
    document.getElementById("reportToday").textContent = money(sum(todayOrders));

  if (document.getElementById("reportMonth"))
    document.getElementById("reportMonth").textContent = money(sum(monthOrders));

  if (document.getElementById("reportAll"))
    document.getElementById("reportAll").textContent = money(sum(orders));

  const table = document.getElementById("salesReport");
  if (table) {
    table.innerHTML = orders.map(o => `
      <tr>
        <td>${safe(o.customer)}</td>
        <td>${safe(o.phone)}</td>
        <td>${money(o.total)}</td>
        <td>${safe(o.status)}</td>
        <td>${new Date(o.date || o.created_at).toLocaleDateString("uz-UZ")}</td>
      </tr>
    `).join("");
  }
}

function exportOrders() {
  const rows = [
    ["Mijoz", "Telefon", "Manzil", "Jami", "Holat", "Sana"],
    ...orders.map(o => [
      o.customer,
      o.phone,
      o.address,
      o.total,
      o.status,
      new Date(o.date || o.created_at).toLocaleDateString("uz-UZ")
    ])
  ];

  const csv = "\uFEFF" + rows.map(row =>
    row.map(value => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")
  ).join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "archa-market-buyurtmalar.csv";
  link.click();

  URL.revokeObjectURL(url);
}

// ==========================================
// ADMIN PAROLINI O'ZGARTIRISH
// ==========================================

document.getElementById("passwordForm")?.addEventListener("submit", async function(event) {
  event.preventDefault();

  const oldPassword = document.getElementById("oldPassword")?.value;
  const newPassword = document.getElementById("newPassword")?.value;
  const confirmPassword = document.getElementById("confirmPassword")?.value;
  const message = document.getElementById("passwordMessage");

  if (!newPassword || newPassword.length < 6) {
    if (message) message.textContent = "Yangi parol kamida 6 ta belgidan iborat bo'lsin.";
    return;
  }

  if (newPassword !== confirmPassword) {
    if (message) message.textContent = "Yangi parollar bir xil emas.";
    return;
  }

  const { error: verifyError } = await dbClient.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: oldPassword
  });

  if (verifyError) {
    if (message) message.textContent = "Eski parol noto'g'ri.";
    return;
  }

  const { error } = await dbClient.auth.updateUser({
    password: newPassword
  });

  if (error) {
    if (message) message.textContent = "Xatolik: " + error.message;
    return;
  }

  if (message) message.textContent = "Admin paroli muvaffaqiyatli o'zgartirildi.";
  this.reset();
});

// ==========================================
// MA'LUMOTLARNI TOZALASH
// ==========================================

async function clearAllData() {
  if (!adminLoggedIn) return;

  const confirmed = confirm(
    "Diqqat! Barcha buyurtmalarni o'chirishni xohlaysizmi? Bu amalni ortga qaytarib bo'lmaydi."
  );

  if (!confirmed) return;

  const { error } = await dbClient
    .from("orders")
    .delete()
    .not("id", "is", null);

  if (error) {
    notify("Ma'lumotlarni o'chirishda xatolik: " + error.message);
    return;
  }

  await loadOrders();
  renderOrders();
  renderDashboard();
  renderReports();
  notify("Buyurtmalar tozalandi.");
}

// ==========================================
// SOAT VA BOSHLANG'ICH ISHGA TUSHIRISH
// ==========================================

function updateClock() {
  const clock = document.getElementById("clock");
  if (clock) {
    clock.textContent = new Date().toLocaleString("uz-UZ");
  }
}

setInterval(updateClock, 1000);
updateClock();

document.getElementById("search")?.addEventListener("input", renderProducts);
document.getElementById("categoryFilter")?.addEventListener("change", renderProducts);

updateCartCount();
loadProducts();
checkAdminSession();

// Mahsulotlar o'zgarsa boshqa sotuvchilarda ham yangilansin
dbClient
  .channel("archa-market-products")
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "products" },
    () => loadProducts()
  )
  .subscribe();
