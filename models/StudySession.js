const mongoose = require('mongoose');

const studySessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  subject: {
    type: String,
    required: true,
    default: 'General'
  },
  learningPathId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LearningPath',
    default: null
  },
  moduleId: {
    type: String,
    default: null
  },
  topicId: {
    type: String,
    default: null
  },
  moduleName: {
    type: String,
    default: ''
  },
  topicName: {
    type: String,
    default: ''
  },
  task: {
    type: String,
    default: ''
  },
  topic: {
    type: String,
    default: ''
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    default: null
  },
  duration: {
    type: Number,
    required: true // stored in seconds
  },
  mode: {
    type: String,
    enum: ['pomodoro', 'custom', 'stopwatch'],
    default: 'stopwatch'
  },
  pomodoroConfig: {
    focusMinutes: { type: Number, default: 25 },
    breakMinutes: { type: Number, default: 5 },
    completedBlocks: { type: Number, default: 0 }
  },
  notes: {
    type: String,
    default: ''
  },
  accomplishments: {
    type: String,
    default: ''
  },
  learned: {
    type: String,
    default: ''
  },
  problemsCompleted: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['completed', 'discarded'],
    default: 'completed'
  },
  pauseIntervals: [{
    pausedAt: Date,
    resumedAt: Date
  }],
  date: {
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

studySessionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for formatted duration
studySessionSchema.virtual('formattedDuration').get(function() {
  const totalMinutes = Math.floor(this.duration / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
});

studySessionSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('StudySession', studySessionSchema);
