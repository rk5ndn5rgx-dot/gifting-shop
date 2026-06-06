CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  avatar TEXT,
  email TEXT,
  balance INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS gifts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  image TEXT,
  description TEXT,
  animation TEXT,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  senderId TEXT NOT NULL,
  recipientId TEXT NOT NULL,
  giftId TEXT NOT NULL,
  roomId TEXT NOT NULL,
  price INTEGER NOT NULL,
  createdAt TEXT NOT NULL,
  FOREIGN KEY (senderId) REFERENCES users(id),
  FOREIGN KEY (recipientId) REFERENCES users(id),
  FOREIGN KEY (giftId) REFERENCES gifts(id)
);

CREATE TABLE IF NOT EXISTS room_users (
  roomId TEXT NOT NULL,
  userId TEXT NOT NULL,
  displayName TEXT,
  joinedAt TEXT NOT NULL,
  PRIMARY KEY (roomId, userId)
);
