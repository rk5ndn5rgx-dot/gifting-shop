import fs from 'fs';
import path from 'path';

export interface User {
  id: string;
  name: string;
  avatar: string | null;
  email: string | null;
  balance: number;
  createdAt: string;
  updatedAt: string;
}

export interface Gift {
  id: string;
  name: string;
  price: number;
  image: string | null;
  description: string | null;
  animation: string | null;
  createdAt: string;
}

export interface Transaction {
  id: string;
  senderId: string;
  recipientId: string;
  giftId: string;
  roomId: string;
  price: number;
  createdAt: string;
}

export interface RoomUser {
  roomId: string;
  userId: string;
  displayName: string | null;
  joinedAt: string;
}

export interface Store {
  users: User[];
  gifts: Gift[];
  transactions: Transaction[];
  roomUsers: RoomUser[];
}

const databaseFile = process.env.DATABASE_FILE || './data/store.json';
const storePath = path.resolve(databaseFile);

function now() {
  return new Date().toISOString();
}

function ensureDirectory() {
  const folder = path.dirname(storePath);
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
  }
}

const initialStore: Store = {
  users: [],
  gifts: [
    {
      id: 'sparkle',
      name: 'Sparkle',
      price: 25,
      image: null,
      description: 'Send a joyful sparkle animation.',
      animation: null,
      createdAt: now(),
    },
    {
      id: 'heart',
      name: 'Heart',
      price: 50,
      image: null,
      description: 'Share a heart to show love.',
      animation: null,
      createdAt: now(),
    },
    {
      id: 'star',
      name: 'Star',
      price: 100,
      image: null,
      description: 'A premium star gift for the stage.',
      animation: null,
      createdAt: now(),
    },
  ],
  transactions: [],
  roomUsers: [],
};

export function initStore(): void {
  ensureDirectory();

  if (!fs.existsSync(storePath)) {
    fs.writeFileSync(storePath, JSON.stringify(initialStore, null, 2) + '\n', 'utf-8');
    return;
  }

  try {
    const raw = fs.readFileSync(storePath, 'utf-8');
    JSON.parse(raw);
  } catch {
    fs.writeFileSync(storePath, JSON.stringify(initialStore, null, 2) + '\n', 'utf-8');
  }
}

function readStore(): Store {
  ensureDirectory();

  if (!fs.existsSync(storePath)) {
    initStore();
  }

  return JSON.parse(fs.readFileSync(storePath, 'utf-8')) as Store;
}

function writeStore(store: Store): void {
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2) + '\n', 'utf-8');
}

export function getGifts(): Gift[] {
  return readStore().gifts;
}

export function getUserById(userId: string): User | undefined {
  return readStore().users.find((user) => user.id === userId);
}

export function saveUser(userInput: {
  id: string;
  name: string;
  avatar?: string | null;
  email?: string | null;
}): User {
  const store = readStore();
  const nowIso = now();
  const existing = store.users.find((user) => user.id === userInput.id);

  if (existing) {
    existing.name = userInput.name;
    existing.avatar = userInput.avatar ?? null;
    existing.email = userInput.email ?? null;
    existing.updatedAt = nowIso;
    writeStore(store);
    return existing;
  }

  const newUser: User = {
    id: userInput.id,
    name: userInput.name,
    avatar: userInput.avatar ?? null,
    email: userInput.email ?? null,
    balance: 0,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  store.users.push(newUser);
  writeStore(store);
  return newUser;
}

export function updateUserBalance(userId: string, amount: number): User | undefined {
  const store = readStore();
  const user = store.users.find((entry) => entry.id === userId);
  if (!user) {
    return undefined;
  }

  user.balance = amount;
  user.updatedAt = now();
  writeStore(store);
  return user;
}

export function addTransaction(transaction: Transaction): void {
  const store = readStore();
  store.transactions.push(transaction);
  writeStore(store);
}

export function getRoomUsers(roomId: string): RoomUser[] {
  return readStore().roomUsers.filter((entry) => entry.roomId === roomId);
}

export function addRoomUser(roomId: string, userId: string, displayName: string | null): void {
  const store = readStore();
  const existing = store.roomUsers.find((entry) => entry.roomId === roomId && entry.userId === userId);
  const joinedAt = now();

  if (existing) {
    existing.displayName = displayName;
    existing.joinedAt = joinedAt;
  } else {
    store.roomUsers.push({ roomId, userId, displayName, joinedAt });
  }

  writeStore(store);
}

export function removeRoomUser(roomId: string, userId: string): void {
  const store = readStore();
  store.roomUsers = store.roomUsers.filter((entry) => entry.roomId !== roomId || entry.userId !== userId);
  writeStore(store);
}

export function getTransactionsForUser(userId: string) {
  const store = readStore();
  return {
    sent: store.transactions.filter((entry) => entry.senderId === userId),
    received: store.transactions.filter((entry) => entry.recipientId === userId),
  };
}

export function getAllUsers(): User[] {
  return readStore().users;
}
