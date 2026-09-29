const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const LearningPath = require('../models/LearningPath');
const Module = require('../models/Module');
const Topic = require('../models/Topic');
const StudySession = require('../models/StudySession');
const Resource = require('../models/Resource');
const Todo = require('../models/Todo');

// Helper to recalculate module & learning path progress automatically
async function recalculateProgress(learningPathId, moduleId) {
  try {
    if (moduleId) {
      const moduleTopics = await Topic.find({ moduleId });
      const totalModTopics = moduleTopics.length;
      const completedModTopics = moduleTopics.filter(t => t.status === 'completed').length;
      const moduleProgress = totalModTopics > 0 ? Math.round((completedModTopics / totalModTopics) * 100) : 0;
      let moduleStatus = 'not_started';
      if (completedModTopics === totalModTopics && totalModTopics > 0) moduleStatus = 'completed';
      else if (completedModTopics > 0 || moduleTopics.some(t => t.status === 'in_progress')) moduleStatus = 'in_progress';

      await Module.findByIdAndUpdate(moduleId, { progress: moduleProgress, status: moduleStatus });
    }

    if (learningPathId) {
      const allTopics = await Topic.find({ learningPathId });
      const totalTopics = allTopics.length;
      const completedTopics = allTopics.filter(t => t.status === 'completed').length;
      const pathProgress = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;
      let pathStatus = 'active';
      if (completedTopics === totalTopics && totalTopics > 0) pathStatus = 'completed';

      await LearningPath.findByIdAndUpdate(learningPathId, { progress: pathProgress, status: pathStatus });
    }
  } catch (err) {
    console.error('Error recalculating progress:', err);
  }
}

// ─── LEARNING PATH ENDPOINTS ──────────────────────────────────────

