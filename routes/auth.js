const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const EmailVerification = require('../models/EmailVerification');
const { generateOTP, sendVerificationEmail, createTransporter } = require('../utils/emailService');
const auth = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const RESEND_COOLDOWN_MS = 30 * 1000; // 30 seconds

// Diagnostic endpoint to check email configuration and SMTP status
router.get('/email-status', async (req, res) => {
  const hasUser = !!process.env.EMAIL_USER;
  const hasPass = !!process.env.EMAIL_PASS;
  const hasService = !!process.env.EMAIL_SERVICE;
  const hasFrom = !!process.env.EMAIL_FROM;
  const maskedUser = process.env.EMAIL_USER
    ? process.env.EMAIL_USER.replace(/^(.{2})(.*)(@.*)$/, '$1***$3')
    : null;

  if (!hasUser || !hasPass) {
    return res.status(500).json({
      configured: false,
      message: 'EMAIL_USER or EMAIL_PASS environment variable is missing on this deployment. If you added them in Vercel settings, you must REDEPLOY for changes to take effect.',
      environment: process.env.NODE_ENV || 'development',
      details: { hasService, hasUser, hasPass, hasFrom }
    });
  }

  try {
    const transporter = createTransporter();
    await transporter.verify();
    return res.json({
      configured: true,
      status: 'connected',
      message: 'SMTP transporter verified successfully. Server is ready to send emails.',
      service: process.env.EMAIL_SERVICE || 'gmail',
      user: maskedUser
    });
  } catch (error) {
    return res.status(500).json({
      configured: true,
      status: 'smtp_error',
      message: error.message,
      code: error.code || 'UNKNOWN',
      hint: 'If error is 535 (Authentication Failed), verify 2-Step Verification is ON and generate a fresh Gmail App Password. Check Google Account Security Activity.'
    });
  }
});

// Send Verification OTP before registration
router.post('/send-otp', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }

    if (!email || !EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({ success: false, message: 'A valid email address is required' });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email is already registered' });
    }

    // Check cooldown on existing verification
    const existingVerification = await EmailVerification.findOne({ email: normalizedEmail });
    if (existingVerification && existingVerification.lastSentAt) {
      const timeSinceLastSent = Date.now() - new Date(existingVerification.lastSentAt).getTime();
      if (timeSinceLastSent < RESEND_COOLDOWN_MS) {
        const remainingSec = Math.ceil((RESEND_COOLDOWN_MS - timeSinceLastSent) / 1000);
        return res.status(429).json({
          success: false,
          message: `Please wait ${remainingSec}s before requesting a new code`
        });
      }
    }

    // Generate 6-digit OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

    // Save/update verification record
    await EmailVerification.findOneAndUpdate(
      { email: normalizedEmail },
      {
        email: normalizedEmail,
        otp,
        attempts: 0,
        lastSentAt: new Date(),
        expiresAt,
        createdAt: new Date()
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Send email
    await sendVerificationEmail(normalizedEmail, otp, name.trim());

    res.json({
      success: true,
      message: 'Verification code sent to your email'
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to send verification code'
    });
  }
});

// Resend Verification OTP
router.post('/resend-otp', async (req, res) => {
  try {
    const { email, name } = req.body;

    if (!email || !EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({ success: false, message: 'A valid email address is required' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email is already registered' });
    }

    // Check cooldown
    const existingRecord = await EmailVerification.findOne({ email: normalizedEmail });
    if (existingRecord && existingRecord.lastSentAt) {
      const timeSinceLast = Date.now() - new Date(existingRecord.lastSentAt).getTime();
      if (timeSinceLast < RESEND_COOLDOWN_MS) {
        const remainingSec = Math.ceil((RESEND_COOLDOWN_MS - timeSinceLast) / 1000);
        return res.status(429).json({
          success: false,
          message: `Please wait ${remainingSec}s before requesting another code`
        });
      }
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

    await EmailVerification.findOneAndUpdate(
      { email: normalizedEmail },
      {
        email: normalizedEmail,
        otp,
        attempts: 0,
        lastSentAt: new Date(),
        expiresAt,
        createdAt: new Date()
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await sendVerificationEmail(normalizedEmail, otp, name ? name.trim() : '');

    res.json({
      success: true,
      message: 'A new verification code has been sent to your email'
    });
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to resend verification code'
    });
  }
});

// Register (Verifies 6-digit code and creates user)
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, otp } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    if (!otp || String(otp).trim().length !== 6) {
      return res.status(400).json({ success: false, message: 'A valid 6-digit verification code is required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    // Verify OTP record
    const record = await EmailVerification.findOne({ email: normalizedEmail });
    if (!record) {
      return res.status(400).json({
        success: false,
        message: 'No verification code found. Please request a new code.'
      });
    }

    // Check expiration
    const now = Date.now();
    const isExpired = record.expiresAt
      ? new Date(record.expiresAt).getTime() < now
      : record.createdAt && (now - new Date(record.createdAt).getTime() > OTP_EXPIRY_MS);

    if (isExpired) {
      await EmailVerification.deleteOne({ _id: record._id });
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired. Please request a new one.'
      });
    }

    // Check attempt limit
    if (record.attempts >= 5) {
      await EmailVerification.deleteOne({ _id: record._id });
      return res.status(400).json({
        success: false,
        message: 'Too many incorrect attempts. Please request a new code.'
      });
    }

    // Validate OTP match
    if (String(record.otp).trim() !== String(otp).trim()) {
      record.attempts = (record.attempts || 0) + 1;
      await record.save();
      const remainingAttempts = 5 - record.attempts;
      return res.status(400).json({
        success: false,
        message: remainingAttempts > 0
          ? `Invalid verification code. ${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining.`
          : 'Invalid code. Attempt limit reached. Please request a new code.'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword
    });

    // OTP matched and user created! Remove verification record
    await EmailVerification.deleteOne({ _id: record._id }).catch((err) => {
      console.warn('Failed to clean up EmailVerification record:', err.message);
    });

    // Generate token
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: 'Server error', code: error?.code || 'UNKNOWN' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find user
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error', code: error?.code || 'UNKNOWN' });
  }
});

// Get current user
router.get('/me', auth, async (req, res) => {
  try {
    res.json({
      success: true,
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        avatar: req.user.avatar
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
});

module.exports = router;
