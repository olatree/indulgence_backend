// routes/cart.routes.js
const express = require("express");
const router = express.Router();
const cartController = require("../controllers/cart.controllers");
const { protect } = require("../middlewares/auth.middleware");

router.use(protect); // All cart routes require auth

router.get("/", cartController.getCart);
router.post("/", cartController.addToCart);
router.post("/merge", cartController.mergeCart);
router.put("/:productId", cartController.updateCartItem);
router.delete("/:productId", cartController.removeFromCart);
router.delete("/", cartController.clearCart);

module.exports = router;