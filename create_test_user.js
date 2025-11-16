const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = process.env.DB_NAME || 'rayd_ent';

(async () => {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbName);
    const username = `cli_test_${Date.now()}`;
    const now = new Date();
    const res = await db.collection('users').insertOne({ username, balance: 100, createdAt: now, lastSeen: now });
    console.log('Inserted userId:', res.insertedId.toString());
    process.exit(0);
  } catch (err) {
    console.error('Failed to create test user', err);
    process.exit(1);
  } finally {
    try { await client.close(); } catch(e){}
  }
})();
