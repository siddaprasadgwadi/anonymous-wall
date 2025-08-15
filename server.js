import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import User from './models/User.js';
import Post from './models/Post.js';
import auth from './middleware/auth.js';
import optionalAuth from './middleware/optionalAuth.js';
import { analyzeText } from './utils/ai.js';

const app = express();

// ----- Core middleware
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: '200kb' }));
app.use(express.static('public'));

// ----- Rate limits
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 100 });
const postLimiter = rateLimit({ windowMs: 60 * 1000, limit: 20 });
app.use('/api/auth/', authLimiter);
app.use('/api/posts', postLimiter);

// ----- DB connect
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((e) => { console.error('MongoDB error', e); process.exit(1); });

// ================= AUTH =================
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = (req.body || {});
    if (!username || !email || !password)
      return res.status(400).json({ error: 'username, email, password required' });

    const exists = await User.findOne({ $or: [{ email }, { username }] });
    if (exists) return res.status(409).json({ error: 'User already exists' });

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, email, password: hash });
    const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: user._id, username: user.username, email: user.email }});
  } catch (e) {
    res.status(500).json({ error: 'Register failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { emailOrUsername, password } = (req.body || {});
    if (!emailOrUsername || !password) return res.status(400).json({ error: 'Missing fields' });

    const user = await User.findOne({
      $or: [{ email: emailOrUsername.toLowerCase() }, { username: emailOrUsername }]
    });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, username: user.username, email: user.email }});
  } catch {
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/auth/me', auth, async (req, res) => {
  const user = await User.findById(req.user.id).select('_id username email createdAt');
  res.json({ user });
});

// ================= POSTS =================

// Create a post (logged-in) with optional anonymity
app.post('/api/posts', auth, async (req, res) => {
  try {
    let { text, anonymous } = (req.body || {});
    text = (text || '').toString().trim();
    if (!text) return res.status(400).json({ error: 'Text required' });
    if (text.length > 500) return res.status(400).json({ error: 'Max 500 chars' });

    const { sentiment, isToxic, tags } = analyzeText(text);
    if (isToxic) {
      return res.status(400).json({ error: 'Message flagged for profanity/toxicity. Please revise.' });
    }

    const post = await Post.create({
      userId: req.user.id,
      text,
      anonymous: Boolean(anonymous),
      sentiment,
      isToxic,
      tags
    });

    res.status(201).json({ id: post._id });
  } catch {
    res.status(500).json({ error: 'Create failed' });
  }
});

// Public feed (works with or without auth). If anonymous=true, author name is hidden.
app.get('/api/posts', optionalAuth, async (req, res) => {
  try {
    // pull latest 100
    const posts = await Post.find().sort({ createdAt: -1 }).limit(100).populate('userId', 'username');
    const out = posts.map(p => ({
      id: p._id,
      text: p.text,
      anonymous: p.anonymous,
      author: p.anonymous ? 'Anonymous' : (p.userId?.username || 'Unknown'),
      sentiment: p.sentiment,
      tags: p.tags || [],
      createdAt: p.createdAt,
      owned: req.user?.id && String(p.userId?._id) === String(req.user.id)
    }));
    res.json(out);
  } catch {
    res.status(500).json({ error: 'Fetch failed' });
  }
});

// My posts (includes anonymous)
app.get('/api/my-posts', auth, async (req, res) => {
  try {
    const posts = await Post.find({ userId: req.user.id }).sort({ createdAt: -1 });
    const out = posts.map(p => ({
      id: p._id,
      text: p.text,
      anonymous: p.anonymous,
      sentiment: p.sentiment,
      tags: p.tags || [],
      createdAt: p.createdAt
    }));
    res.json(out);
  } catch {
    res.status(500).json({ error: 'Fetch failed' });
  }
});

// Update own post
app.put('/api/posts/:id', auth, async (req, res) => {
  try {
    const { text, anonymous } = (req.body || {});
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Not found' });
    if (String(post.userId) !== req.user.id) return res.status(403).json({ error: 'Not yours' });

    if (typeof text === 'string') {
      if (!text.trim()) return res.status(400).json({ error: 'Text required' });
      if (text.length > 500) return res.status(400).json({ error: 'Max 500 chars' });
      const { sentiment, isToxic, tags } = analyzeText(text);
      if (isToxic) return res.status(400).json({ error: 'Message flagged for profanity' });
      post.text = text;
      post.sentiment = sentiment;
      post.isToxic = isToxic;
      post.tags = tags;
    }
    if (typeof anonymous === 'boolean') post.anonymous = anonymous;

    await post.save();
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Update failed' });
  }
});

// Delete own post
app.delete('/api/posts/:id', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Not found' });
    if (String(post.userId) !== req.user.id) return res.status(403).json({ error: 'Not yours' });

    await post.deleteOne();
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Delete failed' });
  }
});

// ----- start
app.listen(process.env.PORT, () => {
  console.log(`Server running on http://localhost:${process.env.PORT}`);
});
