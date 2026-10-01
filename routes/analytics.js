const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const StudySession = require('../models/StudySession');
const Todo = require('../models/Todo');
const Goal = require('../models/Goal');
const LearningPath = require('../models/LearningPath');

// Utility function to get start and end dates based on query params
function parseDateRange(query) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let startDate, endDate, prevStartDate, prevEndDate;

  const period = query.period || query.range || '30d';

  if (period === 'today') {
    startDate = todayStart;
    endDate = new Date(now);
    const dayMs = 24 * 60 * 60 * 1000;
    prevStartDate = new Date(todayStart.getTime() - dayMs);
    prevEndDate = new Date(todayStart.getTime() - 1);
  } else if (period === 'week' || period === '7d') {
    startDate = new Date(todayStart);
    startDate.setDate(startDate.getDate() - 7);
    endDate = new Date(now);

    prevStartDate = new Date(startDate);
    prevStartDate.setDate(prevStartDate.getDate() - 7);
    prevEndDate = new Date(startDate);
  } else if (period === 'month' || period === '30d') {
    startDate = new Date(todayStart);
    startDate.setDate(startDate.getDate() - 30);
    endDate = new Date(now);

    prevStartDate = new Date(startDate);
    prevStartDate.setDate(prevStartDate.getDate() - 30);
    prevEndDate = new Date(startDate);
  } else if (period === '90d') {
    startDate = new Date(todayStart);
    startDate.setDate(startDate.getDate() - 90);
    endDate = new Date(now);

    prevStartDate = new Date(startDate);
    prevStartDate.setDate(prevStartDate.getDate() - 90);
    prevEndDate = new Date(startDate);
  } else if (period === 'year' || period === '1y') {
    startDate = new Date(todayStart);
    startDate.setFullYear(startDate.getFullYear() - 1);
    endDate = new Date(now);

    prevStartDate = new Date(startDate);
    prevStartDate.setFullYear(prevStartDate.getFullYear() - 1);
    prevEndDate = new Date(startDate);
  } else if (period === 'all') {
    startDate = new Date(2020, 0, 1);
    endDate = new Date(now);

    prevStartDate = new Date(2020, 0, 1);
    prevEndDate = new Date(now);
  } else if (query.from || query.to) {
    startDate = query.from ? new Date(query.from) : new Date(todayStart.getTime() - 30 * 24 * 60 * 60 * 1000);
    endDate = query.to ? new Date(query.to) : new Date(now);

    const diff = endDate.getTime() - startDate.getTime();
    prevStartDate = new Date(startDate.getTime() - diff);
    prevEndDate = new Date(startDate.getTime());
  } else {
    // Default to last 30 days
    startDate = new Date(todayStart);
    startDate.setDate(startDate.getDate() - 30);
    endDate = new Date(now);

    prevStartDate = new Date(startDate);
    prevStartDate.setDate(prevStartDate.getDate() - 30);
    prevEndDate = new Date(startDate);
  }

  return { startDate, endDate, prevStartDate, prevEndDate, period };
}

