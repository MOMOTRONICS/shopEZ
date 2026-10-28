import "dotenv/config";
import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import authRoutes from "./routes/authRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import Product from "./models/Product.js";
import User from "./models/User.js";
import Discount from "./models/Discount.js";
import cartRoutes from "./routes/cartRoutes.js";
import discountRoutes from "./routes/discountRoutes.js";

const app = express();
const port = Number(process.env.PORT) || 8000;

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/discounts", discountRoutes);

app.use((error, _req, res, _next) => {
  console.error(error);
  if (error.name === "ValidationError") {
    return res.status(400).json({ message: error.message });
  }
  if (error.code === 11000) {
    return res.status(409).json({ message: "Data tersebut sudah terdaftar." });
  }
  return res.status(error.status || 500).json({
    message: error.status ? error.message : "Terjadi kesalahan pada server.",
  });
});

if (!process.env.MONGO_URI || !process.env.JWT_SECRET) {
  throw new Error("MONGO_URI dan JWT_SECRET wajib diatur di file server/.env.");
}

await mongoose.connect(process.env.MONGO_URI);
if (Boolean(process.env.ADMIN_EMAIL) !== Boolean(process.env.ADMIN_PASSWORD)) {
  throw new Error("ADMIN_EMAIL dan ADMIN_PASSWORD harus diatur bersama-sama.");
}
if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD.length < 12) {
  throw new Error("ADMIN_PASSWORD harus memiliki minimal 12 karakter.");
}

const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
if (adminEmail && !(await User.exists({ email: adminEmail }))) {
  await User.create({
    name: "ShopEZ Admin",
    email: adminEmail,
    password: process.env.ADMIN_PASSWORD,
    role: "admin",
  });
}

const sampleProducts = [
  {
    name: "Everyday Canvas Tote",
    description: "Tas kanvas ringan untuk menemani hari-hari sibukmu.",
    category: "Aksesori",
    price: 189000,
    image: "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=800&q=80",
    stock: 18,
    rating: 4.9,
    badge: "Favorit",
  },
  {
    name: "Soft Knit Cardigan",
    description: "Rajut lembut dengan warna hangat yang mudah dipadukan.",
    category: "Fashion",
    price: 329000,
    image: "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=800&q=80",
    stock: 12,
    rating: 4.8,
    badge: "Pilihan kami",
  },
  {
    name: "Morning Ritual Cup",
    description: "Cangkir keramik buatan tangan untuk ritual pagimu.",
    category: "Rumah",
    price: 145000,
    image: "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=800&q=80",
    stock: 24,
    rating: 4.9,
    badge: "Buatan lokal",
  },
  {
    name: "Daily Glow Serum",
    description: "Serum wajah ringan dengan bahan pilihan untuk kulit terasa segar.",
    category: "Kecantikan",
    price: 215000,
    image: "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=800&q=80",
    stock: 30,
    rating: 4.7,
    badge: "Baru",
  },
  {
    name: "Weekend Leather Wallet",
    description: "Dompet kulit ringkas yang dirancang untuk penggunaan harian.",
    category: "Aksesori",
    price: 279000,
    image: "https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=800&q=80",
    stock: 9,
    rating: 4.8,
    badge: "",
  },
  {
    name: "Linen Day Shirt",
    description: "Kemeja linen sejuk dengan siluet santai dan timeless.",
    category: "Fashion",
    price: 359000,
    image: "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=800&q=80",
    stock: 14,
    rating: 4.9,
    badge: "Bestseller",
  },
  {
    name: "Little Bloom Vase",
    description: "Vas minimalis yang memberi sentuhan segar pada sudut favoritmu.",
    category: "Rumah",
    price: 169000,
    image: "https://images.unsplash.com/photo-1578500494198-246f612d3b3d?auto=format&fit=crop&w=800&q=80",
    stock: 7,
    rating: 4.8,
    badge: "",
  },
  {
    name: "Everyday Scent Candle",
    description: "Lilin aromaterapi dengan aroma lembut untuk waktu istirahat.",
    category: "Rumah",
    price: 129000,
    image: "https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&w=800&q=80",
    stock: 20,
    rating: 4.7,
    badge: "Hadiah manis",
  },
  {
    name: "Coastal Pearl Earrings",
    description: "Anting mutiara dengan desain sederhana yang cocok untuk setiap suasana.",
    category: "Aksesori",
    price: 159000,
    image: "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=800&q=80",
    stock: 16,
    rating: 4.8,
    badge: "Favorit",
  },
  {
    name: "Sunday Market Sneakers",
    description: "Sneakers kasual yang nyaman untuk langkah santai sepanjang hari.",
    category: "Fashion",
    price: 425000,
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80",
    stock: 11,
    rating: 4.8,
    badge: "Bestseller",
  },
  {
    name: "Calm Day Hand Cream",
    description: "Krim tangan bertekstur ringan untuk menjaga kelembapan saat beraktivitas.",
    category: "Kecantikan",
    price: 89000,
    image: "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=800&q=80",
    stock: 28,
    rating: 4.7,
    badge: "Perawatan diri",
  },
  {
    name: "Cloud Soft Cushion",
    description: "Bantal dekorasi lembut untuk memberi warna nyaman di ruang favoritmu.",
    category: "Rumah",
    price: 199000,
    image: "https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?auto=format&fit=crop&w=800&q=80",
    stock: 13,
    rating: 4.8,
    badge: "",
  },
  {
    name: "Garden Notes Journal",
    description: "Jurnal harian dengan sampul cantik untuk menulis ide dan cerita kecil.",
    category: "Alat tulis",
    price: 79000,
    image: "https://images.unsplash.com/photo-1531346878377-a5be20888e57?auto=format&fit=crop&w=800&q=80",
    stock: 35,
    rating: 4.9,
    badge: "Buatan lokal",
  },
  {
    name: "Golden Hour Sunglasses",
    description: "Kacamata bergaya klasik untuk melengkapi penampilan saat bepergian.",
    category: "Aksesori",
    price: 229000,
    image: "https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=800&q=80",
    stock: 10,
    rating: 4.7,
    badge: "Baru",
  },
  {
    name: "Fresh Start Water Bottle",
    description: "Botol minum praktis untuk menemani aktivitas dan menjaga hidrasi.",
    category: "Gaya hidup",
    price: 119000,
    image: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=800&q=80",
    stock: 22,
    rating: 4.8,
    badge: "",
  },
  {
    name: "Slow Morning Diffuser",
    description: "Diffuser ruangan berdesain minimalis untuk suasana rumah lebih rileks.",
    category: "Rumah",
    price: 249000,
    image: "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=800&q=80",
    stock: 8,
    rating: 4.8,
    badge: "Hadiah manis",
  },
];

const sampleDiscounts = [
  { code: "FIRSTJOY", type: "percentage", value: 10, minimumSubtotal: 100000 },
  { code: "SHOP15", type: "percentage", value: 15, minimumSubtotal: 250000 },
];

await Product.bulkWrite(
  sampleProducts.map((product) => ({
    updateOne: {
      filter: { name: product.name },
      update: { $setOnInsert: product },
      upsert: true,
    },
  })),
);
await Discount.bulkWrite(
  sampleDiscounts.map((discount) => ({
    updateOne: {
      filter: { code: discount.code },
      update: { $setOnInsert: discount },
      upsert: true,
    },
  })),
);
app.listen(port, () => {
  console.log(`ShopEZ API berjalan di http://localhost:${port}`);
});
