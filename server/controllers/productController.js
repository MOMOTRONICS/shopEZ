import mongoose from "mongoose";
import Product from "../models/Product.js";

export async function listProducts(req, res, next) {
  try {
    const filter = {};
    if (req.query.category && req.query.category !== "all") {
      filter.category = req.query.category;
    }
    if (req.query.search) {
      const search = req.query.search.trim().slice(0, 100);
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.name = { $regex: escapedSearch, $options: "i" };
    }
    const products = await Product.find(filter).sort({ createdAt: -1 });
    return res.json({ products });
  } catch (error) {
    return next(error);
  }
}

export async function createProduct(req, res, next) {
  try {
    const product = await Product.create(req.body);
    return res.status(201).json({ product });
  } catch (error) {
    return next(error);
  }
}

export async function updateProduct(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "ID produk tidak valid." });
    }
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!product) return res.status(404).json({ message: "Produk tidak ditemukan." });
    return res.json({ product });
  } catch (error) {
    return next(error);
  }
}

export async function deleteProduct(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "ID produk tidak valid." });
    }
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: "Produk tidak ditemukan." });
    return res.json({ message: "Produk berhasil dihapus." });
  } catch (error) {
    return next(error);
  }
}
