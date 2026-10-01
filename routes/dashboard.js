const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Todo = require('../models/Todo');
const Goal = require('../models/Goal');
const StudySession = require('../models/StudySession');
const LearningPath = require('../models/LearningPath');

// Get dashboard overview data - comprehensive
router.get('/overview', auth, async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 6); // Last 7 days including today

    // Get all data in parallel
    const [
      todos,
      goals,
      todayStudySessions,
      learningPaths,
      weekStudySessions
    ] = await Promise.all([
      Todo.find({ userId: req.userId }).populate('learningPathId', 'title color').sort({ createdAt: -1 }).limit(10),
      Goal.find({ userId: req.userId }).sort({ createdAt: -1 }).limit(6),
      StudySession.find({ userId: req.userId, date: { $gte: todayStart } })
        .populate('learningPathId', 'title color')
        .sort({ date: -1 }),
      LearningPath.find({ userId: req.userId, status: 'active' }).sort({ updatedAt: -1 }),
      StudySession.find({ userId: req.userId, date: { $gte: weekStart } })
    ]);

    // Calculate stats
    const todayMinutes = Math.round(todayStudySessions.reduce((sum, s) => sum + (s.duration || 0), 0) / 60);
    const completedTodos = todos.filter(t => t.completed).length;
    const completedGoals = goals.filter(g => g.completed).length;

    // Overall progress (average of all learning paths)
    const overallProgress = learningPaths.length > 0
      ? Math.round(learningPaths.reduce((sum, p) => sum + p.progress, 0) / learningPaths.length)
      : 0;

    // Weekly study data
    const weeklyData = [];
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const daySessions = weekStudySessions.filter(s => {
        const sessionDate = new Date(s.date);
        return sessionDate >= dayStart && sessionDate < dayEnd;
      });

      const daySeconds = daySessions.reduce((sum, s) => sum + (s.duration || 0), 0);
      weeklyData.push({
        day: days[i],
        hours: Math.round(daySeconds / 3600 * 10) / 10
      });
    }

    // Format today's study sessions
    const formattedSessions = todayStudySessions.map(s => ({
      _id: s._id,
      subject: s.subject || s.learningPathId?.title || 'General Study',
      topic: s.moduleName || s.topicName || s.topic || '',
      duration: s.duration ? Math.round(s.duration / 60) : 0, // convert seconds to minutes for dashboard
      startTime: s.startTime || s.date,
      endTime: s.endTime || (s.startTime ? new Date(new Date(s.startTime).getTime() + (s.duration || 0) * 1000) : null)
    }));

    res.json({
      success: true,
      data: {
        todos: todos.map(t => ({
          _id: t._id,
          title: t.title,
          description: t.description,
          completed: t.completed,
          priority: t.priority,
          category: t.learningPathId?.title || 'General',
          learningPathName: t.learningPathId?.title,
          estimatedDuration: 45, // Default estimate
          completedAt: t.completedAt
        })),
        goals: goals.map(g => ({
          _id: g._id,
          title: g.title,
          completed: g.completed
        })),
        studySessions: formattedSessions,
        learningPaths: learningPaths.map(p => ({
          _id: p._id,
          title: p.title,
          description: p.description,
          progress: p.progress,
          color: p.color,
          completedTopics: Math.floor(p.progress * 0.54),
          totalTopics: 54,
          currentModule: 'In Progress',
          nextMilestone: 'Continue learning'
        })),
        stats: {
          studyTime: todayMinutes,
          tasksCompleted: completedTodos,
          totalTasks: todos.length,
          goalsCompleted: completedGoals,
          totalGoals: goals.length,
          streak: 12, // TODO: Calculate actual streak
          overallProgress
        },
        weeklyStudy: weeklyData
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
