const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Todo = require('../models/Todo');
const Goal = require('../models/Goal');
const StudySession = require('../models/StudySession');
const LearningPath = require('../models/LearningPath');
const Journal = require('../models/Journal');

// Get dashboard overview data
router.get('/overview', auth, async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);

    // Get stats
    const [
      totalTodos,
      completedTodos,
      activePaths,
      activeGoals,
      todayStudyTime,
      weekStudyTime,
      recentJournals
    ] = await Promise.all([
      Todo.countDocuments({ userId: req.userId }),
      Todo.countDocuments({ userId: req.userId, completed: true }),
      LearningPath.countDocuments({ userId: req.userId, status: 'active' }),
      Goal.countDocuments({ userId: req.userId, completed: false }),
      StudySession.aggregate([
        { $match: { userId: req.userId, date: { $gte: todayStart } } },
        { $group: { _id: null, total: { $sum: '$duration' } } }
      ]),
      StudySession.aggregate([
        { $match: { userId: req.userId, date: { $gte: weekStart } } },
        { $group: { _id: null, total: { $sum: '$duration' } } }
      ]),
      Journal.find({ userId: req.userId }).sort({ date: -1 }).limit(3)
    ]);

    const todayMinutes = todayStudyTime[0]?.total || 0;
    const weekMinutes = weekStudyTime[0]?.total || 0;

    res.json({
      success: true,
      data: {
        todos: {
          total: totalTodos,
          completed: completedTodos,
          pending: totalTodos - completedTodos
        },
        learningPaths: {
          active: activePaths
        },
        goals: {
          active: activeGoals
        },
        studyTime: {
          today: todayMinutes,
          todayHours: Math.round(todayMinutes / 60 * 10) / 10,
          week: weekMinutes,
          weekHours: Math.round(weekMinutes / 60 * 10) / 10
        },
        recentJournals
      }
    });
  } catch (error) {
    console.error('Get dashboard overview error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get study activity for chart
router.get('/study-activity', auth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const sessions = await StudySession.aggregate([
      {
        $match: {
          userId: req.userId,
          date: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$date' }
          },
          duration: { $sum: '$duration' },
          sessions: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Fill in missing days with 0
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const existing = sessions.find(s => s._id === dateStr);
      result.push({
        date: dateStr,
        duration: existing ? existing.duration : 0,
        hours: existing ? Math.round(existing.duration / 60 * 10) / 10 : 0,
        sessions: existing ? existing.sessions : 0
      });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Get study activity error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get learning paths progress
router.get('/learning-progress', auth, async (req, res) => {
  try {
    const paths = await LearningPath.find({
      userId: req.userId,
      status: 'active'
    })
    .sort({ updatedAt: -1 })
    .limit(5);

    res.json({ success: true, data: paths });
  } catch (error) {
    console.error('Get learning progress error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
