import { Router } from "express";
import {
  createDiscount,
  findDiscount,
  listDiscounts,
  updateDiscount,
  validateDiscount,
} from "../controllers/discountController.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

const router = Router();

router.post("/validate", validateDiscount);
router.get("/", requireAuth, requireAdmin, listDiscounts);
router.post("/", requireAuth, requireAdmin, createDiscount);
router.patch("/:code", requireAuth, requireAdmin, findDiscount, updateDiscount);

export default router;
