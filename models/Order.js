// models/Order.js
const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  name: {
    type: String,
    required: true
  },
  image: {
    type: String
  }
});

const shippingAddressSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  address: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  zipCode: { type: String, required: true },
  country: { type: String, required: true, default: 'US' }
}, { _id: false }); // Don't create _id for embedded address

const paymentResultSchema = new mongoose.Schema({
  id: String,
  status: String,
  update_time: String,
  email_address: String
}, { _id: false });

const orderSchema = new mongoose.Schema({
  // Reference to user who placed the order
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Order items (snapshot of products at time of order)
  items: [orderItemSchema],

  // Shipping information (snapshot of address at time of order)
  shippingAddress: shippingAddressSchema,

  // Reference to saved address (if user had one)
  savedAddressId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User.addresses'
  },

  // Payment information
  paymentMethod: {
    type: String,
    required: true,
    enum: ['card', 'cod', 'paypal', 'paystack']
  },

  paymentResult: paymentResultSchema,

  // Order totals
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },

  shippingCost: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },

  tax: {
    type: Number,
    default: 0,
    min: 0
  },

  discount: {
    type: Number,
    default: 0,
    min: 0
  },

  total: {
    type: Number,
    required: true,
    min: 0
  },

  // Coupon applied (if any)
  couponCode: String,
  couponDiscount: Number,

  // Order status
  status: {
    type: String,
    required: true,
    enum: [
      'pending',           // Order placed, awaiting payment/confirmation
      'processing',        // Payment confirmed, preparing to ship
      'shipped',           // Shipped to customer
      'delivered',         // Delivered to customer
      'cancelled',         // Order cancelled
      'refunded',          // Refunded
      'failed'             // Payment failed
    ],
    default: 'pending'
  },

  // Payment status
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },

  // Tracking information
  trackingNumber: String,
  trackingCompany: String,
  trackingUrl: String,

  // Estimated delivery date
  estimatedDelivery: Date,
  deliveredAt: Date,

  // Order notes (customer or admin)
  notes: String,
  adminNotes: String,

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },

  // Cancellation details
  cancelledAt: Date,
  cancellationReason: String,
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Refund details
  refundedAt: Date,
  refundAmount: Number,
  refundReason: String
});

// Update the updatedAt timestamp on save
orderSchema.pre('save', function() {
  this.updatedAt = Date.now();
//   next();
});

// Index for faster queries
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ 'shippingAddress.email': 1 });
orderSchema.index({ createdAt: -1 });

// Virtual for order number (can be used for display)
orderSchema.virtual('orderNumber').get(function() {
  return `ORD-${this._id.toString().slice(-8).toUpperCase()}`;
});

// Method to check if order can be cancelled
orderSchema.methods.canCancel = function() {
  return ['pending', 'processing'].includes(this.status);
};

// Method to calculate totals (if needed)
orderSchema.methods.calculateTotals = function() {
  this.subtotal = this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  this.total = this.subtotal + this.shippingCost + this.tax - this.discount;
  return this.total;
};

// Static method to get orders by user
orderSchema.statics.findByUser = function(userId) {
  return this.find({ user: userId }).sort({ createdAt: -1 });
};

// Static method to get order statistics
orderSchema.statics.getStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: '$total' },
        averageOrderValue: { $avg: '$total' },
        pendingOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
        },
        completedOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] }
        }
      }
    }
  ]);
  return stats[0] || {
    totalOrders: 0,
    totalRevenue: 0,
    averageOrderValue: 0,
    pendingOrders: 0,
    completedOrders: 0
  };
};

module.exports = mongoose.model('Order', orderSchema);