// controllers/cart.controller.js
const Cart = require("../models/Cart");
const Product = require("../models/Product");

// Get cart
exports.getCart = async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user._id })
      .populate("items.product", "name price comparePrice images slug stock status");

    if (!cart) {
      cart = await Cart.create({ user: req.user._id, items: [] });
    }

    // Filter out unavailable products
    cart.items = cart.items.filter(
      (item) => item.product && item.product.status === "active"
    );

    await cart.save();

    res.json({
      success: true,
      data: cart.items,
    });
  } catch (error) {
    console.error("Get cart error:", error);
    res.status(500).json({ message: "Failed to fetch cart" });
  }
};

// Add to cart
exports.addToCart = async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;

    // Validate product
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    if (product.status !== "active") {
      return res.status(400).json({ message: "Product is not available" });
    }
    if (product.stock < quantity) {
      return res.status(400).json({
        message: `Only ${product.stock} items available in stock`,
      });
    }

    // Find or create cart
    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      cart = new Cart({ user: req.user._id, items: [] });
    }

    // Check if product already in cart
    const existingItem = cart.items.find(
      (item) => item.product.toString() === productId
    );

    if (existingItem) {
      // Check total quantity against stock
      const newQuantity = existingItem.quantity + quantity;
      if (newQuantity > product.stock) {
        return res.status(400).json({
          message: `Only ${product.stock} items available. You already have ${existingItem.quantity} in cart.`,
        });
      }
      existingItem.quantity = newQuantity;
    } else {
      cart.items.push({ product: productId, quantity });
    }

    await cart.save();

    // Return populated cart
    await cart.populate(
      "items.product",
      "name price comparePrice images slug stock status"
    );

    res.json({
      success: true,
      data: cart.items,
      message: "Product added to cart",
    });
  } catch (error) {
    console.error("Add to cart error:", error);
    res.status(500).json({ message: "Failed to add to cart" });
  }
};

// Update cart item quantity
exports.updateCartItem = async (req, res) => {
  try {
    const { productId } = req.params;
    const { quantity } = req.body;

    if (quantity < 1) {
      return res.status(400).json({ message: "Quantity must be at least 1" });
    }

    // Validate stock
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    if (quantity > product.stock) {
      return res.status(400).json({
        message: `Only ${product.stock} items available`,
      });
    }

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    const item = cart.items.find(
      (item) => item.product.toString() === productId
    );

    if (!item) {
      return res.status(404).json({ message: "Item not found in cart" });
    }

    item.quantity = quantity;
    await cart.save();

    await cart.populate(
      "items.product",
      "name price comparePrice images slug stock status"
    );

    res.json({
      success: true,
      data: cart.items,
      message: "Cart updated",
    });
  } catch (error) {
    console.error("Update cart error:", error);
    res.status(500).json({ message: "Failed to update cart" });
  }
};

// Remove item from cart
exports.removeFromCart = async (req, res) => {
  try {
    const { productId } = req.params;

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    cart.items = cart.items.filter(
      (item) => item.product.toString() !== productId
    );

    await cart.save();

    await cart.populate(
      "items.product",
      "name price comparePrice images slug stock status"
    );

    res.json({
      success: true,
      data: cart.items,
      message: "Item removed from cart",
    });
  } catch (error) {
    console.error("Remove from cart error:", error);
    res.status(500).json({ message: "Failed to remove from cart" });
  }
};

// Clear cart
exports.clearCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });

    if (cart) {
      cart.items = [];
      await cart.save();
    }

    res.json({
      success: true,
      data: [],
      message: "Cart cleared",
    });
  } catch (error) {
    console.error("Clear cart error:", error);
    res.status(500).json({ message: "Failed to clear cart" });
  }
};

// Merge guest cart with user cart
exports.mergeCart = async (req, res) => {
  try {
    const { items } = req.body;

    if (!items || items.length === 0) {
      return res.json({ success: true, message: "Nothing to merge" });
    }

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      cart = new Cart({ user: req.user._id, items: [] });
    }

    // Merge each guest cart item
    for (const guestItem of items) {
      const product = await Product.findById(guestItem.productId);

      if (!product || product.status !== "active") continue;

      const existingItem = cart.items.find(
        (item) => item.product.toString() === guestItem.productId
      );

      if (existingItem) {
        // Add quantities but cap at stock
        const newQuantity = existingItem.quantity + guestItem.quantity;
        existingItem.quantity = Math.min(newQuantity, product.stock);
      } else {
        const quantity = Math.min(guestItem.quantity, product.stock);
        if (quantity > 0) {
          cart.items.push({ product: guestItem.productId, quantity });
        }
      }
    }

    await cart.save();

    res.json({
      success: true,
      message: "Cart merged successfully",
    });
  } catch (error) {
    console.error("Merge cart error:", error);
    res.status(500).json({ message: "Failed to merge cart" });
  }
};