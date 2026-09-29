const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Resource = require('../models/Resource');
const ResourceFolder = require('../models/ResourceFolder');
const Topic = require('../models/Topic');
const LearningPath = require('../models/LearningPath');

// ─── RESOURCE FOLDERS ENDPOINTS ───────────────────────────────────

// Get all resource folders with hierarchy and count
router.get('/folders', auth, async (req, res) => {
  try {
    const folders = await ResourceFolder.find({ userId: req.userId }).sort({ name: 1 });
    const resources = await Resource.find({ userId: req.userId });

    const foldersWithCounts = folders.map(f => {
      const count = resources.filter(r => String(r.folderId) === String(f._id)).length;
      return {
        ...f.toObject(),
        resourceCount: count
      };
    });

    res.json({ success: true, data: foldersWithCounts });
  } catch (error) {
    console.error('Get resource folders error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create Resource Folder
router.post('/folders', auth, async (req, res) => {
  try {
    const { name, parentFolderId, color, icon } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Folder name is required' });

    const folder = await ResourceFolder.create({
      userId: req.userId,
      name,
      parentFolderId: parentFolderId || null,
      color: color || '#6366F1',
      icon: icon || 'Folder'
    });

    res.status(201).json({ success: true, data: folder });
  } catch (error) {
    console.error('Create resource folder error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update Resource Folder
router.put('/folders/:id', auth, async (req, res) => {
  try {
    const { name, parentFolderId, color, icon } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (parentFolderId !== undefined) updates.parentFolderId = parentFolderId;
    if (color !== undefined) updates.color = color;
    if (icon !== undefined) updates.icon = icon;

    const folder = await ResourceFolder.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      updates,
      { new: true }
    );

    if (!folder) return res.status(404).json({ success: false, message: 'Folder not found' });

    res.json({ success: true, data: folder });
  } catch (error) {
    console.error('Update resource folder error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete Resource Folder
router.delete('/folders/:id', auth, async (req, res) => {
  try {
    const folder = await ResourceFolder.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!folder) return res.status(404).json({ success: false, message: 'Folder not found' });

    // Move resources in this folder to unorganized (folderId: null)
    await Resource.updateMany({ folderId: folder._id }, { folderId: null });

    res.json({ success: true, message: 'Folder deleted' });
  } catch (error) {
    console.error('Delete resource folder error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── RESOURCES ENDPOINTS ──────────────────────────────────────────

// Search resources
router.get('/search', auth, async (req, res) => {
  try {
    const q = req.query.q || '';
    if (!q.trim()) return res.json({ success: true, data: [] });

    const regex = new RegExp(q, 'i');
    const resources = await Resource.find({
      userId: req.userId,
      $or: [
        { title: regex },
        { description: regex },
        { url: regex },
        { tags: regex },
        { notes: regex }
      ]
    }).populate('folderId', 'name color').populate('learningPathId', 'title color').populate('topicId', 'title');

    res.json({ success: true, data: resources });
  } catch (error) {
    console.error('Search resources error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get favorite resources
router.get('/favorites', auth, async (req, res) => {
  try {
    const resources = await Resource.find({ userId: req.userId, isFavorite: true })
      .populate('folderId', 'name color')
      .populate('learningPathId', 'title color')
      .populate('topicId', 'title');

    res.json({ success: true, data: resources });
  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get recently used resources
router.get('/recently-used', auth, async (req, res) => {
  try {
    const resources = await Resource.find({ userId: req.userId })
      .sort({ lastOpenedAt: -1, updatedAt: -1 })
      .limit(10)
      .populate('folderId', 'name color')
      .populate('learningPathId', 'title color')
      .populate('topicId', 'title');

    res.json({ success: true, data: resources });
  } catch (error) {
    console.error('Get recently used error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get all resources with query filtering
router.get('/', auth, async (req, res) => {
  try {
    const { folderId, topicId, learningPathId, type, favorite, tag, search } = req.query;
    const filter = { userId: req.userId };

    if (folderId && folderId !== 'all') filter.folderId = folderId === 'unorganized' ? null : folderId;
    if (topicId && topicId !== 'all') filter.topicId = topicId;
    if (learningPathId && learningPathId !== 'all') filter.learningPathId = learningPathId;
    if (type && type !== 'all') filter.type = type;
    if (favorite === 'true') filter.isFavorite = true;
    if (tag) filter.tags = tag;
    if (search) {
      const regex = new RegExp(search, 'i');
      filter.$or = [
        { title: regex },
        { description: regex },
        { url: regex },
        { tags: regex },
        { notes: regex }
      ];
    }

    const resources = await Resource.find(filter)
      .sort({ isPinned: -1, createdAt: -1 })
      .populate('folderId', 'name color')
      .populate('learningPathId', 'title color')
      .populate('topicId', 'title');

    res.json({ success: true, data: resources });
  } catch (error) {
    console.error('Get resources error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get single resource detail
router.get('/:id', auth, async (req, res) => {
  try {
    const resource = await Resource.findOne({ _id: req.params.id, userId: req.userId })
      .populate('folderId', 'name color')
      .populate('learningPathId', 'title color')
      .populate('moduleId', 'title')
      .populate('topicId', 'title');

    if (!resource) return res.status(404).json({ success: false, message: 'Resource not found' });

    res.json({ success: true, data: resource });
  } catch (error) {
    console.error('Get single resource error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create resource
router.post('/', auth, async (req, res) => {
  try {
    const { title, description, type, url, fileUrl, thumbnail, folderId, tags, learningPathId, moduleId, topicId, notes, isFavorite, isPinned } = req.body;

    if (!title) return res.status(400).json({ success: false, message: 'Resource title is required' });

    const resource = await Resource.create({
      userId: req.userId,
      title,
      description: description || '',
      type: type || 'link',
      url: url || '',
      fileUrl: fileUrl || '',
      thumbnail: thumbnail || '',
      folderId: folderId || null,
      tags: Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()) : []),
      learningPathId: learningPathId || null,
      moduleId: moduleId || null,
      topicId: topicId || null,
      notes: notes || '',
      isFavorite: !!isFavorite,
      isPinned: !!isPinned,
      lastOpenedAt: new Date()
    });

    const populated = await Resource.findById(resource._id)
      .populate('folderId', 'name color')
      .populate('learningPathId', 'title color')
      .populate('topicId', 'title');

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    console.error('Create resource error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update resource
router.put('/:id', auth, async (req, res) => {
  try {
    const allowed = ['title', 'description', 'type', 'url', 'fileUrl', 'thumbnail', 'folderId', 'tags', 'learningPathId', 'moduleId', 'topicId', 'notes', 'isFavorite', 'isPinned', 'lastOpenedAt'];
    const updates = {};

    allowed.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const resource = await Resource.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      updates,
      { new: true }
    ).populate('folderId', 'name color')
     .populate('learningPathId', 'title color')
     .populate('topicId', 'title');

    if (!resource) return res.status(404).json({ success: false, message: 'Resource not found' });

    res.json({ success: true, data: resource });
  } catch (error) {
    console.error('Update resource error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Open resource (updates lastOpenedAt)
router.patch('/:id/open', auth, async (req, res) => {
  try {
    const resource = await Resource.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { lastOpenedAt: new Date() },
      { new: true }
    );
    if (!resource) return res.status(404).json({ success: false, message: 'Resource not found' });
    res.json({ success: true, data: resource });
  } catch (error) {
    console.error('Mark resource open error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete resource
router.delete('/:id', auth, async (req, res) => {
  try {
    const resource = await Resource.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!resource) return res.status(404).json({ success: false, message: 'Resource not found' });

    res.json({ success: true, message: 'Resource deleted' });
  } catch (error) {
    console.error('Delete resource error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
