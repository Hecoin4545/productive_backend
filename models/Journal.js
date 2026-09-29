const mongoose = require('mongoose');

const journalSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  whatIDid: {
    type: String,
    default: ''
  },
  whatILearned: {
    type: String,
    default: ''
  },
  whatWentWell: {
    type: String,
    default: ''
  },
  difficulties: {
    type: String,
    default: ''
  },
  notes: {
    type: String,
    default: ''
  },
  tomorrow: {
    type: String,
    default: ''
  },
  technicalNotes: {
    type: String,
    default: ''
  },
  tags: [{
    type: String,
    trim: true
  }],
  attachments: [{
    type: String
  }],
  linkedLearningPaths: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LearningPath'
  }],
  linkedTopics: [{
    type: String
  }],
  linkedGoals: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Goal'
  }],
  linkedTodos: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Todo'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

journalSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Journal', journalSchema);
