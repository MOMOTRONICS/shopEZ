import Discount from "../models/Discount.js";

export function calculateDiscount(discount, subtotal) {
  if (!discount || !discount.active) {
    return { valid: false, message: "Kode diskon tidak valid atau sudah tidak aktif." };
  }
  if (discount.expiresAt && discount.expiresAt <= new Date()) {
    return { valid: false, message: "Masa berlaku kode diskon sudah berakhir." };
  }
  if (subtotal < discount.minimumSubtotal) {
    return {
      valid: false,
      message: `Minimum belanja untuk kode ini ${discount.minimumSubtotal}.`,
    };
  }
  const amount = Math.min(
    subtotal,
    discount.type === "percentage"
      ? Math.floor((subtotal * discount.value) / 100)
      : discount.value,
  );
  return { valid: true, amount };
}

export async function validateDiscount(req, res, next) {
  try {
    const code = typeof req.body?.code === "string" ? req.body.code.trim().toUpperCase() : "";
    const subtotal = req.body?.subtotal;
    if (!code || !Number.isSafeInteger(subtotal) || subtotal < 0) {
      return res.status(400).json({ message: "Kode diskon atau subtotal tidak valid." });
    }
    const discount = await Discount.findOne({ code });
    const result = calculateDiscount(discount, subtotal);
    if (!result.valid) return res.status(400).json({ message: result.message });
    return res.json({
      code: discount.code,
      amount: result.amount,
      total: subtotal - result.amount,
      label:
        discount.type === "percentage"
          ? `Diskon ${discount.value}%`
          : `Potongan ${discount.value}`,
    });
  } catch (error) {
    return next(error);
  }
}

export async function listDiscounts(_req, res, next) {
  try {
    const discounts = await Discount.find().sort({ code: 1 });
    return res.json({ discounts });
  } catch (error) {
    return next(error);
  }
}

export async function createDiscount(req, res, next) {
  try {
    const { code, type, value, minimumSubtotal, expiresAt } = req.body || {};
    if (
      typeof code !== "string" ||
      !/^[A-Za-z0-9_-]{3,30}$/.test(code.trim()) ||
      !["percentage", "fixed"].includes(type) ||
      !Number.isSafeInteger(value) ||
      value < 1 ||
      (type === "percentage" && value > 100) ||
      (minimumSubtotal !== undefined &&
        (!Number.isSafeInteger(minimumSubtotal) || minimumSubtotal < 0)) ||
      (expiresAt && Number.isNaN(Date.parse(expiresAt)))
    ) {
      return res.status(400).json({ message: "Detail kode diskon tidak valid." });
    }
    const discount = await Discount.create({
      code: code.trim().toUpperCase(),
      type,
      value,
      minimumSubtotal: minimumSubtotal ?? 0,
      ...(expiresAt ? { expiresAt: new Date(expiresAt) } : {}),
    });
    return res.status(201).json({ discount });
  } catch (error) {
    return next(error);
  }
}

export async function updateDiscount(req, res, next) {
  try {
    const { active, value, minimumSubtotal, expiresAt } = req.body || {};
    if (
      (active !== undefined && typeof active !== "boolean") ||
      (value !== undefined &&
        (!Number.isSafeInteger(value) ||
          value < 1 ||
          (req.discount.type === "percentage" && value > 100))) ||
      (minimumSubtotal !== undefined &&
        (!Number.isSafeInteger(minimumSubtotal) || minimumSubtotal < 0)) ||
      (expiresAt !== undefined && expiresAt !== null && Number.isNaN(Date.parse(expiresAt)))
    ) {
      return res.status(400).json({ message: "Perubahan kode diskon tidak valid." });
    }
    const updates = {};
    if (active !== undefined) updates.active = active;
    if (value !== undefined) updates.value = value;
    if (minimumSubtotal !== undefined) updates.minimumSubtotal = minimumSubtotal;
    if (expiresAt !== undefined) updates.expiresAt = expiresAt ? new Date(expiresAt) : null;
    const discount = await Discount.findByIdAndUpdate(req.discount.id, updates, {
      new: true,
      runValidators: true,
    });
    return res.json({ discount });
  } catch (error) {
    return next(error);
  }
}

export async function findDiscount(req, res, next) {
  try {
    const discount = await Discount.findOne({ code: req.params.code.toUpperCase() });
    if (!discount) return res.status(404).json({ message: "Kode diskon tidak ditemukan." });
    req.discount = discount;
    return next();
  } catch (error) {
    return next(error);
  }
}
