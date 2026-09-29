const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const LearningPath = require('../models/LearningPath');
const Module = require('../models/Module');
const Topic = require('../models/Topic');
const Resource = require('../models/Resource');
const Todo = require('../models/Todo');
const Journal = require('../models/Journal');

// Global search across Arcstep
router.get('/global', auth, async (req, res) => {
  try {
    const q = req.query.q || '';
    if (!q.trim()) {
      return res.json({
        success: true,
        data: {
          learningPaths: [],
          topics: [],
          resources: [],
          todos: [],
          journals: []
        }
      });
    }

    const regex = new RegExp(q, 'i');
    const userId = req.userId;

    const [learningPaths, topics, resources, todos, journals] = await Promise.all([
      LearningPath.find({ userId, $or: [{ title: regex }, { description: regex }, { subject: regex }] }).limit(5),
      Topic.find({ userId, $or: [{ title: regex }, { description: regex }] }).populate('learningPathId', 'title').limit(5),
      Resource.find({ userId, $or: [{ title: regex }, { description: regex }, { tags: regex }, { notes: regex }] }).limit(5),
      Todo.find({ userId, $or: [{ title: regex }, { description: regex }] }).limit(5),
      Journal.find({ userId, $or: [{ title: regex }, { whatIDid: regex }, { whatILearned: regex }, { tags: regex }] }).limit(5)
    ]);

    res.json({
      success: true,
      data: {
        query: q,
        learningPaths,
        topics,
        resources,
        todos,
        journals
      }
    });
  } catch (error) {
    console.error('Global search error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
