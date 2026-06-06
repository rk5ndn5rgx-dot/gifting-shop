import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import {
  addRoomUser,
  addTransaction,
  getAllUsers,
  getGifts,
  getRoomUsers,
  getTransactionsForUser,
  getUserById,
  initStore,
  removeRoomUser,
  saveUser,
  updateUserBalance,
} from './store';

dotenv.config();

const port = Number(process.env.PORT || 4000);

initStore();

const app = express();
app.use(cors());
app.use(express.json());

function now() {
  return new Date().toISOString();
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: now() });
});

app.get('/gifts', (_req, res) => {
  res.json({ gifts: getGifts() });
});

app.get('/balance/:userId', (req, res) => {
  const { userId } = req.params;
  const user = getUserById(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json({ user: { id: user.id, name: user.name, avatar: user.avatar, balance: user.balance } });
});

app.post('/balance/:userId/add', (req, res) => {
  const { userId } = req.params;
  const { amount, reason = 'credit adjustment' } = req.body;
  const parsed = Number(amount);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  const user = getUserById(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const updated = updateUserBalance(userId, user.balance + parsed);
  res.json({ success: true, userId, balance: updated?.balance ?? user.balance, reason });
});

app.post('/profile', (req, res) => {
  const { id, name, avatar, email } = req.body;
  if (!id || !name) {
    return res.status(400).json({ error: 'id and name are required' });
  }

  const user = saveUser({ id, name, avatar, email });
  res.json({ success: true, user });
});

app.get('/profile/:userId', (req, res) => {
  const { userId } = req.params;
  const user = getUserById(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json({ user });
});

app.post('/gift/send', (req, res) => {
  const { senderId, recipientId, giftId, roomId } = req.body;
  if (!senderId || !recipientId || !giftId || !roomId) {
    return res.status(400).json({ error: 'Missing required payload' });
  }

  const gift = getGifts().find((entry) => entry.id === giftId);
  if (!gift) {
    return res.status(404).json({ error: 'Gift not found' });
  }

  const sender = getUserById(senderId);
  const recipient = getUserById(recipientId);
  if (!sender || !recipient) {
    return res.status(404).json({ error: 'Sender or recipient not found' });
  }

  if (sender.balance < gift.price) {
    return res.status(400).json({ error: 'Insufficient credits' });
  }

  updateUserBalance(senderId, sender.balance - gift.price);

  addTransaction({
    id: uuidv4(),
    senderId,
    recipientId,
    giftId,
    roomId,
    price: gift.price,
    createdAt: now(),
  });

  res.json({ success: true, gift, senderId, recipientId, roomId });
});

app.get('/room/:roomId/users', (req, res) => {
  const { roomId } = req.params;
  res.json({ roomId, users: getRoomUsers(roomId) });
});

app.post('/room/:roomId/users/add', (req, res) => {
  const { roomId } = req.params;
  const { userId, displayName } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  addRoomUser(roomId, userId, displayName ?? null);
  res.json({ success: true, roomId, userId });
});

app.post('/room/:roomId/users/remove', (req, res) => {
  const { roomId } = req.params;
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  removeRoomUser(roomId, userId);
  res.json({ success: true, roomId, userId });
});

app.get('/admin/users', (_req, res) => {
  const users = getAllUsers();
  const summaries = users.map((user) => ({
    id: user.id,
    name: user.name,
    avatar: user.avatar,
    email: user.email,
    balance: user.balance,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }));
  res.json({ users: summaries });
});

app.post('/admin/users/:userId/credit', (req, res) => {
  const { userId } = req.params;
  const { amount, note = 'admin credit' } = req.body;
  const parsed = Number(amount);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  const user = getUserById(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const updated = updateUserBalance(userId, user.balance + parsed);
  res.json({ success: true, userId, balance: updated?.balance ?? user.balance, note });
});

app.get('/admin/transactions/:userId', (req, res) => {
  const { userId } = req.params;
  res.json(getTransactionsForUser(userId));
});

app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
});
