const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const axios = require('axios');
const Order = require('../models/Order');
const { protect } = require('../middlewares/auth.middleware');

// POST /api/orders - Create a new order (always starts as pending)
router.post('/', protect, async (req, res) => {
  try {
    const { shippingAddress, items, paymentMethod, ...orderData } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'No items in order' });
    }
    if (!shippingAddress) {
      return res.status(400).json({ success: false, message: 'Shipping address is required' });
    }
    if (!paymentMethod) {
      return res.status(400).json({ success: false, message: 'Payment method is required' });
    }

    // Ensure each item has a name (required by Order schema)
    const populatedItems = await Promise.all(
      items.map(async (item) => {
        if (item.name) return item;
        const Product = mongoose.model('Product');
        const product = await Product.findById(item.product).select('name images');
        return {
          ...item,
          name: product?.name || 'Product',
          image: product?.images?.[0]?.url || product?.images?.[0] || '',
        };
      })
    );

    const order = new Order({
      user: req.user._id,
      items: populatedItems,
      shippingAddress,
      paymentMethod,
      status: 'pending',
      paymentStatus: 'pending',
      ...orderData,
    });

    await order.save();

    res.status(201).json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to create order' });
  }
});

// POST /api/orders/:id/verify-payment - Verify Paystack payment and update order
router.post('/:id/verify-payment', protect, async (req, res) => {
  try {
    const { reference } = req.body;

    if (!reference) {
      return res.status(400).json({ success: false, message: 'Payment reference is required' });
    }

    // Verify with Paystack
    const paystackRes = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const paystackData = paystackRes.data.data;

    if (paystackData.status !== 'success') {
      return res.status(400).json({ success: false, message: 'Payment verification failed' });
    }

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Verify amount matches (Paystack returns amount in kobo)
    const paidAmountInNaira = paystackData.amount / 100;
    if (paidAmountInNaira !== order.total) {
      console.warn(`Amount mismatch: paid ${paidAmountInNaira}, order total ${order.total}`);
    }

    order.paymentStatus = 'paid';
    order.status = 'processing';
    order.paymentResult = {
      id: String(paystackData.id),
      status: paystackData.status,
      update_time: paystackData.paid_at,
      email_address: paystackData.customer.email,
    };

    await order.save();

    res.json({
      success: true,
      data: order,
      message: 'Payment verified successfully',
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ success: false, message: 'Payment verification failed' });
  }
});

// GET /api/orders - Get all orders for logged-in user
router.get('/', protect, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, orders });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch orders' });
  }
});

// GET /api/orders/:id - Get a single order by ID
router.get('/:id', protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.user.toString() !== req.user._id.toString() && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to view this order' });
    }

    res.json({ success: true, data: order });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch order' });
  }
});

// PUT /api/orders/:id/cancel - Cancel an order
router.put('/:id/cancel', protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (!order.canCancel()) {
      return res.status(400).json({
        success: false,
        message: `Order cannot be cancelled in '${order.status}' status`,
      });
    }

    order.status = 'cancelled';
    order.cancelledAt = new Date();
    order.cancellationReason = req.body.reason || 'Cancelled by customer';
    order.cancelledBy = req.user._id;

    await order.save();

    res.json({ success: true, data: order, message: 'Order cancelled successfully' });
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel order' });
  }
});

module.exports = router;