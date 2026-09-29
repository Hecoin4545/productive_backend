const mongoose = require('mongoose');

const resourceFolderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  parentFolderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ResourceFolder',
    default: null
  },
  color: {
    type: String,
    default: '#6366F1'
  },
  icon: {
    type: String,
    default: 'Folder'
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

resourceFolderSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('ResourceFolder', resourceFolderSchema);
