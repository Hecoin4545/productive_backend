const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Journal = require('../models/Journal');

// Get all journals for user
router.get('/', auth, async (req, res) => {
  try {
    const { startDate, endDate, tag, search, date } = req.query;
    const filter = { userId: req.userId };

    if (date) {
      const d = new Date(date);
      const startOfDay = new Date(d.setHours(0, 0, 0, 0));
      const endOfDay = new Date(d.setHours(23, 59, 59, 999));
      filter.date = { $gte: startOfDay, $lte: endOfDay };
    } else if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    if (tag) filter.tags = tag;

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { whatIDid: { $regex: search, $options: 'i' } },
        { whatILearned: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } },
        { technicalNotes: { $regex: search, $options: 'i' } }
      ];
    }

    const journals = await Journal.find(filter)
      .sort({ date: -1 })
      .populate('linkedLearningPaths', 'title color')
      .populate('linkedTodos')
      .populate('linkedGoals');

    res.json({ success: true, data: journals });
  } catch (error) {
    console.error('Get journals error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get journal by exact date
router.get('/date/:date', auth, async (req, res) => {
  try {
    const d = new Date(req.params.date);
    const startOfDay = new Date(d.setHours(0, 0, 0, 0));
    const endOfDay = new Date(d.setHours(23, 59, 59, 999));

    const journal = await Journal.findOne({
      userId: req.userId,
      date: { $gte: startOfDay, $lte: endOfDay }
    }).populate('linkedLearningPaths').populate('linkedTodos').populate('linkedGoals');

    // It's okay if not found, frontend will show empty state
    res.json({ success: true, data: journal });
  } catch (error) {
    console.error('Get journal by date error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get single journal
router.get('/:id', auth, async (req, res) => {
  try {
    const journal = await Journal.findOne({ _id: req.params.id, userId: req.userId })
      .populate('linkedLearningPaths').populate('linkedTodos').populate('linkedGoals');
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
    const { title, whatIDid, whatILearned, whatWentWell, difficulties, notes, tomorrow, technicalNotes, tags, attachments, linkedLearningPaths, linkedTopics, linkedGoals, linkedTodos, date } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }

    const journal = await Journal.create({
      userId: req.userId,
      title,
      whatIDid: whatIDid || '',
      whatILearned: whatILearned || '',
      whatWentWell: whatWentWell || '',
      difficulties: difficulties || '',
      notes: notes || '',
      tomorrow: tomorrow || '',
      technicalNotes: technicalNotes || '',
      tags: tags || [],
      attachments: attachments || [],
      linkedLearningPaths: linkedLearningPaths || [],
      linkedTopics: linkedTopics || [],
      linkedGoals: linkedGoals || [],
      linkedTodos: linkedTodos || [],
      date: date || new Date()
    });

    const populated = await Journal.findById(journal._id).populate('linkedLearningPaths').populate('linkedTodos').populate('linkedGoals');

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    console.error('Create journal error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update journal
router.patch('/:id', auth, async (req, res) => {
  try {
    const updates = req.body;

    // Remove protected fields
    delete updates.userId;
    delete updates.createdAt;

    const journal = await Journal.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { $set: updates },
      { new: true, runValidators: true }
    ).populate('linkedLearningPaths').populate('linkedTodos').populate('linkedGoals');

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
