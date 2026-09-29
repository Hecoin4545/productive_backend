const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const LearningPath = require('../models/LearningPath');

// Get all learning paths for user
router.get('/', auth, async (req, res) => {
  try {
    const paths = await LearningPath.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json({ success: true, data: paths });
  } catch (error) {
    console.error('Get learning paths error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get single learning path
router.get('/:id', auth, async (req, res) => {
  try {
    const path = await LearningPath.findOne({ _id: req.params.id, userId: req.userId });
    if (!path) {
      return res.status(404).json({ success: false, message: 'Learning path not found' });
    }
    res.json({ success: true, data: path });
  } catch (error) {
    console.error('Get learning path error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create learning path
router.post('/', auth, async (req, res) => {
  try {
    const { title, description, color } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }

    const path = await LearningPath.create({
      userId: req.userId,
      title,
      description: description || '',
      color: color || '#6366f1'
    });

    res.status(201).json({ success: true, data: path });
  } catch (error) {
    console.error('Create learning path error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update learning path
router.put('/:id', auth, async (req, res) => {
  try {
    const { title, description, progress, status, color } = req.body;
    const updates = {};

    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (progress !== undefined) updates.progress = progress;
    if (status !== undefined) updates.status = status;
    if (color !== undefined) updates.color = color;

    const path = await LearningPath.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      updates,
      { new: true, runValidators: true }
    );

    if (!path) {
      return res.status(404).json({ success: false, message: 'Learning path not found' });
    }

    res.json({ success: true, data: path });
  } catch (error) {
    console.error('Update learning path error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete learning path
router.delete('/:id', auth, async (req, res) => {
  try {
    const path = await LearningPath.findOneAndDelete({ _id: req.params.id, userId: req.userId });

    if (!path) {
      return res.status(404).json({ success: false, message: 'Learning path not found' });
    }

    res.json({ success: true, message: 'Learning path deleted' });
  } catch (error) {
    console.error('Delete learning path error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
