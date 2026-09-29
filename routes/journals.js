const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Journal = require('../models/Journal');

// Get all journals for user
router.get('/', auth, async (req, res) => {
  try {
    const { startDate, endDate, mood, tag } = req.query;
    const filter = { userId: req.userId };

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    if (mood) filter.mood = mood;
    if (tag) filter.tags = tag;

    const journals = await Journal.find(filter).sort({ date: -1 });
    res.json({ success: true, data: journals });
  } catch (error) {
    console.error('Get journals error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get single journal
router.get('/:id', auth, async (req, res) => {
  try {
    const journal = await Journal.findOne({ _id: req.params.id, userId: req.userId });
    if (!journal) {
      return res.status(404).json({ success: false, message: 'Journal not found' });
    }
    res.json({ success: true, data: journal });
  } catch (error) {
    console.error('Get journal error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create journal
router.post('/', auth, async (req, res) => {
  try {
    const { title, content, mood, tags, date } = req.body;

    if (!title || !content) {
      return res.status(400).json({ success: false, message: 'Title and content are required' });
    }

    const journal = await Journal.create({
      userId: req.userId,
      title,
      content,
      mood: mood || 'okay',
      tags: tags || [],
      date: date || new Date()
    });

    res.status(201).json({ success: true, data: journal });
  } catch (error) {
    console.error('Create journal error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update journal
router.put('/:id', auth, async (req, res) => {
  try {
    const { title, content, mood, tags, date } = req.body;
    const updates = {};

    if (title !== undefined) updates.title = title;
    if (content !== undefined) updates.content = content;
    if (mood !== undefined) updates.mood = mood;
    if (tags !== undefined) updates.tags = tags;
    if (date !== undefined) updates.date = date;

    const journal = await Journal.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      updates,
      { new: true, runValidators: true }
    );

    if (!journal) {
      return res.status(404).json({ success: false, message: 'Journal not found' });
    }

    res.json({ success: true, data: journal });
  } catch (error) {
    console.error('Update journal error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete journal
router.delete('/:id', auth, async (req, res) => {
  try {
    const journal = await Journal.findOneAndDelete({ _id: req.params.id, userId: req.userId });

    if (!journal) {
      return res.status(404).json({ success: false, message: 'Journal not found' });
    }

    res.json({ success: true, message: 'Journal deleted' });
  } catch (error) {
    console.error('Delete journal error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
