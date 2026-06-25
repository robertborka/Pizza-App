import mongoose from "mongoose";

const MISSING_DATABASE_MESSAGE =
  "Conexiunea internă nu este configurată.";

export function getMongoUrl() {
  return process.env.MONGO_URL || process.env.MONGO_URI || "";
}

export function hasDatabaseConfig() {
  return Boolean(getMongoUrl());
}

export function isMissingDatabaseConfigError(error) {
  const message = String(error?.message || "");

  return (
    message.includes("MONGO_URL") ||
    message.includes("MONGO_URI") ||
    message.includes(MISSING_DATABASE_MESSAGE)
  );
}

export async function connectToDatabase() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  const mongoUrl = getMongoUrl();

  if (!mongoUrl) {
    throw new Error(MISSING_DATABASE_MESSAGE);
  }

  await mongoose.connect(mongoUrl);
  return mongoose.connection;
}

export async function tryConnectToDatabase() {
  if (!hasDatabaseConfig()) {
    return false;
  }

  await connectToDatabase();
  return true;
}
