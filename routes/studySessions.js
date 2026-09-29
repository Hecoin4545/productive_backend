const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const StudySession = require('../models/StudySession');

// Get study stats — MUST be before /:id to avoid route conflict
router.get('/stats/summary', auth, async (req, res) => {
  try {
    const { startDate, endDate, period } = req.query;
    const filter = { userId: req.userId, status: 'completed' };

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (period === 'today') {
      filter.date = { $gte: todayStart };
    } else if (period === 'week') {
      const weekStart = new Date(todayStart);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      filter.date = { $gte: weekStart };
    } else if (period === 'month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      filter.date = { $gte: monthStart };
    } else if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const sessions = await StudySession.find(filter);

    const totalSeconds = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    const totalSessions = sessions.length;
    const avgSeconds = totalSessions > 0 ? Math.round(totalSeconds / totalSessions) : 0;
    const longestSession = sessions.length > 0 ? Math.max(...sessions.map(s => s.duration || 0)) : 0;

    // Subject distribution
    const subjectMap = {};
    sessions.forEach(s => {
      const subj = s.subject || 'General';
      subjectMap[subj] = (subjectMap[subj] || 0) + (s.duration || 0);
    });
    const subjectDistribution = Object.entries(subjectMap)
      .map(([subject, seconds]) => ({ subject, seconds, hours: Math.round(seconds / 3600 * 10) / 10 }))
      .sort((a, b) => b.seconds - a.seconds);

    // Study streak calculation
    let streak = 0;
    const allSessions = await StudySession.find({ userId: req.userId, status: 'completed' }).sort({ date: -1 });
    const datesSet = new Set();
    allSessions.forEach(s => {
      const d = new Date(s.date);
      datesSet.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    });

    const checkDate = new Date(todayStart);
    // Check if studied today, if not start from yesterday
    const todayKey = `${checkDate.getFullYear()}-${checkDate.getMonth()}-${checkDate.getDate()}`;
    if (!datesSet.has(todayKey)) {
      checkDate.setDate(checkDate.getDate() - 1);
    }
    while (true) {
      const key = `${checkDate.getFullYear()}-${checkDate.getMonth()}-${checkDate.getDate()}`;
      if (datesSet.has(key)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    const mostStudied = subjectDistribution.length > 0 ? subjectDistribution[0].subject : 'None';

    res.json({
      success: true,
      data: {
        totalSeconds,
        totalMinutes: Math.round(totalSeconds / 60),
        totalHours: Math.round(totalSeconds / 3600 * 10) / 10,
        totalSessions,
        averageSeconds: avgSeconds,
        longestSession,
        streak,
        mostStudied,
        subjectDistribution
      }
    });
  } catch (error) {
    console.error('Get study stats error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get all study sessions for user
router.get('/', auth, async (req, res) => {
  try {
    const { learningPathId, subject, startDate, endDate, limit, period } = req.query;
    const filter = { userId: req.userId, status: 'completed' };

    if (learningPathId) filter.learningPathId = learningPathId;
    if (subject) filter.subject = subject;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (period === 'today') {
      filter.date = { $gte: todayStart };
    } else if (period === 'week') {
      const weekStart = new Date(todayStart);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      filter.date = { $gte: weekStart };
    } else if (period === 'month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      filter.date = { $gte: monthStart };
    } else if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    let query = StudySession.find(filter)
      .sort({ date: -1, startTime: -1 })
      .populate('learningPathId', 'title color');

    if (limit) query = query.limit(parseInt(limit));

    const sessions = await query;
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
    const {
      subject, learningPathId, moduleId, topicId,
      moduleName, topicName, task, topic,
      startTime, endTime, duration, mode,
      pomodoroConfig, notes, accomplishments,
      learned, problemsCompleted, pauseIntervals,
      date, status
    } = req.body;

    if (!duration && duration !== 0) {
      return res.status(400).json({ success: false, message: 'Duration is required' });
    }

    const session = await StudySession.create({
      userId: req.userId,
      subject: subject || 'General',
      learningPathId: learningPathId || null,
      moduleId: moduleId || null,
      topicId: topicId || null,
      moduleName: moduleName || '',
      topicName: topicName || '',
      task: task || '',
      topic: topic || topicName || '',
      startTime: startTime || new Date(),
      endTime: endTime || new Date(),
      duration,
      mode: mode || 'stopwatch',
      pomodoroConfig: pomodoroConfig || undefined,
      notes: notes || '',
      accomplishments: accomplishments || '',
      learned: learned || '',
      problemsCompleted: problemsCompleted || 0,
      pauseIntervals: pauseIntervals || [],
      date: date || new Date(),
      status: status || 'completed'
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
    const allowedFields = [
      'subject', 'learningPathId', 'moduleId', 'topicId',
      'moduleName', 'topicName', 'task', 'topic',
      'startTime', 'endTime', 'duration', 'mode',
      'pomodoroConfig', 'notes', 'accomplishments',
      'learned', 'problemsCompleted', 'pauseIntervals',
      'date', 'status'
    ];

    const updates = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });
    updates.updatedAt = new Date();

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

module.exports = router;
