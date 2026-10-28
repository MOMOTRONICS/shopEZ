import mongoose from "mongoose";
import Product from "../models/Product.js";

export async function createReview(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "ID produk tidak valid." });
    }
    const { rating, comment } = req.body || {};
    if (
      !Number.isSafeInteger(rating) ||
      rating < 1 ||
      rating > 5 ||
      typeof comment !== "string" ||
      !comment.trim() ||
      comment.trim().length > 1000
    ) {
      return res.status(400).json({ message: "Beri rating 1–5 dan ulasan maksimal 1.000 karakter." });
    }

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Produk tidak ditemukan." });

    const existing = product.reviews.find((review) => review.user.equals(req.user.id));
    if (existing) {
      existing.rating = rating;
      existing.comment = comment.trim();
    } else {
      product.reviews.push({
        user: req.user.id,
        name: req.user.name,
        rating,
        comment: comment.trim(),
      });
    }
    product.rating =
      Math.round(
        (product.reviews.reduce((total, review) => total + review.rating, 0) /
          product.reviews.length) *
          10,
      ) / 10;

    await product.save();
    return res.status(201).json({ product });
  } catch (error) {
    return next(error);
  }
}
