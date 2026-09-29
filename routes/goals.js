const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Goal = require('../models/Goal');

// Get all goals for user
router.get('/', auth, async (req, res) => {
  try {
    const { type, completed } = req.query;
    const filter = { userId: req.userId };

    if (type) filter.type = type;
    if (completed !== undefined) filter.completed = completed === 'true';

    const goals = await Goal.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, data: goals });
  } catch (error) {
    console.error('Get goals error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get single goal
router.get('/:id', auth, async (req, res) => {
  try {
    const goal = await Goal.findOne({ _id: req.params.id, userId: req.userId });
    if (!goal) {
      return res.status(404).json({ success: false, message: 'Goal not found' });
    }
    res.json({ success: true, data: goal });
  } catch (error) {
    console.error('Get goal error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create goal
router.post('/', auth, async (req, res) => {
  try {
    const { title, description, type, targetValue, unit, deadline } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }

    const goal = await Goal.create({
      userId: req.userId,
      title,
      description: description || '',
      type: type || 'weekly',
      targetValue: targetValue || 0,
      unit: unit || 'hours',
      deadline: deadline || null
    });

    res.status(201).json({ success: true, data: goal });
  } catch (error) {
    console.error('Create goal error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update goal
router.put('/:id', auth, async (req, res) => {
  try {
    const { title, description, type, targetValue, currentValue, unit, completed, deadline } = req.body;
    const updates = {};

    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (type !== undefined) updates.type = type;
    if (targetValue !== undefined) updates.targetValue = targetValue;
    if (currentValue !== undefined) updates.currentValue = currentValue;
    if (unit !== undefined) updates.unit = unit;
    if (completed !== undefined) updates.completed = completed;
    if (deadline !== undefined) updates.deadline = deadline;

    const goal = await Goal.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      updates,
      { new: true, runValidators: true }
    );

    if (!goal) {
      return res.status(404).json({ success: false, message: 'Goal not found' });
    }

    res.json({ success: true, data: goal });
  } catch (error) {
    console.error('Update goal error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete goal
router.delete('/:id', auth, async (req, res) => {
  try {
    const goal = await Goal.findOneAndDelete({ _id: req.params.id, userId: req.userId });

    if (!goal) {
      return res.status(404).json({ success: false, message: 'Goal not found' });
    }

    res.json({ success: true, message: 'Goal deleted' });
  } catch (error) {
    console.error('Delete goal error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
