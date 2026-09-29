const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const StudySession = require('../models/StudySession');

// Get all study sessions for user
router.get('/', auth, async (req, res) => {
  try {
    const { learningPathId, startDate, endDate } = req.query;
    const filter = { userId: req.userId };

    if (learningPathId) {
      filter.learningPathId = learningPathId;
    }

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const sessions = await StudySession.find(filter)
      .sort({ date: -1 })
      .populate('learningPathId', 'title color');

    res.json({ success: true, data: sessions });
  } catch (error) {
    console.error('Get study sessions error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get single study session
router.get('/:id', auth, async (req, res) => {
  try {
    const session = await StudySession.findOne({ _id: req.params.id, userId: req.userId })
      .populate('learningPathId', 'title color');

    if (!session) {
      return res.status(404).json({ success: false, message: 'Study session not found' });
    }

    res.json({ success: true, data: session });
  } catch (error) {
    console.error('Get study session error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create study session
router.post('/', auth, async (req, res) => {
  try {
    const { duration, topic, notes, learningPathId, date } = req.body;

    if (!duration) {
      return res.status(400).json({ success: false, message: 'Duration is required' });
    }

    const session = await StudySession.create({
      userId: req.userId,
      duration,
      topic: topic || '',
      notes: notes || '',
      learningPathId: learningPathId || null,
      date: date || new Date()
    });

    const populatedSession = await StudySession.findById(session._id)
      .populate('learningPathId', 'title color');

    res.status(201).json({ success: true, data: populatedSession });
  } catch (error) {
    console.error('Create study session error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update study session
router.put('/:id', auth, async (req, res) => {
  try {
    const { duration, topic, notes, learningPathId, date } = req.body;
    const updates = {};

    if (duration !== undefined) updates.duration = duration;
    if (topic !== undefined) updates.topic = topic;
    if (notes !== undefined) updates.notes = notes;
    if (learningPathId !== undefined) updates.learningPathId = learningPathId;
    if (date !== undefined) updates.date = date;

    const session = await StudySession.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      updates,
      { new: true, runValidators: true }
    ).populate('learningPathId', 'title color');

    if (!session) {
      return res.status(404).json({ success: false, message: 'Study session not found' });
    }

    res.json({ success: true, data: session });
  } catch (error) {
    console.error('Update study session error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete study session
router.delete('/:id', auth, async (req, res) => {
  try {
    const session = await StudySession.findOneAndDelete({ _id: req.params.id, userId: req.userId });

    if (!session) {
      return res.status(404).json({ success: false, message: 'Study session not found' });
    }

    res.json({ success: true, message: 'Study session deleted' });
  } catch (error) {
    console.error('Delete study session error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get study stats
router.get('/stats/summary', auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const filter = { userId: req.userId };

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const sessions = await StudySession.find(filter);

    const totalMinutes = sessions.reduce((sum, session) => sum + session.duration, 0);
    const totalSessions = sessions.length;
    const averageMinutes = totalSessions > 0 ? Math.round(totalMinutes / totalSessions) : 0;

    res.json({
      success: true,
      data: {
        totalMinutes,
        totalHours: Math.round(totalMinutes / 60 * 10) / 10,
        totalSessions,
        averageMinutes
      }
    });
  } catch (error) {
    console.error('Get study stats error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
