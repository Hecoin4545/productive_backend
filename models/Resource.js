const mongoose = require('mongoose');

const resourceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  type: {
    type: String,
    enum: ['link', 'video', 'article', 'documentation', 'github', 'book', 'note', 'file'],
    default: 'link'
  },
  url: {
    type: String,
    default: ''
  },
  fileUrl: {
    type: String,
    default: ''
  },
  thumbnail: {
    type: String,
    default: ''
  },
  domain: {
    type: String,
    default: ''
  },
  folderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ResourceFolder',
    default: null
  },
  tags: [{
    type: String,
    trim: true
  }],
  learningPathId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LearningPath',
    default: null
  },
  moduleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Module',
    default: null
  },
  topicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Topic',
    default: null
  },
  notes: {
    type: String,
    default: ''
  },
  isFavorite: {
    type: Boolean,
    default: false
  },
  isPinned: {
    type: Boolean,
    default: false
  },
  lastOpenedAt: {
    type: Date,
    default: Date.now
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

resourceSchema.pre('save', function(next) {
  this.updatedAt = Date.now();

  // Auto detect domain if url present
  if (this.url && !this.domain) {
    try {
      const parsed = new URL(this.url);
      this.domain = parsed.hostname.replace('www.', '');
    } catch (e) {
      this.domain = '';
    }
  }

  // Auto detect resource type if url present and default link
  if (this.url && this.type === 'link') {
    const lowerUrl = this.url.toLowerCase();
    if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be') || lowerUrl.includes('vimeo.com')) {
      this.type = 'video';
    } else if (lowerUrl.includes('github.com')) {
      this.type = 'github';
    } else if (lowerUrl.includes('docs.') || lowerUrl.includes('developer.mozilla.org') || lowerUrl.includes('tailwindcss.com')) {
      this.type = 'documentation';
    } else if (lowerUrl.includes('medium.com') || lowerUrl.includes('dev.to') || lowerUrl.includes('blog')) {
      this.type = 'article';
    }
  }

  next();
});

module.exports = mongoose.model('Resource', resourceSchema);
