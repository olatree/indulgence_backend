// routes/admin/orders.routes.js
const express = require('express');
const router = express.Router();
const Order = require('../../models/Order');
const { protect, authorize } = require('../../middlewares/auth.middleware');

// Get all orders with filtering (admin only)
router.get('/', protect, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { 
      status, 
      paymentStatus, 
      fromDate, 
      toDate, 
      search,
      page = 1,
      limit = 20
    } = req.query;
    
    let query = {};
    
    // Status filter
    if (status && status !== 'all') {
      query.status = status;
    }
    
    // Payment status filter
    if (paymentStatus && paymentStatus !== 'all') {
      query.paymentStatus = paymentStatus;
    }
    
    // Date range filter
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) {
        query.createdAt.$gte = new Date(fromDate);
      }
      if (toDate) {
        const endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999);
        query.createdAt.$lte = endDate;
      }
    }
    
    // Search filter
    if (search) {
      query.$or = [
        { _id: { $regex: search, $options: 'i' } },
        { 'shippingAddress.firstName': { $regex: search, $options: 'i' } },
        { 'shippingAddress.lastName': { $regex: search, $options: 'i' } },
        { 'shippingAddress.email': { $regex: search, $options: 'i' } },
        { 'shippingAddress.phone': { $regex: search, $options: 'i' } }
      ];
    }
    
    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get orders with user population
    const orders = await Order.find(query)
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get total count for pagination
    const total = await Order.countDocuments(query);
    
    // Build a stats-specific match that always includes the date range
    // but excludes any status filter (so all statuses are counted in stats)
    const statsMatch = {};
    if (query.createdAt) {
      statsMatch.createdAt = query.createdAt;
    }

    // Get statistics — scoped to the same date range as the request
    const stats = await Order.aggregate([
      {
        $match: statsMatch   // <-- this is the fix: filter by date before grouping
      },
      {
        $group: {
          _id: null,
          totalOrders: {
            $sum: { $cond: [{ $ne: ['$status', 'cancelled'] }, 1, 0] }
          },
          totalRevenue: {
            $sum: { $cond: [{ $ne: ['$status', 'cancelled'] }, '$total', 0] }
          },
          pendingOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          processingOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'processing'] }, 1, 0] }
          },
          shippedOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'shipped'] }, 1, 0] }
          },
          deliveredOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] }
          },
          cancelledOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
          },
          paidOrders: {
            $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, 1, 0] }
          }
        }
      }
    ]);
    
    res.json({ 
      success: true, 
      orders,
      stats: stats[0] || {
        totalOrders: 0,
        totalRevenue: 0,
        pendingOrders: 0,
        processingOrders: 0,
        shippedOrders: 0,
        deliveredOrders: 0,
        cancelledOrders: 0,
        paidOrders: 0
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Admin get orders error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get single order details (admin only)
router.get('/:id', protect, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'name email phone')
      .populate('items.product', 'name images price');
    
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    res.json({ success: true, data: order });
  } catch (error) {
    console.error('Admin get order error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update order status (admin only)
router.put('/:id/status', protect, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { status, note, trackingNumber, carrier } = req.body;
    
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    // Initialize status history if it doesn't exist
    if (!order.statusHistory) {
      order.statusHistory = [];
    }
    
    // Add to status history
    order.statusHistory.push({
      status,
      note,
      updatedBy: req.user._id,
      updatedAt: new Date()
    });
    
    // Update order status
    order.status = status;
    
    // Set specific timestamps based on status
    const now = new Date();
    switch (status) {
      case 'processing':
        if (!order.processedAt) order.processedAt = now;
        break;
      case 'shipped':
        if (!order.shippedAt) order.shippedAt = now;
        if (trackingNumber) order.trackingNumber = trackingNumber;
        if (carrier) order.carrier = carrier;
        break;
      case 'delivered':
        if (!order.deliveredAt) order.deliveredAt = now;
        break;
      case 'cancelled':
        if (!order.cancelledAt) {
          order.cancelledAt = now;
          order.cancelledBy = req.user._id;
          order.cancellationReason = note || 'Cancelled by admin';
        }
        break;
    }
    
    await order.save();
    
    // TODO: Send email notification to customer
    // await sendOrderStatusEmail(order, order.user, status, note);
    
    res.json({ 
      success: true, 
      message: `Order status updated to ${status}`,
      data: order 
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Bulk update orders (admin only)
router.post('/bulk', protect, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { action, orderIds, data } = req.body;
    
    if (!action || !orderIds || !orderIds.length) {
      return res.status(400).json({ success: false, message: 'Invalid request' });
    }
    
    let update = {};
    let message = '';
    
    switch (action) {
      case 'status':
        if (!data?.status) {
          return res.status(400).json({ success: false, message: 'Status is required' });
        }
        update = { 
          status: data.status,
          $push: {
            statusHistory: {
              status: data.status,
              note: data.note || 'Bulk status update',
              updatedBy: req.user._id,
              updatedAt: new Date()
            }
          }
        };
        message = `Orders updated to ${data.status}`;
        break;
        
      case 'delete':
        await Order.deleteMany({ _id: { $in: orderIds } });
        return res.json({ 
          success: true, 
          message: `${orderIds.length} orders deleted successfully` 
        });
        
      case 'export':
        const orders = await Order.find({ _id: { $in: orderIds } })
          .populate('user', 'name email');
        return res.json({ success: true, data: orders });
        
      default:
        return res.status(400).json({ success: false, message: 'Invalid action' });
    }
    
    await Order.updateMany(
      { _id: { $in: orderIds } },
      { $set: update }
    );
    
    res.json({ 
      success: true, 
      message: message || `Bulk action '${action}' completed successfully` 
    });
  } catch (error) {
    console.error('Bulk update error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Export orders to CSV (admin only)
router.get('/export/csv', protect, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { status, fromDate, toDate } = req.query;
    
    let query = {};
    if (status && status !== 'all') query.status = status;
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = new Date(fromDate);
      if (toDate) {
        const endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999);
        query.createdAt.$lte = endDate;
      }
    }
    
    const orders = await Order.find(query)
      .populate('user', 'name email')
      .sort({ createdAt: -1 });
    
    const headers = [
      'Order ID', 'Date', 'Customer Name', 'Email', 'Phone',
      'Address', 'City', 'State', 'Country', 'Items',
      'Subtotal', 'Shipping', 'Total', 'Status',
      'Payment Status', 'Payment Method', 'Tracking Number'
    ];
    
    const rows = orders.map(order => [
      order._id.toString(),
      new Date(order.createdAt).toISOString(),
      `${order.shippingAddress?.firstName || ''} ${order.shippingAddress?.lastName || ''}`.trim(),
      order.shippingAddress?.email || '',
      order.shippingAddress?.phone || '',
      order.shippingAddress?.address || '',
      order.shippingAddress?.city || '',
      order.shippingAddress?.state || '',
      order.shippingAddress?.country || '',
      order.items?.map(item => `${item.name} (${item.quantity})`).join('; ') || '',
      order.subtotal || 0,
      order.shippingCost || 0,
      order.total || 0,
      order.status || '',
      order.paymentStatus || '',
      order.paymentMethod || '',
      order.trackingNumber || ''
    ]);
    
    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => {
        if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"'))) {
          return `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
      }).join(','))
    ].join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=orders-export-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('Export orders error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get order statistics (admin only)
router.get('/stats/overview', protect, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    
    let dateFilter = {};
    const now = new Date();
    
    switch (period) {
      case 'today':
        dateFilter = {
          $gte: new Date(now.setHours(0, 0, 0, 0)),
          $lte: new Date(now.setHours(23, 59, 59, 999))
        };
        break;
      case 'week':
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        dateFilter = { $gte: weekAgo };
        break;
      case 'month':
        const monthAgo = new Date(now);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        dateFilter = { $gte: monthAgo };
        break;
      case 'year':
        const yearAgo = new Date(now);
        yearAgo.setFullYear(yearAgo.getFullYear() - 1);
        dateFilter = { $gte: yearAgo };
        break;
    }
    
    const timelineStats = await Order.aggregate([
      { $match: { createdAt: dateFilter } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
            week: { $week: '$createdAt' }
          },
          count: { $sum: 1 },
          revenue: { $sum: '$total' },
          date: { $first: '$createdAt' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);
    
    const statusDistribution = await Order.aggregate([
      { $match: { createdAt: dateFilter } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          revenue: { $sum: '$total' }
        }
      }
    ]);
    
    const paymentMethodDistribution = await Order.aggregate([
      { $match: { createdAt: dateFilter } },
      {
        $group: {
          _id: '$paymentMethod',
          count: { $sum: 1 },
          revenue: { $sum: '$total' }
        }
      }
    ]);
    
    const topCustomers = await Order.aggregate([
      { $match: { createdAt: dateFilter } },
      {
        $group: {
          _id: '$user',
          orderCount: { $sum: 1 },
          totalSpent: { $sum: '$total' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      { $sort: { totalSpent: -1 } },
      { $limit: 10 },
      {
        $project: {
          _id: 1,
          name: '$user.name',
          email: '$user.email',
          orderCount: 1,
          totalSpent: 1
        }
      }
    ]);
    
    res.json({
      success: true,
      data: { timeline: timelineStats, statusDistribution, paymentMethodDistribution, topCustomers }
    });
  } catch (error) {
    console.error('Get order stats error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update tracking information (admin only)
router.put('/:id/tracking', protect, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { trackingNumber, carrier, estimatedDelivery } = req.body;
    
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    order.trackingNumber = trackingNumber;
    order.carrier = carrier;
    if (estimatedDelivery) {
      order.estimatedDelivery = new Date(estimatedDelivery);
    }
    
    await order.save();
    
    res.json({ success: true, message: 'Tracking information updated', data: order });
  } catch (error) {
    console.error('Update tracking error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Add note to order (admin only)
router.post('/:id/notes', protect, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { note, type = 'internal' } = req.body;
    
    if (!note) {
      return res.status(400).json({ success: false, message: 'Note is required' });
    }
    
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    if (!order.notes) {
      order.notes = [];
    }
    
    order.notes.push({
      content: note,
      type,
      createdBy: req.user._id,
      createdAt: new Date()
    });
    
    await order.save();
    
    res.json({ 
      success: true, 
      message: 'Note added successfully',
      data: order.notes[order.notes.length - 1]
    });
  } catch (error) {
    console.error('Add note error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// routes/auth/user.routes.js (or wherever your user routes are)
// Add this endpoint for user stats

// Get user statistics summary (admin only)
router.get('users/stats/summary', protect, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    
    // Get current month start date
    const currentMonthStart = new Date();
    currentMonthStart.setDate(1);
    currentMonthStart.setHours(0, 0, 0, 0);
    
    const newUsers = await User.countDocuments({
      createdAt: { $gte: currentMonthStart }
    });
    
    // Get previous month start date for growth calculation
    const previousMonthStart = new Date(currentMonthStart);
    previousMonthStart.setMonth(previousMonthStart.getMonth() - 1);
    const previousMonthEnd = new Date(currentMonthStart);
    previousMonthEnd.setMilliseconds(-1);
    
    const previousNewUsers = await User.countDocuments({
      createdAt: { 
        $gte: previousMonthStart,
        $lte: previousMonthEnd
      }
    });
    
    // Calculate growth percentage
    let userGrowth = '→ No change';
    if (previousNewUsers > 0) {
      const growth = ((newUsers - previousNewUsers) / previousNewUsers) * 100;
      userGrowth = growth >= 0 ? `↑ ${growth.toFixed(1)}%` : `↓ ${Math.abs(growth).toFixed(1)}%`;
    } else if (newUsers > 0) {
      userGrowth = '↑ 100%';
    }
    
    res.json({ 
      total: totalUsers, 
      newUsers,
      userGrowth
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get top products for date range (admin only)
router.get('/admin/top-products', protect, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    
    let query = { status: 'delivered' }; // Only completed orders
    
    // Date range filter
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) {
        query.createdAt.$gte = new Date(fromDate);
      }
      if (toDate) {
        const endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999);
        query.createdAt.$lte = endDate;
      }
    }
    
    const orders = await Order.find(query).select('items');
    
    // Aggregate product data
    const productMap = new Map();
    orders.forEach(order => {
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach(item => {
          const productId = item.product?._id || item.product;
          if (productId) {
            if (productMap.has(productId.toString())) {
              const existing = productMap.get(productId.toString());
              existing.quantity += item.quantity || 1;
              existing.revenue += (item.price || 0) * (item.quantity || 1);
            } else {
              productMap.set(productId.toString(), {
                id: productId,
                name: item.name || 'Unknown Product',
                quantity: item.quantity || 1,
                revenue: (item.price || 0) * (item.quantity || 1),
              });
            }
          }
        });
      }
    });
    
    const topProducts = Array.from(productMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
    
    res.json({ success: true, data: topProducts });
  } catch (error) {
    console.error('Error fetching top products:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;