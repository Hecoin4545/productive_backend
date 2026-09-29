const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models
const User = require('./models/User');
const LearningPath = require('./models/LearningPath');
const Todo = require('./models/Todo');
const Goal = require('./models/Goal');
const StudySession = require('./models/StudySession');
const Journal = require('./models/Journal');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected for seeding'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

async function seed() {
  try {
    console.log('Starting seed...');

    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      LearningPath.deleteMany({}),
      Todo.deleteMany({}),
      Goal.deleteMany({}),
      StudySession.deleteMany({}),
      Journal.deleteMany({})
    ]);
    console.log('Cleared existing data');

    // Create user
    const hashedPassword = await bcrypt.hash('password123', 10);
    const user = await User.create({
      name: 'Het',
      email: 'het@arcstep.com',
      password: hashedPassword,
      avatar: null
    });
    console.log('Created user:', user.email);

    // Create learning paths
    const learningPaths = await LearningPath.create([
      {
        userId: user._id,
        title: 'Data Structures & Algorithms',
        description: 'Build strong problem-solving fundamentals through consistent practice.',
        progress: 78,
        status: 'active',
        color: '#6C63FF'
      },
      {
        userId: user._id,
        title: 'Machine Learning',
        description: 'Master ML fundamentals and build intelligent systems.',
        progress: 52,
        status: 'active',
        color: '#22C55E'
      },
      {
        userId: user._id,
        title: 'Web Development',
        description: 'Full-stack development with modern frameworks.',
        progress: 64,
        status: 'active',
        color: '#F59E0B'
      },
      {
        userId: user._id,
        title: 'System Design',
        description: 'Learn to design scalable distributed systems.',
        progress: 31,
        status: 'active',
        color: '#EF4444'
      }
    ]);
    console.log('Created learning paths:', learningPaths.length);

    // Create todos
    const todos = await Todo.create([
      {
        userId: user._id,
        learningPathId: learningPaths[0]._id,
        title: 'Solve 5 Dynamic Programming problems',
        description: 'Focus on memoization patterns',
        priority: 'high',
        completed: false,
        dueDate: new Date()
      },
      {
        userId: user._id,
        learningPathId: learningPaths[0]._id,
        title: 'Complete Binary Trees lecture',
        description: 'Watch and take notes',
        priority: 'medium',
        completed: false
      },
      {
        userId: user._id,
        learningPathId: learningPaths[1]._id,
        title: 'Revise regression notes',
        description: 'Review linear and logistic regression',
        priority: 'medium',
        completed: false
      },
      {
        userId: user._id,
        learningPathId: learningPaths[2]._id,
        title: 'Work on portfolio project',
        description: 'Add new features to personal site',
        priority: 'low',
        completed: false
      },
      {
        userId: user._id,
        learningPathId: learningPaths[3]._id,
        title: 'Read system design chapter',
        description: 'Chapter on load balancing',
        priority: 'medium',
        completed: false
      },
      {
        userId: user._id,
        learningPathId: learningPaths[0]._id,
        title: 'Solve 3 Codeforces problems',
        description: 'Practice competitive programming',
        priority: 'high',
        completed: true
      },
      {
        userId: user._id,
        learningPathId: learningPaths[1]._id,
        title: 'Review ML lecture slides',
        description: 'Go through week 3 content',
        priority: 'low',
        completed: true
      },
      {
        userId: user._id,
        learningPathId: learningPaths[2]._id,
        title: 'Practice SQL queries',
        description: 'Complete exercises on joins',
        priority: 'medium',
        completed: true
      }
    ]);
    console.log('Created todos:', todos.length);

    // Create goals
    const goals = await Goal.create([
      {
        userId: user._id,
        title: 'Complete DP lecture',
        description: 'Finish dynamic programming module',
        type: 'daily',
        targetValue: 1,
        currentValue: 1,
        unit: 'lectures',
        completed: true
      },
      {
        userId: user._id,
        title: 'Solve 3 problems',
        description: 'Daily problem-solving practice',
        type: 'daily',
        targetValue: 3,
        currentValue: 3,
        unit: 'problems',
        completed: true
      },
      {
        userId: user._id,
        title: 'Finish ML notes',
        description: 'Complete notes for current module',
        type: 'daily',
        targetValue: 1,
        currentValue: 0,
        unit: 'tasks',
        completed: false
      },
      {
        userId: user._id,
        title: 'Read system design chapter',
        description: 'Study load balancing concepts',
        type: 'daily',
        targetValue: 1,
        currentValue: 0,
        unit: 'chapters',
        completed: false
      }
    ]);
    console.log('Created goals:', goals.length);

    // Create study sessions for today
    const today = new Date();
    const sessions = await StudySession.create([
      {
        userId: user._id,
        learningPathId: learningPaths[0]._id,
        duration: 90,
        topic: 'Dynamic Programming',
        notes: 'Practiced memoization techniques',
        date: new Date(today.setHours(9, 0, 0, 0))
      },
      {
        userId: user._id,
        learningPathId: learningPaths[1]._id,
        duration: 45,
        topic: 'Regression',
        notes: 'Reviewed linear regression concepts',
        date: new Date(today.setHours(11, 30, 0, 0))
      },
      {
        userId: user._id,
        learningPathId: learningPaths[0]._id,
        duration: 90,
        topic: 'Codeforces Practice',
        notes: 'Solved 3 problems',
        date: new Date(today.setHours(16, 0, 0, 0))
      }
    ]);
    console.log('Created study sessions:', sessions.length);

    // Create study sessions for the week
    const weekSessions = [];
    for (let i = 1; i <= 6; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(10, 0, 0, 0);

      const duration = Math.floor(Math.random() * 180) + 60; // 60-240 minutes
      weekSessions.push({
        userId: user._id,
        learningPathId: learningPaths[Math.floor(Math.random() * learningPaths.length)]._id,
        duration,
        topic: 'Study Session',
        date
      });
    }
    await StudySession.create(weekSessions);
    console.log('Created weekly study sessions:', weekSessions.length);

    // Create a journal entry
    const journal = await Journal.create({
      userId: user._id,
      title: `Reflection - ${new Date().toLocaleDateString()}`,
      content: 'Made good progress on dynamic programming today. Solved several challenging problems and feel more confident with memoization patterns.',
      mood: 'good',
      tags: ['productive', 'learning'],
      date: new Date()
    });
    console.log('Created journal entry');

    console.log('\n✅ Seed completed successfully!');
    console.log('\nYou can now log in with:');
    console.log('Email: het@arcstep.com');
    console.log('Password: password123');

    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
}

seed();
