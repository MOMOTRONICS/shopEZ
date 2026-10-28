import mongoose from "mongoose";
import Cart from "../models/Cart.js";
import Discount from "../models/Discount.js";
import { calculateDiscount } from "./discountController.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";

export async function createOrder(req, res, next) {
  try {
    const { items, shippingAddress, paymentMethod, discountCode } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Keranjang masih kosong." });
    }
    if (items.length > 100) {
      return res.status(400).json({ message: "Jumlah produk dalam pesanan terlalu banyak." });
    }
    const addressFields = ["name", "phone", "address", "city", "postalCode"];
    if (
      !shippingAddress ||
      addressFields.some(
        (field) => typeof shippingAddress[field] !== "string" || !shippingAddress[field].trim(),
      )
    ) {
      return res.status(400).json({ message: "Lengkapi semua informasi pengiriman." });
    }
    if (!["bank-transfer", "e-wallet", "cash-on-delivery"].includes(paymentMethod)) {
      return res.status(400).json({ message: "Metode pembayaran tidak valid." });
    }
    if (
      discountCode !== undefined &&
      discountCode !== null &&
      discountCode !== "" &&
      typeof discountCode !== "string"
    ) {
      return res.status(400).json({ message: "Kode diskon tidak valid." });
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
        return res.status(400).json({ message: "Produk atau jumlah pesanan tidak valid." });
      }
      const quantity = (quantities.get(item.productId) || 0) + item.quantity;
      if (quantity > 100) {
        return res.status(400).json({ message: "Jumlah produk dalam pesanan terlalu banyak." });
      }
      quantities.set(item.productId, quantity);
    }

    const products = await Product.find({ _id: { $in: [...quantities.keys()] } });
    if (products.length !== quantities.size) {
      return res.status(400).json({ message: "Sebagian produk tidak lagi tersedia." });
    }

    const decremented = [];
    let createdOrder;
    try {
      const orderItems = [];
      for (const product of products) {
        const quantity = quantities.get(product.id);
        const stockUpdate = await Product.updateOne(
          { _id: product.id, stock: { $gte: quantity } },
          { $inc: { stock: -quantity } },
        );
        if (stockUpdate.modifiedCount !== 1) {
          throw Object.assign(new Error(`Stok ${product.name} tidak mencukupi.`), { status: 409 });
        }
        decremented.push({ product: product.id, quantity });
        orderItems.push({
          product: product.id,
          name: product.name,
          image: product.image,
          price: product.price,
          quantity,
        });
      }
      const subtotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
      let discountAmount = 0;
      let normalizedDiscountCode = "";
      if (discountCode !== undefined && discountCode !== null && discountCode !== "") {
        normalizedDiscountCode = discountCode.trim().toUpperCase();
        const discount = await Discount.findOne({ code: normalizedDiscountCode });
        const result = calculateDiscount(discount, subtotal);
        if (!result.valid) {
          throw Object.assign(new Error(result.message), { status: 400 });
        }
        discountAmount = result.amount;
      }

      [createdOrder] = await Order.create([{
        user: req.user.id,
        items: orderItems,
        subtotal,
        discountCode: normalizedDiscountCode,
        discountAmount,
        total: subtotal - discountAmount,
        shippingAddress,
        paymentMethod,
      }]);
      await Cart.updateOne({ user: req.user.id }, { $set: { items: [] } });
      return res.status(201).json({ order: createdOrder });
    } catch (error) {
      if (createdOrder) {
        try {
          await Order.deleteOne({ _id: createdOrder.id });
        } catch (cleanupError) {
          console.error("Gagal membatalkan pesanan setelah checkout gagal.", cleanupError);
          return next(new Error("Checkout gagal dan pesanan perlu diperiksa oleh admin."));
        }
      }
      if (decremented.length > 0) {
        try {
          const rollback = await Product.bulkWrite(
            decremented.map(({ product, quantity }) => ({
              updateOne: {
                filter: { _id: product },
                update: { $inc: { stock: quantity } },
              },
            })),
          );
          if (rollback.modifiedCount !== decremented.length) {
            throw new Error("Tidak semua stok pesanan berhasil dikembalikan.");
          }
        } catch (rollbackError) {
          console.error("Gagal mengembalikan stok setelah checkout gagal.", rollbackError);
          return next(new Error("Checkout gagal dan stok perlu diperiksa oleh admin."));
        }
      }
      return next(error);
    }
  } catch (error) {
    return next(error);
  }
}

export async function listOrders(req, res, next) {
  try {
    const filter = req.user.role === "admin" ? {} : { user: req.user.id };
    const orders = await Order.find(filter)
      .populate("user", "name email")
      .sort({ createdAt: -1 });
    return res.json({ orders });
  } catch (error) {
    return next(error);
  }
}

export async function updateOrderStatus(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "ID pesanan tidak valid." });
    }
    const allowedStatuses = ["processing", "shipped", "delivered", "cancelled"];
    if (!allowedStatuses.includes(req.body?.status)) {
      return res.status(400).json({ message: "Status pesanan tidak valid." });
    }
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true, runValidators: true },
    ).populate("user", "name email");
    if (!order) return res.status(404).json({ message: "Pesanan tidak ditemukan." });
    return res.json({ order });
  } catch (error) {
    return next(error);
  }
}
