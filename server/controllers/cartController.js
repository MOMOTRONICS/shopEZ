import mongoose from "mongoose";
import Cart from "../models/Cart.js";
import Product from "../models/Product.js";

function formatCart(cart) {
  return (cart?.items || [])
    .filter((item) => item.product)
    .map((item) => ({ ...item.product.toObject(), quantity: item.quantity }));
}

export async function getCart(req, res, next) {
  try {
    const cart = await Cart.findOne({ user: req.user.id }).populate("items.product");
    return res.json({ items: formatCart(cart) });
  } catch (error) {
    return next(error);
  }
}

export async function replaceCart(req, res, next) {
  try {
    const { items } = req.body || {};
    if (!Array.isArray(items) || items.length > 100) {
      return res.status(400).json({ message: "Format keranjang tidak valid." });
    }

    const quantities = new Map();
    for (const item of items) {
      if (
        !item ||
        typeof item.productId !== "string" ||
        !mongoose.isValidObjectId(item.productId) ||
        !Number.isSafeInteger(item.quantity) ||
        item.quantity < 1
      ) {
        return res.status(400).json({ message: "Produk atau jumlah dalam keranjang tidak valid." });
      }
      const quantity = (quantities.get(item.productId) || 0) + item.quantity;
      if (quantity > 100) {
        return res.status(400).json({ message: "Jumlah produk dalam keranjang terlalu banyak." });
      }
      quantities.set(item.productId, quantity);
    }

    const products = await Product.find({ _id: { $in: [...quantities.keys()] } });
    if (products.length !== quantities.size) {
      return res.status(400).json({ message: "Sebagian produk dalam keranjang tidak tersedia." });
    }
    for (const product of products) {
      if (quantities.get(product.id) > product.stock) {
        return res.status(409).json({ message: `Stok ${product.name} tidak mencukupi.` });
      }
    }

    const cart = await Cart.findOneAndUpdate(
      { user: req.user.id },
      {
        $set: {
          items: products.map((product) => ({
            product: product.id,
            quantity: quantities.get(product.id),
          })),
        },
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    ).populate("items.product");

    return res.json({ items: formatCart(cart) });
  } catch (error) {
    return next(error);
  }
}
