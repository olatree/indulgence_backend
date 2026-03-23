// routes/contact.routes.js
const express = require('express');
const router = express.Router();
const ContactMessage = require('../../models/ContactMessage');
const { protect, authorize } = require('../../middlewares/auth.middleware');

// Submit contact message (public)
router.post('/', async (req, res) => {
  try {
    const { name, email, subject, message, user } = req.body;
    
    const contactMessage = new ContactMessage({
      name,
      email,
      subject,
      message,
      user: user || null
    });
    
    await contactMessage.save();
    
    // Optional: Send email notification to admin
    // await sendAdminNotification(contactMessage);
    
    res.status(201).json({
      success: true,
      message: 'Message sent successfully'
    });
  } catch (error) {
    console.error('Error saving contact message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message'
    });
  }
});

// Get all contact messages (admin only)
router.get('/admin/messages', protect, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    let query = {};
    if (status) query.status = status;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const messages = await ContactMessage.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await ContactMessage.countDocuments(query);
    const unreadCount = await ContactMessage.countDocuments({ status: 'unread' });
    
    res.json({
      success: true,
      data: messages,
      stats: {
        total,
        unread: unreadCount
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching contact messages:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get single contact message (admin only)
router.get('/admin/messages/:id', protect, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const message = await ContactMessage.findById(req.params.id);
    
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }
    
    // Mark as read if not already
    if (message.status === 'unread') {
      message.status = 'read';
      message.readAt = new Date();
      await message.save();
    }
    
    res.json({
      success: true,
      data: message
    });
  } catch (error) {
    console.error('Error fetching message:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Mark message as replied (admin only)
router.put('/admin/messages/:id/reply', protect, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { adminNote } = req.body;
    
    const message = await ContactMessage.findById(req.params.id);
    
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }
    
    message.status = 'replied';
    message.adminNote = adminNote;
    message.repliedAt = new Date();
    
    await message.save();
    
    // Optional: Send email reply to user
    // await sendReplyEmail(message.email, adminNote);
    
    res.json({
      success: true,
      message: 'Message marked as replied',
      data: message
    });
  } catch (error) {
    console.error('Error updating message:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Delete contact message (admin only)
router.delete('/admin/messages/:id', protect, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const message = await ContactMessage.findByIdAndDelete(req.params.id);
    
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;