// Format seconds into readable string (e.g., 27h 18m)
function formatSeconds(secs) {
  if (!secs || secs <= 0) return '0m';
  const hours = Math.floor(secs / 3600);
  const mins = Math.floor((secs % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

// 1. GET /api/analytics/overview
router.get('/overview', auth, async (req, res) => {
  try {
    const userId = req.userId;
    const { startDate, endDate, prevStartDate, prevEndDate, period } = parseDateRange(req.query);

    const filter = { userId, status: 'completed' };
    if (req.query.subject && req.query.subject !== 'all') {
      filter.subject = req.query.subject;
    }
    if (req.query.learningPathId && req.query.learningPathId !== 'all') {
      filter.learningPathId = req.query.learningPathId;
    }

    // Current period study sessions
    const currentSessionsFilter = {
      ...filter,
      date: { $gte: startDate, $lte: endDate }
    };
    const currentSessions = await StudySession.find(currentSessionsFilter);

    // Previous period study sessions
    const prevSessionsFilter = {
      ...filter,
      date: { $gte: prevStartDate, $lte: prevEndDate }
    };
    const prevSessions = await StudySession.find(prevSessionsFilter);

    const currentTotalSeconds = currentSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    const prevTotalSeconds = prevSessions.reduce((sum, s) => sum + (s.duration || 0), 0);

    const diffSeconds = currentTotalSeconds - prevTotalSeconds;
    const diffFormatted = (diffSeconds >= 0 ? '+' : '-') + formatSeconds(Math.abs(diffSeconds));

    // Todos completed in period
    const todoFilter = { userId, completed: true };
    const currentTodos = await Todo.countDocuments({
      ...todoFilter,
      updatedAt: { $gte: startDate, $lte: endDate }
    });
    const prevTodos = await Todo.countDocuments({
      ...todoFilter,
      updatedAt: { $gte: prevStartDate, $lte: prevEndDate }
    });

    // Goals completed in period
    const totalGoals = await Goal.countDocuments({ userId });
    const completedGoals = await Goal.countDocuments({ userId, completed: true });

    // Streak calculation (consecutive active days)
    const allSessions = await StudySession.find({ userId, status: 'completed' }).sort({ date: -1 });
    const activeDatesSet = new Set();
    allSessions.forEach(s => {
      const d = new Date(s.date);
      activeDatesSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    });

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;

    const todayStr = `${todayStart.getFullYear()}-${String(todayStart.getMonth() + 1).padStart(2, '0')}-${String(todayStart.getDate()).padStart(2, '0')}`;
    let checkDate = new Date(todayStart);

    if (!activeDatesSet.has(todayStr)) {
      checkDate.setDate(checkDate.getDate() - 1);
    }

    while (true) {
      const dateStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
      if (activeDatesSet.has(dateStr)) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    // Longest streak calculation
    const sortedDateStrs = Array.from(activeDatesSet).sort();
    if (sortedDateStrs.length > 0) {
      let streakCount = 1;
      longestStreak = 1;
      for (let i = 1; i < sortedDateStrs.length; i++) {
        const d1 = new Date(sortedDateStrs[i - 1]);
        const d2 = new Date(sortedDateStrs[i]);
        const diffDays = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          streakCount++;
          if (streakCount > longestStreak) longestStreak = streakCount;
        } else {
          streakCount = 1;
        }
      }
    }

    res.json({
      success: true,
      data: {
        totalStudySeconds: currentTotalSeconds,
        totalStudyFormatted: formatSeconds(currentTotalSeconds),
        totalSessions: currentSessions.length,
        diffSeconds,
        diffFormatted,
        prevStudySeconds: prevTotalSeconds,
        prevSessions: prevSessions.length,
        tasksCompleted: currentTodos,
        tasksCompletedPrev: prevTodos,
        goalsCompleted: completedGoals,
        totalGoals,
        currentStreak,
        longestStreak,
        period,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      }
    });
  } catch (error) {
    console.error('Analytics overview error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 2. GET /api/analytics/study-time
router.get('/study-time', auth, async (req, res) => {
  try {
    const userId = req.userId;
    const { startDate, endDate, period } = parseDateRange(req.query);

    const filter = {
      userId,
      status: 'completed',
      date: { $gte: startDate, $lte: endDate }
    };
    if (req.query.subject && req.query.subject !== 'all') filter.subject = req.query.subject;
    if (req.query.learningPathId && req.query.learningPathId !== 'all') filter.learningPathId = req.query.learningPathId;

    const sessions = await StudySession.find(filter).sort({ date: 1 });

    // Group sessions by date
    const dailyMap = {};
    let longestSessionSecs = 0;

    sessions.forEach(s => {
      const d = new Date(s.date);
      const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!dailyMap[dayKey]) {
        dailyMap[dayKey] = { seconds: 0, count: 0, date: d, dayName: d.toLocaleDateString('en-US', { weekday: 'short' }), subject: s.subject };
      }
      dailyMap[dayKey].seconds += (s.duration || 0);
      dailyMap[dayKey].count += 1;

      if ((s.duration || 0) > longestSessionSecs) {
        longestSessionSecs = s.duration || 0;
      }
    });

    // Fill all dates in range
    const chartData = [];
    const curr = new Date(startDate);
    let maxDaySecs = 0;
    let longestDayName = 'None';

    while (curr <= endDate) {
      const dayKey = `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}-${String(curr.getDate()).padStart(2, '0')}`;
      const entry = dailyMap[dayKey] || { seconds: 0, count: 0, date: new Date(curr), dayName: curr.toLocaleDateString('en-US', { weekday: 'short' }) };
      
      const hours = Math.round((entry.seconds / 3600) * 10) / 10;
      chartData.push({
        dateKey: dayKey,
        label: curr.toLocaleDateString('en-US', period === 'week' || period === '7d' ? { weekday: 'short' } : { month: 'short', day: 'numeric' }),
        fullDate: curr.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        seconds: entry.seconds,
        hours,
        formatted: formatSeconds(entry.seconds),
        sessionsCount: entry.count,
        subject: entry.subject || 'General'
      });

      if (entry.seconds > maxDaySecs) {
        maxDaySecs = entry.seconds;
        longestDayName = `${curr.toLocaleDateString('en-US', { weekday: 'long' })} (${formatSeconds(entry.seconds)})`;
      }

      curr.setDate(curr.getDate() + 1);
    }

    const totalSecs = chartData.reduce((sum, d) => sum + d.seconds, 0);
    const activeDays = chartData.filter(d => d.seconds > 0).length;
    const totalDaysCount = chartData.length || 1;
    const avgSecsPerDay = Math.round(totalSecs / totalDaysCount);

    res.json({
      success: true,
      data: {
        chartData,
        totalSeconds: totalSecs,
        totalFormatted: formatSeconds(totalSecs),
        averagePerDayFormatted: formatSeconds(avgSecsPerDay),
        longestStudyDay: longestDayName,
        longestSessionFormatted: formatSeconds(longestSessionSecs),
        activeDays,
        totalDays: totalDaysCount
      }
    });
  } catch (error) {
    console.error('Analytics study time error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 3. GET /api/analytics/study-trend
router.get('/study-trend', auth, async (req, res) => {
  try {
    const userId = req.userId;
    const { startDate, endDate, period } = parseDateRange(req.query);

    const filter = {
      userId,
      status: 'completed',
      date: { $gte: startDate, $lte: endDate }
    };

    const sessions = await StudySession.find(filter).sort({ date: 1 });

    const dailyMap = {};
    sessions.forEach(s => {
      const d = new Date(s.date);
      const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      dailyMap[dayKey] = (dailyMap[dayKey] || 0) + (s.duration || 0);
    });

    const points = [];
    const curr = new Date(startDate);
    let cumulative = 0;

    while (curr <= endDate) {
      const dayKey = `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}-${String(curr.getDate()).padStart(2, '0')}`;
      const daySecs = dailyMap[dayKey] || 0;
      cumulative += daySecs;

      points.push({
        date: dayKey,
        label: curr.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        seconds: daySecs,
        hours: Math.round((daySecs / 3600) * 10) / 10,
        cumulativeHours: Math.round((cumulative / 3600) * 10) / 10
      });

      curr.setDate(curr.getDate() + 1);
    }

    res.json({
      success: true,
      data: {
        points,
        period
      }
    });
  } catch (error) {
    console.error('Analytics study trend error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 4. GET /api/analytics/subjects
router.get('/subjects', auth, async (req, res) => {
  try {
    const userId = req.userId;
    const { startDate, endDate } = parseDateRange(req.query);

    const filter = {
      userId,
      status: 'completed',
      date: { $gte: startDate, $lte: endDate }
    };

    const sessions = await StudySession.find(filter);
    const totalSecs = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);

    const subjectMap = {};
    sessions.forEach(s => {
      const subj = s.subject || 'General';
      if (!subjectMap[subj]) {
        subjectMap[subj] = { seconds: 0, sessions: 0 };
      }
      subjectMap[subj].seconds += (s.duration || 0);
      subjectMap[subj].sessions += 1;
    });

    const colors = ['#6366F1', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];

    const items = Object.entries(subjectMap).map(([subject, info], index) => {
      const pct = totalSecs > 0 ? Math.round((info.seconds / totalSecs) * 100) : 0;
      return {
        subject,
        seconds: info.seconds,
        formattedTime: formatSeconds(info.seconds),
        percentage: pct,
        sessionsCount: info.sessions,
        color: colors[index % colors.length]
      };
    }).sort((a, b) => b.seconds - a.seconds);

    res.json({
      success: true,
      data: {
        subjects: items,
        totalSeconds: totalSecs,
        totalFormatted: formatSeconds(totalSecs)
      }
    });
  } catch (error) {
    console.error('Analytics subjects error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 5. GET /api/analytics/learning-paths
router.get('/learning-paths', auth, async (req, res) => {
  try {
    const userId = req.userId;
    const { startDate, endDate } = parseDateRange(req.query);

    const learningPaths = await LearningPath.find({ userId });
    const sessions = await StudySession.find({
      userId,
      status: 'completed',
      date: { $gte: startDate, $lte: endDate }
    });
    const todos = await Todo.find({ userId });

    const lpStats = learningPaths.map(lp => {
      const lpSessions = sessions.filter(s => String(s.learningPathId) === String(lp._id) || s.subject === lp.title);
      const lpTimeSecs = lpSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
      const lpTodos = todos.filter(t => String(t.learningPathId) === String(lp._id));
      const completedTodos = lpTodos.filter(t => t.completed).length;

      // Extract unique topics studied
      const topicSet = new Set();
      lpSessions.forEach(s => {
        if (s.topicName) topicSet.add(s.topicName);
        else if (s.topic) topicSet.add(s.topic);
      });

      return {
        _id: lp._id,
        title: lp.title,
        description: lp.description,
        progress: lp.progress || 0,
        color: lp.color || '#6366F1',
        totalSeconds: lpTimeSecs,
        formattedTime: formatSeconds(lpTimeSecs),
        sessionsCount: lpSessions.length,
        topicsStudiedCount: topicSet.size,
        topicsStudied: Array.from(topicSet),
        tasksCompleted: completedTodos,
        totalTasks: lpTodos.length,
        targetDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      };
    });

    res.json({
      success: true,
      data: lpStats
    });
  } catch (error) {
    console.error('Analytics learning paths error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 6. GET /api/analytics/topics
router.get('/topics', auth, async (req, res) => {
  try {
    const userId = req.userId;
    const { startDate, endDate } = parseDateRange(req.query);

    const sessions = await StudySession.find({
      userId,
      status: 'completed',
      date: { $gte: startDate, $lte: endDate }
    });

    const topicMap = {};
    sessions.forEach(s => {
      const name = s.topicName || s.topic || s.task || 'General Focus';
      if (!topicMap[name]) {
        topicMap[name] = { seconds: 0, sessions: 0, subject: s.subject };
      }
      topicMap[name].seconds += (s.duration || 0);
      topicMap[name].sessions += 1;
    });

    const totalTime = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);

    const topics = Object.entries(topicMap).map(([topic, info]) => ({
      topic,
      subject: info.subject,
      seconds: info.seconds,
      formattedTime: formatSeconds(info.seconds),
      sessionsCount: info.sessions,
      percentage: totalTime > 0 ? Math.round((info.seconds / totalTime) * 100) : 0
    })).sort((a, b) => b.seconds - a.seconds).slice(0, 10);

    res.json({
      success: true,
      data: topics
    });
  } catch (error) {
    console.error('Analytics topics error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 7. GET /api/analytics/todos
router.get('/todos', auth, async (req, res) => {
  try {
    const userId = req.userId;
    const { startDate, endDate } = parseDateRange(req.query);

    const todos = await Todo.find({ userId });
    const now = new Date();

    const completed = todos.filter(t => t.completed).length;
    const pending = todos.filter(t => !t.completed && (!t.dueDate || new Date(t.dueDate) >= now)).length;
    const overdue = todos.filter(t => !t.completed && t.dueDate && new Date(t.dueDate) < now).length;
    const total = todos.length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Daily completion trend for selected period
    const dayMap = {};
    todos.filter(t => t.completed).forEach(t => {
      const d = new Date(t.updatedAt || t.createdAt);
      if (d >= startDate && d <= endDate) {
        const dayKey = d.toLocaleDateString('en-US', { weekday: 'short' });
        dayMap[dayKey] = (dayMap[dayKey] || 0) + 1;
      }
    });

    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const trend = days.map(day => ({ day, count: dayMap[day] || 0 }));

    res.json({
      success: true,
      data: {
        completed,
        pending,
        overdue,
        total,
        completionRate,
        trend
      }
    });
  } catch (error) {
    console.error('Analytics todos error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 8. GET /api/analytics/goals
router.get('/goals', auth, async (req, res) => {
  try {
    const userId = req.userId;
    const goals = await Goal.find({ userId });

    const completed = goals.filter(g => g.completed).length;
    const total = goals.length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    const byType = {
      daily: { total: 0, completed: 0 },
      weekly: { total: 0, completed: 0 },
      monthly: { total: 0, completed: 0 },
      'long-term': { total: 0, completed: 0 }
    };

    goals.forEach(g => {
      const t = g.type || 'weekly';
      if (!byType[t]) byType[t] = { total: 0, completed: 0 };
      byType[t].total += 1;
      if (g.completed) byType[t].completed += 1;
    });

    res.json({
      success: true,
      data: {
        completed,
        total,
        completionRate,
        byType,
        goalsList: goals
      }
    });
  } catch (error) {
    console.error('Analytics goals error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 9. GET /api/analytics/heatmap
router.get('/heatmap', auth, async (req, res) => {
  try {
    const userId = req.userId;
    const metric = req.query.metric || 'studyTime'; // studyTime, tasks

    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 120); // 120 days for grid view

    const sessions = await StudySession.find({
      userId,
      status: 'completed',
      date: { $gte: startDate }
    });

    const todos = await Todo.find({
      userId,
      completed: true,
      updatedAt: { $gte: startDate }
    });

    // Map by YYYY-MM-DD
    const dateMap = {};
    const curr = new Date(startDate);

    while (curr <= now) {
      const key = `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}-${String(curr.getDate()).padStart(2, '0')}`;
      dateMap[key] = {
        dateKey: key,
        date: new Date(curr),
        formattedDate: curr.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        studySeconds: 0,
        tasksCount: 0
      };
      curr.setDate(curr.getDate() + 1);
    }

    sessions.forEach(s => {
      const d = new Date(s.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (dateMap[key]) {
        dateMap[key].studySeconds += (s.duration || 0);
      }
    });

    todos.forEach(t => {
      const d = new Date(t.updatedAt || t.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (dateMap[key]) {
        dateMap[key].tasksCount += 1;
      }
    });

    const matrix = Object.values(dateMap).map(item => {
      let value = 0;
      let level = 0; // 0, 1, 2, 3, 4

      if (metric === 'tasks') {
        value = item.tasksCount;
        if (value > 0) level = Math.min(4, Math.ceil(value / 2));
      } else {
        value = item.studySeconds;
        const mins = value / 60;
        if (mins > 0) {
          if (mins < 30) level = 1;
          else if (mins < 90) level = 2;
          else if (mins < 180) level = 3;
          else level = 4;
        }
      }

      return {
        ...item,
        value,
        level,
        formattedValue: metric === 'studyTime' ? formatSeconds(item.studySeconds) : `${value}`
      };
    });

    const activeDaysCount = matrix.filter(m => m.value > 0).length;

    res.json({
      success: true,
      data: {
        matrix,
        metric,
        activeDays: activeDaysCount,
        totalDays: matrix.length,
        activeRatio: Math.round((activeDaysCount / matrix.length) * 100)
      }
    });
  } catch (error) {
    console.error('Analytics heatmap error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 10. GET /api/analytics/habits
router.get('/habits', auth, async (req, res) => {
  try {
    const userId = req.userId;
    const { startDate, endDate } = parseDateRange(req.query);

    const sessions = await StudySession.find({
      userId,
      status: 'completed',
      date: { $gte: startDate, $lte: endDate }
    });

    // Day of week distribution (Sun = 0, Mon = 1, ...)
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayCounts = [0, 0, 0, 0, 0, 0, 0];
    const hourCounts = new Array(24).fill(0);

    let totalDurationSecs = 0;
    let longestSessionSecs = 0;

    sessions.forEach(s => {
      const d = new Date(s.startTime || s.date);
      dayCounts[d.getDay()] += (s.duration || 0);
      hourCounts[d.getHours()] += (s.duration || 0);

      totalDurationSecs += (s.duration || 0);
      if ((s.duration || 0) > longestSessionSecs) {
        longestSessionSecs = s.duration || 0;
      }
    });

    // Find peak day
    let maxDayIdx = 0;
    dayCounts.forEach((secs, idx) => {
      if (secs > dayCounts[maxDayIdx]) maxDayIdx = idx;
    });

    // Find peak 3-hour window
    let maxWindowSecs = 0;
    let peakStartHour = 16; // default 4 PM

    for (let h = 0; h < 22; h++) {
      const windowSecs = hourCounts[h] + hourCounts[h + 1] + hourCounts[h + 2];
      if (windowSecs > maxWindowSecs) {
        maxWindowSecs = windowSecs;
        peakStartHour = h;
      }
    }

    const formatHour = h => {
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 === 0 ? 12 : h % 12;
      return `${h12} ${ampm}`;
    };

    const mostActiveTime = `${formatHour(peakStartHour)} – ${formatHour((peakStartHour + 3) % 24)}`;
    const avgSessionSecs = sessions.length > 0 ? Math.round(totalDurationSecs / sessions.length) : 0;

    // Format hours distribution for bar chart (6 AM to 10 PM)
    const hourDistribution = [6, 8, 10, 12, 14, 16, 18, 20, 22].map(h => ({
      hour: formatHour(h),
      seconds: hourCounts[h] + (hourCounts[h + 1] || 0),
      hours: Math.round(((hourCounts[h] + (hourCounts[h + 1] || 0)) / 3600) * 10) / 10
    }));

    res.json({
      success: true,
      data: {
        mostActiveDay: dayNames[maxDayIdx],
        mostActiveTime,
        averageSessionFormatted: formatSeconds(avgSessionSecs),
        longestSessionFormatted: formatSeconds(longestSessionSecs),
        totalSessions: sessions.length,
        hourDistribution
      }
    });
  } catch (error) {
    console.error('Analytics habits error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 11. GET /api/analytics/recent-activity
router.get('/recent-activity', auth, async (req, res) => {
  try {
    const userId = req.userId;
    const sessions = await StudySession.find({ userId, status: 'completed' }).sort({ date: -1 }).limit(5);
    const todos = await Todo.find({ userId, completed: true }).sort({ updatedAt: -1 }).limit(5);

    const activities = [];

    sessions.forEach(s => {
      activities.push({
        id: `session_${s._id}`,
        type: 'session',
        title: `Studied: ${s.subject}`,
        subtitle: `${s.topicName || s.topic || 'Focus'} — ${formatSeconds(s.duration)}`,
        date: s.date,
        icon: 'Clock'
      });
    });

    todos.forEach(t => {
      activities.push({
        id: `todo_${t._id}`,
        type: 'todo',
        title: `Completed: ${t.title}`,
        subtitle: t.description || 'Task completion',
        date: t.updatedAt || t.createdAt,
        icon: 'CheckCircle'
      });
    });

    activities.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({
      success: true,
      data: activities.slice(0, 8)
    });
  } catch (error) {
    console.error('Analytics recent activity error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 13. GET /api/analytics/export
router.get('/export', auth, async (req, res) => {
  try {
    const userId = req.userId;
    const format = req.query.format || 'json';
    const { startDate, endDate } = parseDateRange(req.query);

    const sessions = await StudySession.find({ userId, status: 'completed', date: { $gte: startDate, $lte: endDate } });
    const todos = await Todo.find({ userId, updatedAt: { $gte: startDate, $lte: endDate } });

    const exportData = {
      user: req.userId,
      exportDate: new Date().toISOString(),
      dateRange: { startDate, endDate },
      summary: {
        totalStudySessions: sessions.length,
        totalStudySeconds: sessions.reduce((sum, s) => sum + (s.duration || 0), 0),
        totalTodos: todos.length,
        completedTodos: todos.filter(t => t.completed).length
      },
      studySessions: sessions,
      todos
    };

    if (format === 'csv') {
      let csv = 'Type,ID,Title/Subject,Date,Duration (Seconds)/Status\n';
      sessions.forEach(s => {
        csv += `StudySession,"${s._id}","${s.subject} - ${s.topic || ''}","${s.date.toISOString()}",${s.duration}\n`;
      });
      todos.forEach(t => {
        csv += `Todo,"${t._id}","${t.title}","${t.createdAt.toISOString()}",${t.completed ? 'Completed' : 'Pending'}\n`;
      });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=arcstep-analytics.csv');
      return res.send(csv);
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=arcstep-analytics.json');
    res.json(exportData);
  } catch (error) {
    console.error('Analytics export error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
