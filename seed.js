const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');
const LearningPath = require('./models/LearningPath');
const Todo = require('./models/Todo');
const Goal = require('./models/Goal');
const StudySession = require('./models/StudySession');
const Journal = require('./models/Journal');

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await LearningPath.deleteMany({});
    await Todo.deleteMany({});
    await Goal.deleteMany({});
    await StudySession.deleteMany({});
    await Journal.deleteMany({});

    // Create user
    const user = await User.create({
      name: 'Het',
      email: 'het@arcstep.com',
      password: 'password123',
      bio: 'Building skills, one step at a time.',
      streak: { current: 12, longest: 18, lastActiveDate: new Date() }
    });

    console.log('User created:', user.email);

    // Create Learning Paths
    const dsaPath = await LearningPath.create({
      user: user._id,
      title: 'Data Structures & Algorithms',
      description: 'Build strong problem-solving fundamentals through consistent practice.',
      color: '#6C63FF',
      icon: '🧮',
      progress: 78,
      totalTopics: 54,
      completedTopics: 42,
      currentModule: 'Dynamic Programming',
      currentTopic: 'Memoization & Tabulation',
      nextMilestone: 'Complete 15 medium-level problems',
      status: 'active',
      startDate: new Date('2026-08-12'),
      targetDate: new Date('2026-12-20'),
      totalStudyTime: 5192,
      tasksCompleted: 127,
      modules: [
        { title: 'Arrays', status: 'completed', progress: 100, topics: [
          { title: 'Array Basics', completed: true }, { title: 'Two Pointers', completed: true },
          { title: 'Sliding Window', completed: true }, { title: 'Prefix Sum', completed: true }
        ]},
        { title: 'Binary Search', status: 'completed', progress: 100, topics: [
          { title: 'Basic Binary Search', completed: true }, { title: 'Search in Rotated Array', completed: true },
          { title: 'Binary Search on Answer', completed: true }
        ]},
        { title: 'Linked Lists', status: 'completed', progress: 100, topics: [
          { title: 'Singly Linked List', completed: true }, { title: 'Doubly Linked List', completed: true },
          { title: 'Cycle Detection', completed: true }
        ]},
        { title: 'Trees', status: 'completed', progress: 100, topics: [
          { title: 'Binary Trees', completed: true }, { title: 'BST', completed: true },
          { title: 'Tree Traversals', completed: true }
        ]},
        { title: 'Graphs', status: 'completed', progress: 100, topics: [
          { title: 'BFS', completed: true }, { title: 'DFS', completed: true },
          { title: 'Topological Sort', completed: true }
        ]},
        { title: 'Dynamic Programming', status: 'in_progress', progress: 40, topics: [
          { title: 'Fibonacci & Basics', completed: true }, { title: 'Memoization & Tabulation', completed: true },
          { title: 'Knapsack Problems', completed: false }, { title: 'LCS & LIS', completed: false },
          { title: 'DP on Trees', completed: false }
        ]}
      ]
    });

    const mlPath = await LearningPath.create({
      user: user._id,
      title: 'Machine Learning',
      description: 'Master the fundamentals of machine learning and deep learning.',
      color: '#22C55E',
      icon: '🤖',
      progress: 52,
      totalTopics: 35,
      completedTopics: 18,
      currentModule: 'Regression',
      currentTopic: 'Logistic Regression',
      nextMilestone: 'Complete classification algorithms',
      status: 'active',
      startDate: new Date('2026-09-01'),
      targetDate: new Date('2027-03-01'),
      totalStudyTime: 2460
    });

    const webPath = await LearningPath.create({
      user: user._id,
      title: 'Web Development',
      description: 'Full-stack web development with modern frameworks.',
      color: '#F59E0B',
      icon: '🌐',
      progress: 64,
      totalTopics: 40,
      completedTopics: 26,
      currentModule: 'React Advanced',
      currentTopic: 'State Management',
      nextMilestone: 'Build portfolio project',
      status: 'active',
      startDate: new Date('2026-07-15'),
      targetDate: new Date('2027-01-15'),
      totalStudyTime: 3800
    });

    const sysDesignPath = await LearningPath.create({
      user: user._id,
      title: 'System Design',
      description: 'Learn to design scalable distributed systems.',
      color: '#EF4444',
      icon: '🏗️',
      progress: 31,
      totalTopics: 28,
      completedTopics: 9,
      currentModule: 'Load Balancing',
      currentTopic: 'Load Balancer Types',
      nextMilestone: 'Complete caching chapter',
      status: 'active',
      startDate: new Date('2026-09-10'),
      targetDate: new Date('2027-06-01'),
      totalStudyTime: 1240
    });

    console.log('Learning paths created');

    // Create today's Todos
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todos = await Todo.insertMany([
      {
        user: user._id, title: 'Solve 5 Dynamic Programming problems',
        category: 'DSA', learningPath: dsaPath._id, learningPathName: 'Data Structures & Algorithms',
        priority: 'high', estimatedDuration: 90, dueDate: today, order: 0
      },
      {
        user: user._id, title: 'Complete Binary Trees lecture',
        category: 'DSA', learningPath: dsaPath._id, learningPathName: 'Data Structures & Algorithms',
        priority: 'medium', estimatedDuration: 60, dueDate: today, order: 1
      },
      {
        user: user._id, title: 'Revise regression notes',
        category: 'Machine Learning', learningPath: mlPath._id, learningPathName: 'Machine Learning',
        priority: 'medium', estimatedDuration: 45, dueDate: today, order: 2
      },
      {
        user: user._id, title: 'Work on portfolio project',
        category: 'Web Development', learningPath: webPath._id, learningPathName: 'Web Development',
        priority: 'low', estimatedDuration: 60, dueDate: today, order: 3
      },
      {
        user: user._id, title: 'Read system design chapter',
        category: 'System Design', learningPath: sysDesignPath._id, learningPathName: 'System Design',
        priority: 'medium', estimatedDuration: 40, dueDate: today, order: 4
      },
      {
        user: user._id, title: 'Solve 3 Codeforces problems',
        category: 'DSA', learningPath: dsaPath._id, learningPathName: 'Data Structures & Algorithms',
        priority: 'high', estimatedDuration: 75, dueDate: today, order: 5, completed: true, completedAt: new Date()
      },
      {
        user: user._id, title: 'Review ML lecture slides',
        category: 'Machine Learning', learningPath: mlPath._id, learningPathName: 'Machine Learning',
        priority: 'low', estimatedDuration: 30, dueDate: today, order: 6, completed: true, completedAt: new Date()
      },
      {
        user: user._id, title: 'Practice SQL queries',
        category: 'Web Development', learningPath: webPath._id, learningPathName: 'Web Development',
        priority: 'medium', estimatedDuration: 35, dueDate: today, order: 7, completed: true, completedAt: new Date()
      }
    ]);

    console.log('Todos created:', todos.length);

    // Create today's Goals
    const goals = await Goal.insertMany([
      { user: user._id, title: 'Complete DP lecture', completed: true, completedAt: new Date(), date: today, type: 'daily' },
      { user: user._id, title: 'Solve 3 problems', completed: true, completedAt: new Date(), date: today, type: 'daily' },
      { user: user._id, title: 'Finish ML notes', completed: false, date: today, type: 'daily' },
      { user: user._id, title: 'Read system design chapter', completed: false, date: today, type: 'daily' }
    ]);

    console.log('Goals created:', goals.length);

    // Create today's Study Sessions
    const todayDate = new Date();
    const sessions = await StudySession.insertMany([
      {
        user: user._id, subject: 'Data Structures & Algorithms', topic: 'Dynamic Programming',
        learningPath: dsaPath._id, duration: 90,
        startTime: new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate(), 9, 0),
        endTime: new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate(), 10, 30),
        notes: 'Solved memoization problems', productivity: 4
      },
      {
        user: user._id, subject: 'Machine Learning', topic: 'Regression',
        learningPath: mlPath._id, duration: 45,
        startTime: new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate(), 11, 30),
        endTime: new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate(), 12, 15),
        notes: 'Covered logistic regression basics', productivity: 3
      },
      {
        user: user._id, subject: 'Competitive Programming', topic: 'Codeforces Practice',
        duration: 90,
        startTime: new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate(), 16, 0),
        endTime: new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate(), 17, 30),
        notes: 'Practiced graph problems', productivity: 5
      }
    ]);

    // Create weekly study sessions (past days)
    const weekDays = [-6, -5, -4, -3, -2, -1]; // Past 6 days
    const hoursPerDay = [2, 4, 3, 5, 4, 6];
    for (let i = 0; i < weekDays.length; i++) {
      const d = new Date(todayDate);
      d.setDate(d.getDate() + weekDays[i]);
      await StudySession.create({
        user: user._id,
        subject: ['Data Structures & Algorithms', 'Machine Learning', 'Web Development', 'System Design', 'Data Structures & Algorithms', 'Machine Learning'][i],
        topic: 'Practice',
        duration: hoursPerDay[i] * 60,
        startTime: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9, 0),
        endTime: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9 + hoursPerDay[i], 0),
        productivity: 4
      });
    }

    console.log('Study sessions created');

    console.log('\n✅ Database seeded successfully!');
    console.log('Login credentials:');
    console.log('  Email: het@arcstep.com');
    console.log('  Password: password123');

    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seedData();
