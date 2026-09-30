const mongoose = require('mongoose');

const goalSchema = new mongoose.Schema({
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
    enum: ['daily', 'weekly', 'monthly', 'long-term'],
    default: 'weekly'
  },
  targetValue: {
    type: Number,
    default: 0
  },
  currentValue: {
    type: Number,
    default: 0
  },
  unit: {
    type: String,
    default: 'hours'
  },
  completed: {
    type: Boolean,
    default: false
  },
  deadline: {
    type: Date,
    default: null
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

goalSchema.pre('save', function() {
  this.updatedAt = Date.now();
});

module.exports = mongoose.model('Goal', goalSchema);
