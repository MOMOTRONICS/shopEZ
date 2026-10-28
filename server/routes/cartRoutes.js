import { Router } from "express";
import { getCart, replaceCart } from "../controllers/cartController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);
router.get("/", getCart);
router.put("/", replaceCart);

export default router;