// Get all learning paths for user
router.get('/', auth, async (req, res) => {
  try {
    const paths = await LearningPath.find({ userId: req.userId }).sort({ createdAt: -1 });

    // Aggregate stats per path (study time, total topics, completed topics, current topic)
    const enriched = await Promise.all(paths.map(async (lp) => {
      const sessions = await StudySession.find({ userId: req.userId, status: 'completed', $or: [{ learningPathId: lp._id }, { subject: lp.title }] });
      const totalStudySeconds = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
      const topics = await Topic.find({ learningPathId: lp._id });
      const completedTopics = topics.filter(t => t.status === 'completed').length;
      const currentTopic = topics.find(t => t.status === 'in_progress') || topics.find(t => t.status === 'not_started') || topics[0];

      return {
        ...lp.toObject(),
        totalStudySeconds,
        formattedStudyTime: `${Math.floor(totalStudySeconds / 3600)}h ${Math.floor((totalStudySeconds % 3600) / 60)}m`,
        totalTopics: topics.length,
        completedTopics,
        currentTopic: currentTopic ? currentTopic.title : 'General'
      };
    }));

    res.json({ success: true, data: enriched });
  } catch (error) {
    console.error('Get learning paths error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get single learning path with full tree (modules & topics)
router.get('/:id/full', auth, async (req, res) => {
  try {
    const path = await LearningPath.findOne({ _id: req.params.id, userId: req.userId });
    if (!path) {
      return res.status(404).json({ success: false, message: 'Learning path not found' });
    }

    const modules = await Module.find({ learningPathId: path._id }).sort({ order: 1, createdAt: 1 });
    const topics = await Topic.find({ learningPathId: path._id }).sort({ order: 1, createdAt: 1 });
    const resources = await Resource.find({ userId: req.userId, learningPathId: path._id });
    const todos = await Todo.find({ userId: req.userId, learningPathId: path._id });
    const sessions = await StudySession.find({ userId: req.userId, status: 'completed', $or: [{ learningPathId: path._id }, { subject: path.title }] });

    const totalStudySeconds = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    const completedTopicsCount = topics.filter(t => t.status === 'completed').length;
    const completedTodosCount = todos.filter(t => t.completed).length;

    // Structure modules with nested topics
    const modulesWithTopics = modules.map(m => {
      const modTopics = topics.filter(t => String(t.moduleId) === String(m._id)).map(t => {
        const tResources = resources.filter(r => String(r.topicId) === String(t._id));
        const tTodos = todos.filter(td => String(td.topicId) === String(t._id));
        const tSessions = sessions.filter(s => String(s.topicId) === String(t._id) || s.topicName === t.title);
        const tStudySeconds = tSessions.reduce((sum, s) => sum + (s.duration || 0), 0);

        return {
          ...t.toObject(),
          resourceCount: tResources.length,
          todoCount: tTodos.length,
          studySeconds: tStudySeconds,
          formattedStudyTime: `${Math.floor(tStudySeconds / 3600)}h ${Math.floor((tStudySeconds % 3600) / 60)}m`
        };
      });

      return {
        ...m.toObject(),
        topics: modTopics,
        totalTopics: modTopics.length,
        completedTopics: modTopics.filter(t => t.status === 'completed').length
      };
    });

    const currentTopic = topics.find(t => t.status === 'in_progress') || topics.find(t => t.status === 'not_started');

    res.json({
      success: true,
      data: {
        ...path.toObject(),
        totalStudySeconds,
        formattedStudyTime: `${Math.floor(totalStudySeconds / 3600)}h ${Math.floor((totalStudySeconds % 3600) / 60)}m`,
        totalTopics: topics.length,
        completedTopics: completedTopicsCount,
        completedTodos: completedTodosCount,
        totalResources: resources.length,
        currentTopicName: currentTopic ? currentTopic.title : 'None',
        modules: modulesWithTopics
      }
    });
  } catch (error) {
    console.error('Get full learning path error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create learning path
router.post('/', auth, async (req, res) => {
  try {
    const { title, description, goal, subject, difficulty, startDate, targetDate, color } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }

    const path = await LearningPath.create({
      userId: req.userId,
      title,
      description: description || '',
      goal: goal || '',
      subject: subject || 'DSA',
      difficulty: difficulty || 'Intermediate',
      startDate: startDate || new Date(),
      targetDate: targetDate || null,
      color: color || '#6366f1'
    });

    res.status(201).json({ success: true, data: path });
  } catch (error) {
    console.error('Create learning path error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update learning path
router.put('/:id', auth, async (req, res) => {
  try {
    const allowed = ['title', 'description', 'goal', 'subject', 'difficulty', 'startDate', 'targetDate', 'progress', 'status', 'color', 'currentTopicId'];
    const updates = {};
    allowed.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const path = await LearningPath.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      updates,
      { new: true, runValidators: true }
    );

    if (!path) {
      return res.status(404).json({ success: false, message: 'Learning path not found' });
    }

    res.json({ success: true, data: path });
  } catch (error) {
    console.error('Update learning path error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete learning path and associated modules & topics
router.delete('/:id', auth, async (req, res) => {
  try {
    const path = await LearningPath.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!path) {
      return res.status(404).json({ success: false, message: 'Learning path not found' });
    }

    await Module.deleteMany({ learningPathId: path._id });
    await Topic.deleteMany({ learningPathId: path._id });

    res.json({ success: true, message: 'Learning path deleted' });
  } catch (error) {
    console.error('Delete learning path error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── MODULE ENDPOINTS ─────────────────────────────────────────────

// Create Module
router.post('/modules', auth, async (req, res) => {
  try {
    const { learningPathId, title, description, order, startDate, targetDate } = req.body;
    if (!learningPathId || !title) {
      return res.status(400).json({ success: false, message: 'learningPathId and title are required' });
    }

    const count = await Module.countDocuments({ learningPathId });
    const moduleItem = await Module.create({
      userId: req.userId,
      learningPathId,
      title,
      description: description || '',
      order: order !== undefined ? order : count + 1,
      startDate: startDate || null,
      targetDate: targetDate || null
    });

    res.status(201).json({ success: true, data: moduleItem });
  } catch (error) {
    console.error('Create module error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update Module
router.put('/modules/:id', auth, async (req, res) => {
  try {
    const { title, description, order, startDate, targetDate, status } = req.body;
    const updates = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (order !== undefined) updates.order = order;
    if (startDate !== undefined) updates.startDate = startDate;
    if (targetDate !== undefined) updates.targetDate = targetDate;
    if (status !== undefined) updates.status = status;

    const moduleItem = await Module.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      updates,
      { new: true }
    );

    if (!moduleItem) return res.status(404).json({ success: false, message: 'Module not found' });

    res.json({ success: true, data: moduleItem });
  } catch (error) {
    console.error('Update module error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete Module
router.delete('/modules/:id', auth, async (req, res) => {
  try {
    const moduleItem = await Module.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!moduleItem) return res.status(404).json({ success: false, message: 'Module not found' });

    await Topic.deleteMany({ moduleId: moduleItem._id });
    await recalculateProgress(moduleItem.learningPathId, null);

    res.json({ success: true, message: 'Module deleted' });
  } catch (error) {
    console.error('Delete module error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── TOPIC ENDPOINTS ──────────────────────────────────────────────

// Create Topic
router.post('/topics', auth, async (req, res) => {
  try {
    const { learningPathId, moduleId, title, description, order, startDate, targetDate, notes } = req.body;
    if (!learningPathId || !moduleId || !title) {
      return res.status(400).json({ success: false, message: 'learningPathId, moduleId, and title are required' });
    }

    const count = await Topic.countDocuments({ moduleId });
    const topicItem = await Topic.create({
      userId: req.userId,
      learningPathId,
      moduleId,
      title,
      description: description || '',
      order: order !== undefined ? order : count + 1,
      startDate: startDate || null,
      targetDate: targetDate || null,
      notes: notes || ''
    });

    await recalculateProgress(learningPathId, moduleId);

    res.status(201).json({ success: true, data: topicItem });
  } catch (error) {
    console.error('Create topic error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update Topic (Status change automatically recalculates Module & Path Progress!)
router.put('/topics/:id', auth, async (req, res) => {
  try {
    const { title, description, order, status, startDate, targetDate, notes } = req.body;
    const updates = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (order !== undefined) updates.order = order;
    if (status !== undefined) {
      updates.status = status;
      if (status === 'completed') updates.completedAt = new Date();
      else if (status === 'not_started') updates.completedAt = null;
    }
    if (startDate !== undefined) updates.startDate = startDate;
    if (targetDate !== undefined) updates.targetDate = targetDate;
    if (notes !== undefined) updates.notes = notes;

    const topicItem = await Topic.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      updates,
      { new: true }
    );

    if (!topicItem) return res.status(404).json({ success: false, message: 'Topic not found' });

    // Recalculate module and learning path progress automatically
    await recalculateProgress(topicItem.learningPathId, topicItem.moduleId);

    res.json({ success: true, data: topicItem });
  } catch (error) {
    console.error('Update topic error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete Topic
router.delete('/topics/:id', auth, async (req, res) => {
  try {
    const topicItem = await Topic.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!topicItem) return res.status(404).json({ success: false, message: 'Topic not found' });

    await recalculateProgress(topicItem.learningPathId, topicItem.moduleId);

    res.json({ success: true, message: 'Topic deleted' });
  } catch (error) {
    console.error('Delete topic error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
