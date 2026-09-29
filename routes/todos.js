const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Todo = require('../models/Todo');

// Get all todos for user
router.get('/', auth, async (req, res) => {
  try {
    const { completed, learningPathId, type, date } = req.query;
    const filter = { userId: req.userId };

    if (completed !== undefined) {
      filter.completed = completed === 'true';
    }
    if (learningPathId) {
      filter.learningPathId = learningPathId;
    }
    if (type) {
      filter.type = type;
    }
    if (date) {
      const d = new Date(date);
      const startOfDay = new Date(d.setHours(0, 0, 0, 0));
      const endOfDay = new Date(d.setHours(23, 59, 59, 999));
      filter.dueDate = { $gte: startOfDay, $lte: endOfDay };
    }

    const todos = await Todo.find(filter).sort({ createdAt: -1 }).populate('learningPathId', 'title color');
    res.json({ success: true, data: todos });
  } catch (error) {
    console.error('Get todos error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get single todo
router.get('/:id', auth, async (req, res) => {
  try {
    const todo = await Todo.findOne({ _id: req.params.id, userId: req.userId }).populate('learningPathId', 'title color');
    if (!todo) {
      return res.status(404).json({ success: false, message: 'Todo not found' });
    }
    res.json({ success: true, data: todo });
  } catch (error) {
    console.error('Get todo error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create todo
router.post('/', auth, async (req, res) => {
  try {
    const { title, description, priority, dueDate, dueTime, startTime, endTime, estimatedDuration, type, tags, learningPathId } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }

    const todo = await Todo.create({
      userId: req.userId,
      title,
      description: description || '',
      priority: priority || 'medium',
      dueDate: dueDate || null,
      dueTime: dueTime || '',
      startTime: startTime || '',
      endTime: endTime || '',
      estimatedDuration: estimatedDuration || '',
      type: type || 'todo',
      tags: tags || [],
      learningPathId: learningPathId || null
    });

    const populatedTodo = await Todo.findById(todo._id).populate('learningPathId', 'title color');
    res.status(201).json({ success: true, data: populatedTodo });
  } catch (error) {
    console.error('Create todo error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update todo
router.put('/:id', auth, async (req, res) => {
  try {
    const { title, description, completed, priority, dueDate, dueTime, startTime, endTime, estimatedDuration, type, tags, learningPathId } = req.body;
    const updates = {};

    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (completed !== undefined) updates.completed = completed;
    if (priority !== undefined) updates.priority = priority;
    if (dueDate !== undefined) updates.dueDate = dueDate;
    if (dueTime !== undefined) updates.dueTime = dueTime;
    if (startTime !== undefined) updates.startTime = startTime;
    if (endTime !== undefined) updates.endTime = endTime;
    if (estimatedDuration !== undefined) updates.estimatedDuration = estimatedDuration;
    if (type !== undefined) updates.type = type;
    if (tags !== undefined) updates.tags = tags;
    if (learningPathId !== undefined) updates.learningPathId = learningPathId;

    const todo = await Todo.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      updates,
      { new: true, runValidators: true }
    ).populate('learningPathId', 'title color');

    if (!todo) {
      return res.status(404).json({ success: false, message: 'Todo not found' });
    }

    res.json({ success: true, data: todo });
  } catch (error) {
    console.error('Update todo error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete todo
router.delete('/:id', auth, async (req, res) => {
  try {
    const todo = await Todo.findOneAndDelete({ _id: req.params.id, userId: req.userId });

    if (!todo) {
      return res.status(404).json({ success: false, message: 'Todo not found' });
    }

    res.json({ success: true, message: 'Todo deleted' });
  } catch (error) {
    console.error('Delete todo error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
