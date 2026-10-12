const mongoose = require('mongoose');

const blogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  learningPathId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LearningPath',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  subtitle: {
    type: String,
    default: '',
    trim: true
  },
  content: {
    type: String,
    default: ''
  },
  tags: [{
    type: String,
    trim: true
  }],
  coverImage: {
    type: String,
    default: ''
  },
  readTime: {
    type: Number,
    default: 1
  },
  published: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Auto-calculate read time before saving (approx 200 words per minute)
blogSchema.pre('save', function () {
  if (this.content) {
    const wordCount = this.content.trim().split(/\s+/).filter(Boolean).length;
    this.readTime = Math.max(1, Math.ceil(wordCount / 200));
  }
  this.updatedAt = new Date();
});

module.exports = mongoose.model('Blog', blogSchema);
