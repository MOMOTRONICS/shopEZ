import React, { useEffect, useMemo, useState } from "react";
import { api } from "./api.js";

const money = (amount) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);

const defaultProduct = {
  name: "",
  description: "",
  category: "Fashion",
  price: "",
  image: "",
  stock: "",
  badge: "",
};

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("shopez-user") || "null");
  } catch {
    return null;
  }
}

export default function App() {
  const [user, setUser] = useState(readStoredUser);
  const [token, setToken] = useState(() => localStorage.getItem("shopez-token"));
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [discounts, setDiscounts] = useState([]);
  const [cart, setCart] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("shopez-cart") || "[]");
    } catch {
      return [];
    }
  });
  const [cartReady, setCartReady] = useState(() => !localStorage.getItem("shopez-token"));
  const [screen, setScreen] = useState("home");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Semua");
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [discountCode, setDiscountCode] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState(null);
  const [checkingDiscount, setCheckingDiscount] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [productForm, setProductForm] = useState(defaultProduct);
  const [savingProduct, setSavingProduct] = useState(false);
  const [discountForm, setDiscountForm] = useState({ code: "", value: "10", minimumSubtotal: "0" });

  async function loadProducts() {
    const data = await api("/products");
    setProducts(data.products);
  }

  async function loadOrders(currentToken = token) {
    if (!currentToken) return;
    const data = await api("/orders", { token: currentToken });
    setOrders(data.orders);
  }

  async function loadDiscounts(currentToken = token) {
    if (!currentToken) return;
    const data = await api("/discounts", { token: currentToken });
    setDiscounts(data.discounts);
  }

  useEffect(() => {
    loadProducts()
      .catch((cause) => setError(cause.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    localStorage.setItem("shopez-cart", JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    if (!token) {
      setCartReady(true);
      return undefined;
    }

    let cancelled = false;
    setCartReady(false);
    async function restoreCart() {
      try {
        const [saved, storedCart] = await Promise.all([
          api("/cart", { token }),
          Promise.resolve(
            JSON.parse(localStorage.getItem("shopez-cart") || "[]"),
          ),
        ]);
        if (cancelled) return;
        const merged = new Map(saved.items.map((item) => [item._id, item]));
        for (const guestItem of storedCart) {
          if (!merged.has(guestItem._id)) {
            merged.set(guestItem._id, guestItem);
          } else {
            const existing = merged.get(guestItem._id);
            merged.set(guestItem._id, {
              ...existing,
              quantity: existing.quantity + guestItem.quantity,
            });
          }
        }
        const synchronized = await api("/cart", {
          method: "PUT",
          token,
          body: JSON.stringify({
            items: [...merged.values()].map(({ _id, quantity }) => ({
              productId: _id,
              quantity,
            })),
          }),
        });
        if (!cancelled) setCart(synchronized.items);
      } catch (cause) {
        if (!cancelled) {
          setError(cause.message);
          try {
            const saved = await api("/cart", { token });
            if (!cancelled) setCart(saved.items);
          } catch (restoreError) {
            if (!cancelled) setError(restoreError.message);
          }
        }
      } finally {
        if (!cancelled) setCartReady(true);
      }
    }
    restoreCart();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!token || !cartReady) return undefined;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      api("/cart", {
        method: "PUT",
        token,
        body: JSON.stringify({
          items: cart.map((item) => ({ productId: item._id, quantity: item.quantity })),
        }),
      }).catch((cause) => {
        if (!cancelled) setError(cause.message);
      });
    }, 500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [cart, cartReady, token]);

  useEffect(() => {
    if (token) {
      loadOrders(token).catch((cause) => setError(cause.message));
      if (user?.role === "admin") {
        loadDiscounts(token).catch((cause) => setError(cause.message));
      }
    } else {
      setOrders([]);
      setDiscounts([]);
    }
  }, [token, user?.role]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(""), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const categories = useMemo(
    () => ["Semua", ...new Set(products.map((product) => product.category))],
    [products],
  );
  const visibleProducts = useMemo(
    () =>
      products.filter((product) => {
        const matchesCategory = category === "Semua" || product.category === category;
        const matchesSearch = `${product.name} ${product.description}`
          .toLowerCase()
          .includes(search.toLowerCase());
        return matchesCategory && matchesSearch;
      }),
    [products, category, search],
  );
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const recommendationCategories = new Set(cart.map((item) => item.category));
  const featuredProductIds = new Set(visibleProducts.slice(0, 4).map((product) => product._id));
  const recommendedProducts = [...products]
    .filter(
      (product) =>
        !cart.some((item) => item._id === product._id) &&
        !featuredProductIds.has(product._id),
    )
    .sort((first, second) => {
      const firstMatch = recommendationCategories.has(first.category) ? 1 : 0;
      const secondMatch = recommendationCategories.has(second.category) ? 1 : 0;
      return secondMatch - firstMatch || second.rating - first.rating;
    })
    .slice(0, 4);

  function addToCart(product) {
    setCart((current) => {
      const existing = current.find((item) => item._id === product._id);
      if (existing) {
        return current.map((item) =>
          item._id === product._id
            ? { ...item, quantity: Math.min(item.quantity + 1, product.stock) }
            : item,
        );
      }
      return [...current, { ...product, quantity: 1 }];
    });
    setNotice(`${product.name} ditambahkan ke keranjang`);
  }

  function changeQuantity(productId, delta) {
    setCart((current) =>
      current
        .map((item) => {
          if (item._id !== productId) return item;
          const product = products.find((entry) => entry._id === productId);
          return {
            ...item,
            quantity: Math.min(item.quantity + delta, product?.stock ?? item.quantity),
          };
        })
        .filter((item) => item.quantity > 0),
    );
  }

  function openAuth(mode = "login") {
    setAuthMode(mode);
    setAuthOpen(true);
    setError("");
  }

  function signOut() {
    localStorage.removeItem("shopez-token");
    localStorage.removeItem("shopez-user");
    setToken(null);
    setUser(null);
    setCart([]);
    setScreen("home");
    setNotice("Kamu berhasil keluar.");
  }

  async function submitAuth(event) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form.entries());
    try {
      const result = await api(`/auth/${authMode === "login" ? "login" : "register"}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      localStorage.setItem("shopez-token", result.token);
      localStorage.setItem("shopez-user", JSON.stringify(result.user));
      setCartReady(false);
      setToken(result.token);
      setUser(result.user);
      setAuthOpen(false);
      setNotice(`Senang bertemu denganmu, ${result.user.name}!`);
    } catch (cause) {
      setError(cause.message);
    }
  }

  async function submitOrder(event) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form.entries());
    const shippingAddress = {
      name: body.name,
      phone: body.phone,
      address: body.address,
      city: body.city,
      postalCode: body.postalCode,
    };
    try {
      await api("/orders", {
        method: "POST",
        token,
        body: JSON.stringify({
          items: cart.map((item) => ({ productId: item._id, quantity: item.quantity })),
          shippingAddress,
          paymentMethod: body.paymentMethod,
          discountCode: appliedDiscount?.subtotal === cartTotal ? appliedDiscount.code : "",
        }),
      });
      setCart([]);
      setAppliedDiscount(null);
      setDiscountCode("");
      setCheckoutOpen(false);
      setCartOpen(false);
      await Promise.all([loadOrders(), loadProducts()]);
      setScreen("orders");
      setNotice("Pesanan berhasil dibuat. Terima kasih sudah berbelanja!");
    } catch (cause) {
      setError(cause.message);
    }
  }

  async function applyDiscount(event) {
    event.preventDefault();
    setCheckingDiscount(true);
    setError("");
    try {
      const result = await api("/discounts/validate", {
        method: "POST",
        body: JSON.stringify({ code: discountCode, subtotal: cartTotal }),
      });
      setAppliedDiscount({ ...result, subtotal: cartTotal });
      setNotice(`${result.label} berhasil digunakan.`);
    } catch (cause) {
      setAppliedDiscount(null);
      setError(cause.message);
    } finally {
      setCheckingDiscount(false);
    }
  }

  async function submitReview(event) {
    event.preventDefault();
    if (!selectedProduct) return;
    setSubmittingReview(true);
    setError("");
    try {
      const result = await api(`/products/${selectedProduct._id}/reviews`, {
        method: "POST",
        token,
        body: JSON.stringify({ rating: reviewRating, comment: reviewComment }),
      });
      setSelectedProduct(result.product);
      setReviewComment("");
      await loadProducts();
      setNotice("Ulasan produk berhasil disimpan.");
    } catch (cause) {
      setError(cause.message);
    } finally {
      setSubmittingReview(false);
    }
  }

  async function submitProduct(event) {
    event.preventDefault();
    setSavingProduct(true);
    setError("");
    try {
      await api("/products", {
        method: "POST",
        token,
        body: JSON.stringify({
          ...productForm,
          price: Number(productForm.price),
          stock: Number(productForm.stock),
        }),
      });
      setProductForm(defaultProduct);
      await loadProducts();
      setNotice("Produk baru berhasil diterbitkan.");
    } catch (cause) {
      setError(cause.message);
    } finally {
      setSavingProduct(false);
    }
  }

  async function deleteProduct(productId) {
    if (!window.confirm("Hapus produk ini dari katalog?")) return;
    try {
      await api(`/products/${productId}`, { method: "DELETE", token });
      await loadProducts();
      setNotice("Produk berhasil dihapus.");
    } catch (cause) {
      setError(cause.message);
    }
  }

  async function updateOrder(orderId, status) {
    try {
      await api(`/orders/${orderId}/status`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ status }),
      });
      await loadOrders();
      setNotice("Status pesanan berhasil diperbarui.");
    } catch (cause) {
      setError(cause.message);
    }
  }

  async function submitDiscount(event) {
    event.preventDefault();
    setError("");
    try {
      const result = await api("/discounts", {
        method: "POST",
        token,
        body: JSON.stringify({
          code: discountForm.code,
          type: "percentage",
          value: Number(discountForm.value),
          minimumSubtotal: Number(discountForm.minimumSubtotal),
        }),
      });
      setDiscounts((current) => [...current, result.discount].sort((a, b) => a.code.localeCompare(b.code)));
      setDiscountForm({ code: "", value: "10", minimumSubtotal: "0" });
      setNotice(`Kode ${result.discount.code} berhasil dibuat.`);
    } catch (cause) {
      setError(cause.message);
    }
  }

  async function toggleDiscount(discount) {
    try {
      const result = await api(`/discounts/${discount.code}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ active: !discount.active }),
      });
      setDiscounts((current) =>
        current.map((item) => (item._id === result.discount._id ? result.discount : item)),
      );
      setNotice(`Kode ${discount.code} ${result.discount.active ? "diaktifkan" : "dinonaktifkan"}.`);
    } catch (cause) {
      setError(cause.message);
    }
  }

  return (
    <div className="app-shell">
      <div className="announcement">
        <span>✦</span> Sedikit lebih banyak joy, di setiap paket. Diskon 10% mulai belanja
        Rp100.000 <span className="announcement-code">— pakai FIRSTJOY</span>
      </div>
      <header className="site-header">
        <button className="brand" onClick={() => setScreen("home")} aria-label="ShopEZ home">
          <span className="brand-mark">s.</span>
          <span>shopez<span className="brand-dot">.</span></span>
        </button>
        <nav className="main-nav" aria-label="Navigasi utama">
          <button className={screen === "home" ? "active" : ""} onClick={() => setScreen("home")}>
            Beranda
          </button>
          <button
            className={screen === "products" ? "active" : ""}
            onClick={() => setScreen("products")}
          >
            Produk
          </button>
          {user && (
            <button
              className={screen === "orders" ? "active" : ""}
              onClick={() => setScreen("orders")}
            >
              Pesanan
            </button>
          )}
          {user?.role === "admin" && (
            <>
              <button className={screen === "admin" ? "active" : ""} onClick={() => setScreen("admin")}>Dashboard</button>
              <button className={screen === "admin-products" ? "active" : ""} onClick={() => setScreen("admin-products")}>Produk toko</button>
              <button className={screen === "admin-orders" ? "active" : ""} onClick={() => setScreen("admin-orders")}>Pesanan toko</button>
            </>
          )}
        </nav>
        <div className="header-actions">
          <label className="search-box">
            <span aria-hidden="true">⌕</span>
            <input
              aria-label="Cari produk"
              placeholder="Cari sesuatu..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                if (event.target.value) setScreen("products");
              }}
            />
            <kbd>⌘ K</kbd>
          </label>
          {user ? (
            <button className="profile-button" onClick={() => setScreen("orders")}>
              <span className="avatar">{user.name.charAt(0).toUpperCase()}</span>
              <span className="profile-name">{user.name.split(" ")[0]}</span>
            </button>
          ) : (
            <button className="login-button" onClick={() => openAuth()}>
              Masuk <span>↗</span>
            </button>
          )}
          <button className="cart-button" onClick={() => setCartOpen(true)} aria-label={`Keranjang, ${cartCount} item`}>
            ♧ <span className="cart-label">Tas</span>
            {cartCount > 0 && <span className="cart-count">{cartCount}</span>}
          </button>
        </div>
      </header>

      <main>
        {screen === "home" && (
          <>
            <section className="hero">
              <div className="hero-copy">
                <div className="eyebrow"><span className="eyebrow-line" /> PILIHAN KECIL, BAHAGIA BESAR</div>
                <h1>Temukan hal<br />kecil yang bikin<br /><em>harimu istimewa.</em></h1>
                <p>Barang-barang pilihan yang dibuat untuk menemani keseharianmu. Dikurasi dengan hati, dikirim dengan cinta.</p>
                <div className="hero-actions">
                  <button className="button button-dark" onClick={() => setScreen("products")}>Jelajahi koleksi <span>↗</span></button>
                  <span className="hero-note"><span className="tiny-spark">✳</span> Pilihan produk terus bertambah</span>
                </div>
                <div className="hero-proof">
                  <div className="avatar-stack"><span>✳</span><span>♡</span><span>↗</span></div>
                  <div><strong>Kurasi penuh perhatian</strong><small>untuk menemani keseharianmu</small></div>
                </div>
              </div>
              <div className="hero-art" aria-label="Koleksi produk pilihan">
                <div className="hero-image"><img src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1000&q=85" alt="Pilihan fashion untuk keseharian" /></div>
                <div className="hero-sticker"><span>✳</span><strong>made for<br />your everyday</strong></div>
                <div className="hero-caption"><span>01 / 04</span><span>Temukan gayamu sendiri</span></div>
              </div>
              <div className="hero-side-note">SHOP SMALL · FEEL GOOD · REPEAT</div>
            </section>

            <section className="trust-strip">
              <span><b>✳</b> Pilihan penuh perhatian</span>
              <i />
              <span><b>↗</b> Pengiriman ke seluruh Indonesia</span>
              <i />
              <span><b>♡</b> Belanja aman & nyaman</span>
            </section>

            <ProductSection
              title="Pilihan yang bikin senang"
              subtitle="Barang favorit kami, siap jadi favoritmu berikutnya."
              products={visibleProducts.slice(0, 4)}
              loading={loading}
              onAdd={addToCart}
              onReview={(product) => { setSelectedProduct(product); setReviewRating(5); setReviewComment(""); }}
              onSeeAll={() => setScreen("products")}
              onSelect={(value) => { setCategory(value); setScreen("products"); }}
              categories={categories}
              activeCategory={category}
              compact
            />
            <ProductSection
              title="Mungkin kamu suka"
              subtitle={cart.length ? "Pilihan serupa dengan barang di keranjangmu." : "Temukan pilihan populer dari koleksi ShopEZ."}
              products={recommendedProducts}
              loading={loading}
              onAdd={addToCart}
              onReview={(product) => { setSelectedProduct(product); setReviewRating(5); setReviewComment(""); }}
              compact
            />
            <section className="newsletter">
              <span className="newsletter-spark">✳</span>
              <div><p className="eyebrow">CATATAN KECIL DARI KAMI</p><h2>Hal baik, langsung ke inbox.</h2><p>Inspirasi, barang baru, dan kejutan manis. Sesekali saja, janji.</p></div>
              <span className="newsletter-note">Segera hadir <span>✳</span></span>
            </section>
          </>
        )}

        {screen === "products" && (
          <ProductSection
            title="Semua yang kamu suka"
            subtitle="Jelajahi koleksi pilihan ShopEZ, dibuat untuk keseharian yang lebih berwarna."
            products={visibleProducts}
            loading={loading}
            onAdd={addToCart}
            onReview={(product) => { setSelectedProduct(product); setReviewRating(5); setReviewComment(""); }}
            categories={categories}
            activeCategory={category}
            onSelect={setCategory}
            search={search}
          />
        )}

        {screen === "orders" && (
          <section className="page-section orders-page">
            <div className="section-heading"><div><p className="eyebrow">AKUN KAMU</p><h1>{user ? `Hai, ${user.name.split(" ")[0]}.` : "Pesanan kamu"}</h1><p className="section-subtitle">Semua cerita belanjamu ada di sini.</p></div>{user && <button className="text-button" onClick={signOut}>Keluar ↗</button>}</div>
            {!user ? (
              <div className="empty-state"><span>♡</span><h3>Masuk untuk melihat pesananmu</h3><button className="button button-dark" onClick={() => openAuth()}>Masuk / Daftar ↗</button></div>
            ) : orders.length === 0 ? (
              <div className="empty-state"><span>✳</span><h3>Belum ada pesanan</h3><p>Yuk, temukan sesuatu yang kamu suka hari ini.</p><button className="button button-dark" onClick={() => setScreen("products")}>Jelajahi produk ↗</button></div>
            ) : (
              <div className="order-list">{orders.map((order) => <OrderCard key={order._id} order={order} admin={user.role === "admin"} onUpdate={updateOrder} />)}</div>
            )}
          </section>
        )}

        {screen === "admin" && user?.role === "admin" && (
          <section className="page-section admin-page">
            <div className="section-heading"><div><p className="eyebrow">RUANG KERJA SHOPEZ</p><h1>Dashboard toko<span className="brand-dot">.</span></h1><p className="section-subtitle">Ringkasan dan pintasan untuk mengelola tokomu.</p></div></div>
            <div className="admin-stats"><div><span>Produk aktif</span><strong>{products.length}</strong><small>di katalog ShopEZ</small></div><div><span>Total pesanan</span><strong>{orders.length}</strong><small>semua pelanggan</small></div><div><span>Dalam proses</span><strong>{orders.filter((order) => order.status === "processing").length}</strong><small>butuh perhatianmu</small></div></div>
            <div className="admin-shortcuts"><button className="button button-dark" onClick={() => setScreen("admin-products")}>Kelola produk & diskon ↗</button><button className="button button-dark" onClick={() => setScreen("admin-orders")}>Kelola pesanan ↗</button></div>
          </section>
        )}

        {screen === "admin-products" && user?.role === "admin" && (
          <section className="page-section admin-page">
            <div className="section-heading"><div><p className="eyebrow">DASHBOARD · KATALOG</p><h1>Kelola produk<span className="brand-dot">.</span></h1><p className="section-subtitle">Tambah produk, atur katalog, dan buat kode diskon.</p></div></div>
            <div className="admin-layout">
              <form className="product-form" onSubmit={submitProduct}>
                <p className="eyebrow">KATALOG</p><h2>Tambah produk</h2>
                <label>Nama produk<input required maxLength="160" value={productForm.name} onChange={(event) => setProductForm({ ...productForm, name: event.target.value })} /></label>
                <label>Deskripsi<textarea required maxLength="2000" rows="3" value={productForm.description} onChange={(event) => setProductForm({ ...productForm, description: event.target.value })} /></label>
                <div className="form-row"><label>Kategori<input required value={productForm.category} onChange={(event) => setProductForm({ ...productForm, category: event.target.value })} /></label><label>Harga (Rp)<input required type="number" min="0" value={productForm.price} onChange={(event) => setProductForm({ ...productForm, price: event.target.value })} /></label></div>
                <div className="form-row"><label>Stok<input required type="number" min="0" value={productForm.stock} onChange={(event) => setProductForm({ ...productForm, stock: event.target.value })} /></label><label>Label<input placeholder="Baru, Favorit..." value={productForm.badge} onChange={(event) => setProductForm({ ...productForm, badge: event.target.value })} /></label></div>
                <label>URL gambar<input required type="url" placeholder="https://" value={productForm.image} onChange={(event) => setProductForm({ ...productForm, image: event.target.value })} /></label>
                <button className="button button-dark full-button" disabled={savingProduct}>{savingProduct ? "Menyimpan..." : "Terbitkan produk ↗"}</button>
              </form>
              <div className="admin-catalog"><p className="eyebrow">PRODUK SAAT INI</p><h2>Kelola katalog</h2>{products.map((product) => <div className="manage-product" key={product._id}><img src={product.image} alt="" /><div><strong>{product.name}</strong><span>{money(product.price)} · Stok {product.stock}</span></div><button onClick={() => deleteProduct(product._id)} aria-label={`Hapus ${product.name}`}>Hapus</button></div>)}</div>
            </div>
            <div className="discount-admin">
              <div><p className="eyebrow">PROMOSI TOKO</p><h2>Kode diskon</h2></div>
              <form className="discount-create" onSubmit={submitDiscount}>
                <label>Kode<input required minLength="3" maxLength="30" pattern="[A-Za-z0-9_-]+" value={discountForm.code} onChange={(event) => setDiscountForm({ ...discountForm, code: event.target.value.toUpperCase() })} placeholder="MIS. HEMAT20" /></label>
                <label>Diskon (%)<input required type="number" min="1" max="100" value={discountForm.value} onChange={(event) => setDiscountForm({ ...discountForm, value: event.target.value })} /></label>
                <label>Minimum belanja<input required type="number" min="0" value={discountForm.minimumSubtotal} onChange={(event) => setDiscountForm({ ...discountForm, minimumSubtotal: event.target.value })} /></label>
                <button className="button button-dark">Buat kode ↗</button>
              </form>
              {discounts.map((discount) => <div className="discount-row" key={discount._id}><div><strong>{discount.code}</strong><span>{discount.type === "percentage" ? `${discount.value}%` : money(discount.value)} · Minimum {money(discount.minimumSubtotal)}</span></div><span className={discount.active ? "discount-active" : "discount-inactive"}>{discount.active ? "Aktif" : "Nonaktif"}</span><button className="text-button" onClick={() => toggleDiscount(discount)}>{discount.active ? "Nonaktifkan" : "Aktifkan"}</button></div>)}
            </div>
          </section>
        )}

        {screen === "admin-orders" && user?.role === "admin" && (
          <section className="page-section admin-page">
            <div className="section-heading"><div><p className="eyebrow">DASHBOARD · PENJUALAN</p><h1>Kelola pesanan<span className="brand-dot">.</span></h1><p className="section-subtitle">Lihat pesanan pelanggan dan perbarui status pengiriman.</p></div></div>
            {orders.length ? <div className="order-list">{orders.map((order) => <OrderCard key={order._id} order={order} admin onUpdate={updateOrder} />)}</div> : <div className="empty-state"><span>✳</span><h3>Belum ada pesanan masuk</h3></div>}
          </section>
        )}
      </main>

      <footer className="site-footer"><button className="brand" onClick={() => setScreen("home")}><span className="brand-mark">s.</span><span>shopez<span className="brand-dot">.</span></span></button><span>Dibuat dengan hati, untuk harimu.</span><span>© 2025 ShopEZ</span></footer>

      {cartOpen && <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setCartOpen(false); }}><aside className="cart-drawer"><div className="drawer-heading"><div><p className="eyebrow">BELANJA PILIHANMU</p><h2>Keranjang <span>({cartCount})</span></h2></div><button className="close-button" onClick={() => setCartOpen(false)} aria-label="Tutup">×</button></div>{cart.length ? <><div className="cart-items">{cart.map((item) => <div className="cart-item" key={item._id}><img src={item.image} alt={item.name} /><div className="cart-item-info"><strong>{item.name}</strong><span>{money(item.price)}</span><div className="quantity"><button onClick={() => changeQuantity(item._id, -1)} aria-label="Kurangi">−</button><span>{item.quantity}</span><button onClick={() => changeQuantity(item._id, 1)} aria-label="Tambah">+</button></div></div><button className="remove-item" onClick={() => setCart((current) => current.filter((entry) => entry._id !== item._id))} aria-label={`Hapus ${item.name}`}>×</button></div>)}</div><div className="cart-summary"><form className="coupon-form" onSubmit={applyDiscount}><label htmlFor="cart-discount">Punya kode diskon?</label><div><input id="cart-discount" value={discountCode} onChange={(event) => { setDiscountCode(event.target.value.toUpperCase()); setAppliedDiscount(null); }} placeholder="FIRSTJOY atau SHOP15" /><button disabled={checkingDiscount || !discountCode}>{checkingDiscount ? "..." : "Pakai"}</button></div></form><div><span>Subtotal</span><strong>{money(cartTotal)}</strong></div>{appliedDiscount?.subtotal === cartTotal && <div className="discount-total"><span>Diskon {appliedDiscount.code}</span><strong>−{money(appliedDiscount.amount)}</strong></div>}<div><span>Total</span><strong>{money(appliedDiscount?.subtotal === cartTotal ? appliedDiscount.total : cartTotal)}</strong></div><small>Diskon berlaku pada subtotal produk.</small><button className="button button-dark full-button" onClick={() => { if (!user) { setCartOpen(false); openAuth(); } else { setError(""); setCheckoutOpen(true); } }}>Lanjut checkout <span>↗</span></button></div></> : <div className="empty-state cart-empty"><span>♡</span><h3>Tasmu masih kosong</h3><p>Temukan sesuatu yang bikin harimu lebih menyenangkan.</p><button className="button button-dark" onClick={() => { setCartOpen(false); setScreen("products"); }}>Jelajahi produk ↗</button></div>}</aside></div>}

      {authOpen && <div className="overlay modal-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setAuthOpen(false); }}><section className="modal-card"><button className="close-button modal-close" onClick={() => setAuthOpen(false)} aria-label="Tutup">×</button><span className="modal-flower">✳</span><p className="eyebrow">{authMode === "login" ? "SENANG MELIHATMU LAGI" : "SELAMAT DATANG DI SHOPEZ"}</p><h2>{authMode === "login" ? "Masuk ke akunmu." : "Mulai cerita belanjamu."}</h2><p className="modal-copy">Simpan favorit, lacak pesanan, dan nikmati pengalaman belanja yang lebih personal.</p><form className="stack-form" onSubmit={submitAuth}>{authMode === "register" && <label>Nama lengkap<input name="name" required autoComplete="name" /></label>}<label>Email<input name="email" type="email" required autoComplete="email" /></label><label>Kata sandi<input name="password" type="password" required minLength="8" autoComplete={authMode === "login" ? "current-password" : "new-password"} /></label><button className="button button-dark full-button">{authMode === "login" ? "Masuk ↗" : "Buat akun ↗"}</button></form><p className="switch-auth">{authMode === "login" ? "Belum punya akun?" : "Sudah punya akun?"} <button onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setError(""); }}>{authMode === "login" ? "Daftar di sini" : "Masuk di sini"}</button></p></section></div>}

      {checkoutOpen && <div className="overlay modal-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setCheckoutOpen(false); }}><section className="modal-card checkout-modal"><button className="close-button modal-close" onClick={() => setCheckoutOpen(false)} aria-label="Tutup">×</button><p className="eyebrow">SEDIKIT LAGI SAMPAI</p><h2>Detail pengiriman</h2><p className="modal-copy">Ke mana kami kirim barang pilihanmu?</p><form className="stack-form" onSubmit={submitOrder}><label>Nama penerima<input name="name" required defaultValue={user?.name} autoComplete="name" /></label><label>Nomor telepon<input name="phone" required type="tel" autoComplete="tel" /></label><label>Alamat lengkap<textarea name="address" required rows="2" autoComplete="street-address" /></label><div className="form-row"><label>Kota<input name="city" required autoComplete="address-level2" /></label><label>Kode pos<input name="postalCode" required autoComplete="postal-code" /></label></div><label>Metode pembayaran<select name="paymentMethod"><option value="bank-transfer">Transfer bank</option><option value="e-wallet">E-wallet</option><option value="cash-on-delivery">Bayar di tempat</option></select></label><div className="checkout-total"><span>Subtotal</span><strong>{money(cartTotal)}</strong></div>{appliedDiscount?.subtotal === cartTotal && <div className="checkout-total discount-total"><span>Diskon {appliedDiscount.code}</span><strong>−{money(appliedDiscount.amount)}</strong></div>}<div className="checkout-total"><span>Total pembayaran</span><strong>{money(appliedDiscount?.subtotal === cartTotal ? appliedDiscount.total : cartTotal)}</strong></div><button className="button button-dark full-button">Buat pesanan ↗</button></form></section></div>}

      {selectedProduct && <div className="overlay modal-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedProduct(null); }}><section className="modal-card review-modal"><button className="close-button modal-close" onClick={() => setSelectedProduct(null)} aria-label="Tutup">×</button><p className="eyebrow">CERITA DARI PELANGGAN</p><h2>{selectedProduct.name}</h2><p className="review-summary">★ {selectedProduct.rating?.toFixed(1) || "4.8"} · {selectedProduct.reviews?.length || 0} ulasan</p><div className="review-list">{selectedProduct.reviews?.length ? selectedProduct.reviews.map((review) => <article className="review-entry" key={review._id}><div><strong>{review.name}</strong><span>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span></div><p>{review.comment}</p></article>) : <p className="muted">Belum ada ulasan. Jadilah yang pertama berbagi cerita.</p>}</div>{user ? <form className="stack-form review-form" onSubmit={submitReview}><label>Rating<select value={reviewRating} onChange={(event) => setReviewRating(Number(event.target.value))}>{[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{"★".repeat(rating)} ({rating}/5)</option>)}</select></label><label>Ulasan<textarea required maxLength="1000" rows="3" value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} placeholder="Bagikan pengalamanmu dengan produk ini." /></label><button className="button button-dark full-button" disabled={submittingReview}>{submittingReview ? "Menyimpan..." : "Kirim ulasan ↗"}</button></form> : <button className="button button-dark full-button" onClick={() => { setSelectedProduct(null); openAuth(); }}>Masuk untuk memberi ulasan ↗</button>}</section></div>}

      {(notice || error) && <div className={`toast ${error ? "toast-error" : ""}`} role={error ? "alert" : "status"}><span>{error ? "!" : "✳"}</span><p>{error || notice}</p><button onClick={() => { setNotice(""); setError(""); }} aria-label="Tutup notifikasi">×</button></div>}
    </div>
  );
}

function ProductSection({ title, subtitle, products, loading, onAdd, onReview, onSeeAll, categories, activeCategory, onSelect, compact, search }) {
  return (
    <section className={`product-section page-section ${compact ? "compact-section" : ""}`}>
      <div className="section-heading"><div><p className="eyebrow">DIKURASI UNTUK KAMU</p><h2>{title}</h2><p className="section-subtitle">{subtitle}</p></div>{onSeeAll && <button className="text-button" onClick={onSeeAll}>Lihat semua <span>↗</span></button>}</div>
      {!compact && <div className="category-row">{categories.map((item) => <button key={item} className={activeCategory === item ? "selected" : ""} onClick={() => onSelect(item)}>{item}</button>)}</div>}
      {loading ? <div className="loading-state">Menyiapkan pilihan terbaik untukmu...</div> : products.length ? <div className="product-grid">{products.map((product, index) => <article className="product-card" key={product._id}><div className={`product-image image-tone-${index % 4}`}><img src={product.image} alt={product.name} loading="lazy" />{product.badge && <span className="product-badge">{product.badge}</span>}<button className="quick-add" onClick={() => onAdd(product)} disabled={product.stock < 1} aria-label={`Tambahkan ${product.name} ke keranjang`}>{product.stock > 0 ? "+" : "Habis"}</button></div><div className="product-meta"><span>{product.category}</span><span className="rating">★ {product.rating?.toFixed(1) || "4.8"} · {product.reviews?.length || 0}</span></div><h3>{product.name}</h3><button className="review-link" onClick={() => onReview?.(product)}>Lihat / beri ulasan ↗</button><div className="product-bottom"><strong>{money(product.price)}</strong><span>{product.stock > 0 ? "Siap dikirim" : "Stok habis"}</span></div></article>)}</div> : <div className="empty-state product-empty"><span>⌕</span><h3>{search ? "Belum ada yang cocok" : "Koleksi sedang disiapkan"}</h3><p>{search ? "Coba kata kunci atau kategori lain." : "Cek lagi sebentar ya, pilihan baru segera hadir."}</p></div>}
    </section>
  );
}

function OrderCard({ order, admin, onUpdate }) {
  const date = new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date(order.createdAt));
  const statusLabels = { processing: "Diproses", shipped: "Dikirim", delivered: "Selesai", cancelled: "Dibatalkan" };
  return <article className="order-card"><div className="order-top"><div><span className="order-number">PESANAN #{order._id.slice(-6).toUpperCase()}</span><strong>{date}</strong></div><span className={`status-pill status-${order.status}`}>{statusLabels[order.status] || order.status}</span></div>{admin && order.user && <p className="order-customer">{order.user.name} · {order.user.email}</p>}<div className="order-lines">{order.items.map((item, index) => <div key={`${item.name}-${index}`}><img src={item.image} alt="" /><span>{item.name} <small>× {item.quantity}</small></span><strong>{money(item.price * item.quantity)}</strong></div>)}</div><div className="order-bottom"><span>{order.shippingAddress?.city} · {order.paymentMethod.replaceAll("-", " ")}</span><strong>{money(order.total)}</strong></div>{order.discountCode && <div className="order-discount">Subtotal {money(order.subtotal)} · Diskon {order.discountCode}: −{money(order.discountAmount)}</div>}{admin && <label className="status-control">Perbarui status<select value={order.status} onChange={(event) => onUpdate(order._id, event.target.value)}><option value="processing">Diproses</option><option value="shipped">Dikirim</option><option value="delivered">Selesai</option><option value="cancelled">Dibatalkan</option></select></label>}</article>;
}
