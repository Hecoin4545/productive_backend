const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Todo = require('../models/Todo');
const Goal = require('../models/Goal');
const StudySession = require('../models/StudySession');
const LearningPath = require('../models/LearningPath');
const Module = require('../models/Module');
const Topic = require('../models/Topic');

const DAY_MS = 86400000;
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const toDateKey = (d) =>
  `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-${`${d.getDate()}`.padStart(2, '0')}`;

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// Monday-based start of the week containing `date`
const startOfWeek = (date) => {
  const d = startOfDay(date);
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  return d;
};

// Consecutive days with at least one completed session, counting back from today
const calcStreak = (sessions) => {
  const days = new Set(sessions.map(s => toDateKey(new Date(s.date || s.startTime))));
  const cursor = startOfDay(new Date());
  if (!days.has(toDateKey(cursor))) cursor.setTime(cursor.getTime() - DAY_MS);

  let streak = 0;
  while (days.has(toDateKey(cursor))) {
    streak++;
    cursor.setTime(cursor.getTime() - DAY_MS);
  }
  return streak;
};

// Get dashboard overview data - comprehensive
router.get('/overview', auth, async (req, res) => {
  try {
    const now = new Date();
    const todayStart = startOfDay(now);
    const tomorrowStart = new Date(todayStart.getTime() + DAY_MS);
    const weekStart = startOfWeek(now);
    const weekEnd = new Date(weekStart.getTime() + 7 * DAY_MS);

    const weekRange = { $gte: weekStart, $lt: weekEnd };

    // Get all data in parallel
    const [
      todos,
      goals,
      todayStudySessions,
      learningPaths,
      weekStudySessions,
      streakSessions
    ] = await Promise.all([
      Todo.find({ userId: req.userId }).populate('learningPathId', 'title color').sort({ dueDate: 1, createdAt: -1 }).limit(200),
      Goal.find({ userId: req.userId }).sort({ createdAt: -1 }).limit(50),
      StudySession.find({
        userId: req.userId,
        status: 'completed',
        date: { $gte: todayStart, $lt: tomorrowStart }
      })
        .populate('learningPathId', 'title color')
        .sort({ date: -1 }),
      LearningPath.find({ userId: req.userId }).sort({ updatedAt: -1 }),
      StudySession.find({ userId: req.userId, status: 'completed', date: weekRange }),
      StudySession.find({ userId: req.userId, status: 'completed' }).select('date startTime')
    ]);

    // Real module/topic counts per learning path (no invented totals)
    const pathIds = learningPaths.map(p => p._id);
    const [modules, topics] = pathIds.length > 0
      ? await Promise.all([
        Module.find({ learningPathId: { $in: pathIds } }).select('title status order learningPathId').sort({ order: 1 }),
        Topic.find({ learningPathId: { $in: pathIds } }).select('title status order moduleId learningPathId')
      ])
      : [[], []];

    // Calculate stats
    const todayMinutes = Math.round(todayStudySessions.reduce((sum, s) => sum + (s.duration || 0), 0) / 60);
    const completedTodos = todos.filter(t => t.completed).length;
    const completedGoals = goals.filter(g => g.completed).length;

    // Overall progress (average of active learning paths)
    const activePaths = learningPaths.filter(p => p.status === 'active');
    const overallProgress = activePaths.length > 0
      ? Math.round(activePaths.reduce((sum, p) => sum + (p.progress || 0), 0) / activePaths.length)
      : 0;

    // Weekly study data - Monday to Sunday of the current week, labelled by real weekday
    const secondsByDay = {};
    weekStudySessions.forEach(s => {
      const key = toDateKey(new Date(s.date || s.startTime));
      secondsByDay[key] = (secondsByDay[key] || 0) + (s.duration || 0);
    });

    const todayKey = toDateKey(todayStart);
    const weeklyData = WEEKDAYS.map((label, i) => {
      const date = new Date(weekStart.getTime() + i * DAY_MS);
      const key = toDateKey(date);
      const seconds = secondsByDay[key] || 0;
      return {
        day: label,
        date: key,
        seconds,
        minutes: Math.round(seconds / 60),
        hours: Math.round((seconds / 3600) * 100) / 100,
        isToday: key === todayKey,
        isFuture: date.getTime() > todayStart.getTime()
      };
    });

    // Format today's study sessions
    const formattedSessions = todayStudySessions.map(s => ({
      _id: s._id,
      subject: s.subject || s.learningPathId?.title || '',
      learningPathColor: s.learningPathId?.color || null,
      topic: s.moduleName || s.topicName || s.topic || s.task || '',
      duration: s.duration ? Math.round(s.duration / 60) : 0, // convert seconds to minutes for dashboard
      startTime: s.startTime || s.date,
      endTime: s.endTime || (s.startTime ? new Date(new Date(s.startTime).getTime() + (s.duration || 0) * 1000) : null)
    }));

    // Daily goals first, then other still-open goals, completed ones last
    const goalRank = (g) => {
      if (g.completed) return 10 + (g.type === 'daily' ? 0 : g.type === 'weekly' ? 1 : 2);
      if (g.type === 'daily') return 0;
      if (g.type === 'weekly') return 1;
      if (g.type === 'monthly') return 2;
      return 3;
    };

    res.json({
      success: true,
      data: {
        todos: todos.map(t => ({
          _id: t._id,
          title: t.title,
          description: t.description,
          completed: t.completed,
          priority: t.priority,
          dueDate: t.dueDate,
          dueTime: t.dueTime,
          type: t.type,
          tags: t.tags || [],
          category: t.learningPathId?.title
            || (Array.isArray(t.tags) && t.tags.length > 0 ? t.tags[0] : '')
            || (t.description || '').replace(/^Subject:\s*/i, '').split(',')[0].trim()
            || 'Unscheduled',
          learningPathName: t.learningPathId?.title,
          estimatedDuration: parseInt(t.estimatedDuration, 10) || 0,
          completedAt: t.completedAt
        })),
        goals: goals
          .slice()
          .sort((a, b) => goalRank(a) - goalRank(b))
          .map(g => ({
            _id: g._id,
            title: g.title,
            description: g.description,
            completed: g.completed,
            type: g.type,
            deadline: g.deadline,
            targetValue: g.targetValue,
            currentValue: g.currentValue,
            unit: g.unit,
            completedAt: g.completedAt
          })),
        studySessions: formattedSessions,
        learningPaths: learningPaths.map(p => {
          const pathModules = modules.filter(m => String(m.learningPathId) === String(p._id));
          const pathTopics = topics.filter(t => String(t.learningPathId) === String(p._id));
          const doneTopics = pathTopics.filter(t => t.status === 'completed').length;
          const activeModule = pathModules.find(m => m.status === 'in_progress')
            || pathModules.find(m => m.status !== 'completed');
          const nextTopic = pathTopics.find(t => t.status !== 'completed');

          return {
            _id: p._id,
            title: p.title,
            description: p.description,
            goal: p.goal,
            subject: p.subject,
            status: p.status,
            progress: p.progress || 0,
            color: p.color,
            totalModules: pathModules.length,
            completedModules: pathModules.filter(m => m.status === 'completed').length,
            completedTopics: doneTopics,
            totalTopics: pathTopics.length,
            currentModule: activeModule ? activeModule.title : '',
            nextMilestone: nextTopic
              ? nextTopic.title
              : (p.status === 'completed' ? 'Path completed' : '')
          };
        }),
        stats: {
          studyTime: todayMinutes,
          tasksCompleted: completedTodos,
          totalTasks: todos.length,
          goalsCompleted: completedGoals,
          totalGoals: goals.length,
          streak: calcStreak(streakSessions),
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
