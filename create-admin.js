#!/usr/bin/env node
// create-admin.js
// Usage: node create-admin.js
// Optionally set ADMIN_EMAIL and ADMIN_PASSWORD env vars before running to avoid prompts.

const readline = require('readline');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'rayd_ent';

async function prompt(question, silent = false) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    if (silent) {
      // hide input when typing password
      const onDataHandler = (char) => {
        char = char + '';
        switch (char) {
          case '\n':
          case '\r':
          case '\u0004':
            process.stdin.pause();
            break;
          default:
            process.stdout.clearLine(0);
            process.stdout.cursorTo(0);
            process.stdout.write(question + Array(rl.line.length + 1).join('*'));
            break;
        }
      };
      process.stdin.on('data', onDataHandler);

      rl.question(question, (answer) => {
        process.stdin.removeListener('data', onDataHandler);
        rl.close();
        process.stdout.write('\n');
        resolve(answer);
      });
    } else {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer);
      });
    }
  });
}

async function main() {
  try {
    const email = process.env.ADMIN_EMAIL || (await prompt('Admin email: '));
    let password = process.env.ADMIN_PASSWORD;
    if (!password) password = await prompt('Admin password: ', true);

    if (!email || !password) {
      console.error('Email and password are required.');
      process.exit(1);
    }

  const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(DB_NAME);

    const hashed = await bcrypt.hash(password, 10);

    // Upsert admin by email
    const res = await db.collection('admins').findOneAndUpdate(
      { email },
      { $set: { password: hashed, email, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true, returnDocument: 'after' }
    );

    console.log('Admin account created/updated for:', email);
    await client.close();
    process.exit(0);
  } catch (err) {
    console.error('Failed to create admin:', err);
    process.exit(1);
  }
}

main();
