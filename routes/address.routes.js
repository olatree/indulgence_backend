// routes/address.routes.js
const express = require("express");
const mongoose = require("mongoose"); // FIX: was missing — caused ReferenceError on new mongoose.Types.ObjectId()
const router = express.Router();
const { protect } = require("../middlewares/auth.middleware"); // FIX: was commented out — req.user was undefined on every request
const User = require("../models/User");

// Apply auth middleware to all routes in this file
router.use(protect); // FIX: all routes were completely unprotected

// GET /api/users/addresses
router.get("/", async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("addresses defaultAddress");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({
      success: true,
      addresses: user.addresses || [],
      defaultAddress: user.defaultAddress,
    });
  } catch (error) {
    console.error("Get addresses error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch addresses" });
  }
});

// POST /api/users/addresses
router.post("/", async (req, res) => {
  try {
      console.log('Address POST body:', JSON.stringify(req.body, null, 2)); // add this
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const newAddress = {
      ...req.body,
      _id: new mongoose.Types.ObjectId(),
      // If first address, always make it default regardless of what was sent
      isDefault: user.addresses.length === 0 ? true : !!req.body.isDefault,
    };

    // If new address is default, strip default from all others
    if (newAddress.isDefault) {
      user.addresses.forEach((addr) => {
        addr.isDefault = false;
      });
      user.defaultAddress = newAddress._id;
    }

    user.addresses.push(newAddress);
    await user.save();

    res.status(201).json({
      success: true,
      address: newAddress,
      message: "Address saved successfully",
    });
  } catch (error) {
    console.error("Save address error:", error);
    res.status(500).json({ success: false, message: "Failed to save address" });
  }
});

// PUT /api/users/addresses/:id
router.put("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const addressIndex = user.addresses.findIndex(
      (addr) => addr._id.toString() === req.params.id
    );

    if (addressIndex === -1) {
      return res.status(404).json({ success: false, message: "Address not found" });
    }

    Object.assign(user.addresses[addressIndex], req.body);

    if (req.body.isDefault) {
      user.addresses.forEach((addr, index) => {
        addr.isDefault = index === addressIndex;
      });
      user.defaultAddress = user.addresses[addressIndex]._id;
    }

    await user.save();

    res.json({
      success: true,
      address: user.addresses[addressIndex],
      message: "Address updated successfully",
    });
  } catch (error) {
    console.error("Update address error:", error);
    res.status(500).json({ success: false, message: "Failed to update address" });
  }
});

// DELETE /api/users/addresses/:id
router.delete("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const addressId = req.params.id;
    const wasDefault = user.defaultAddress?.toString() === addressId;

    user.addresses = user.addresses.filter(
      (addr) => addr._id.toString() !== addressId
    );

    // If deleted address was default, promote the first remaining address
    if (wasDefault) {
      if (user.addresses.length > 0) {
        user.addresses[0].isDefault = true;
        user.defaultAddress = user.addresses[0]._id;
      } else {
        user.defaultAddress = null;
      }
    }

    await user.save();

    res.json({
      success: true,
      message: "Address deleted successfully",
    });
  } catch (error) {
    console.error("Delete address error:", error);
    res.status(500).json({ success: false, message: "Failed to delete address" });
  }
});

// PUT /api/users/addresses/:id/default
router.put("/:id/default", async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const addressId = req.params.id;
    const addressExists = user.addresses.some(
      (addr) => addr._id.toString() === addressId
    );

    if (!addressExists) {
      return res.status(404).json({ success: false, message: "Address not found" });
    }

    user.addresses.forEach((addr) => {
      addr.isDefault = addr._id.toString() === addressId;
    });
    user.defaultAddress = new mongoose.Types.ObjectId(addressId);

    await user.save();

    res.json({
      success: true,
      message: "Default address updated",
    });
  } catch (error) {
    console.error("Set default address error:", error);
    res.status(500).json({ success: false, message: "Failed to set default address" });
  }
});

module.exports = router;