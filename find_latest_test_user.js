const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = process.env.DB_NAME || 'rayd_ent';

(async () => {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbName);
    const user = await db.collection('users').find({ username: /^cli_test_/ }).sort({ createdAt: -1 }).limit(1).toArray();
    if (!user || user.length === 0) {
      console.log('No cli_test_ user found');
      process.exit(1);
    }
    const u = user[0];
    console.log('Found user:', { id: String(u._id), username: u.username, balance: u.balance });
    process.exit(0);
  } catch (err) {
    console.error('Failed to query test user', err);
    process.exit(2);
  } finally {
    try { await client.close(); } catch(e){}
  }
})();
