import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import express from 'express';
import cors from 'cors';

admin.initializeApp();
const db = admin.firestore();
const app = express();

app.use(cors({ origin: true }));
app.use(express.json());

function parseAmount(value: unknown) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error('Invalid amount');
  }
  return amount;
}

async function getUserDoc(userId: string) {
  return db.collection('users').doc(userId);
}

async function getRoomDoc(roomId: string) {
  return db.collection('rooms').doc(roomId);
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.get('/balance/:userId', async (req, res) => {
  const { userId } = req.params;
  const snapshot = await (await getUserDoc(userId)).get();
  if (!snapshot.exists) {
    return res.status(404).json({ error: 'User not found' });
  }
  return res.json(snapshot.data());
});

app.post('/balance/:userId/add', async (req, res) => {
  const { userId } = req.params;
  const { amount, reason = 'credit adjustment' } = req.body;

  try {
    const parsedAmount = parseAmount(amount);
    const userDoc = await getUserDoc(userId);
    await db.runTransaction(async (tx) => {
      const snapshot = await tx.get(userDoc);
      const current = snapshot.exists ? (snapshot.data()?.balance ?? 0) : 0;
      tx.set(userDoc, { balance: current + parsedAmount, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      tx.set(userDoc.collection('history').doc(), {
        type: 'credit_add',
        amount: parsedAmount,
        reason,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    return res.json({ success: true, message: `Added ${parsedAmount} credits to ${userId}` });
  } catch (error) {
    return res.status(400).json({ error: (error as Error).message });
  }
});

app.post('/gift/send', async (req, res) => {
  const { senderId, recipientId, giftId, giftName, price, roomId } = req.body;

  if (!senderId || !recipientId || !giftId || !giftName || !price || !roomId) {
    return res.status(400).json({ error: 'Missing required gift payload' });
  }

  try {
    const giftValue = parseAmount(price);
    const senderRef = await getUserDoc(senderId);
    const recipientRef = await getUserDoc(recipientId);
    const roomRef = await getRoomDoc(roomId);

    await db.runTransaction(async (tx) => {
      const senderSnap = await tx.get(senderRef);
      if (!senderSnap.exists) {
        throw new Error('Sender not found');
      }

      const senderData = senderSnap.data() ?? {};
      const currentBalance = Number(senderData.balance ?? 0);
      if (currentBalance < giftValue) {
        throw new Error('Insufficient credits');
      }

      tx.set(senderRef, {
        balance: currentBalance - giftValue,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      tx.set(recipientRef, {
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      const transactionRef = db.collection('transactions').doc();
      tx.set(transactionRef, {
        senderId,
        recipientId,
        giftId,
        giftName,
        price: giftValue,
        roomId,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      const roomUsersRef = roomRef.collection('events').doc();
      tx.set(roomUsersRef, {
        type: 'gift_sent',
        senderId,
        recipientId,
        giftId,
        giftName,
        price: giftValue,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    return res.json({ success: true, message: 'Gift sent successfully' });
  } catch (error) {
    return res.status(400).json({ error: (error as Error).message });
  }
});

app.get('/room/:roomId/users', async (req, res) => {
  const { roomId } = req.params;
  const snapshot = await (await getRoomDoc(roomId)).collection('users').get();
  const users = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return res.json({ roomId, users });
});

app.post('/room/:roomId/users/add', async (req, res) => {
  const { roomId } = req.params;
  const { userId, displayName } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  await (await getRoomDoc(roomId)).collection('users').doc(userId).set({ displayName, joinedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  return res.json({ success: true, roomId, userId });
});

app.post('/room/:roomId/users/remove', async (req, res) => {
  const { roomId } = req.params;
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  await (await getRoomDoc(roomId)).collection('users').doc(userId).delete();
  return res.json({ success: true, roomId, userId });
});

app.get('/admin/users', async (_req, res) => {
  const snapshot = await db.collection('users').limit(100).get();
  const users = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return res.json({ users });
});

app.post('/admin/users/:userId/credit', async (req, res) => {
  const { userId } = req.params;
  const { amount, note = 'admin credit' } = req.body;
  try {
    const creditAmount = parseAmount(amount);
    await db.runTransaction(async (tx) => {
      const userRef = await getUserDoc(userId);
      const snapshot = await tx.get(userRef);
      const current = snapshot.exists ? (snapshot.data()?.balance ?? 0) : 0;
      tx.set(userRef, { balance: current + creditAmount, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      tx.set(userRef.collection('history').doc(), {
        type: 'admin_credit',
        amount: creditAmount,
        note,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });
    return res.json({ success: true, userId, amount: creditAmount });
  } catch (error) {
    return res.status(400).json({ error: (error as Error).message });
  }
});

app.get('/admin/transactions/:userId', async (req, res) => {
  const { userId } = req.params;
  const sent = await db.collection('transactions').where('senderId', '==', userId).orderBy('createdAt', 'desc').limit(50).get();
  const received = await db.collection('transactions').where('recipientId', '==', userId).orderBy('createdAt', 'desc').limit(50).get();
  return res.json({ sent: sent.docs.map((doc) => ({ id: doc.id, ...doc.data() })), received: received.docs.map((doc) => ({ id: doc.id, ...doc.data() })) });
});

export const api = functions.https.onRequest(app);
