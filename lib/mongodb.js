import { MongoClient } from 'mongodb';

// Lazy initialisation - avoid throwing at module load so the Next.js
// build does not crash when MONGO_URL is absent (e.g., static route
// collection during CI). The error is raised on first real DB call.

let clientPromise = null;

function getClientPromise() {
  if (clientPromise) return clientPromise;

  const uri = process.env.MONGO_URL;
  if (!uri) {
    throw new Error('MONGO_URL environment variable is required');
  }

  const options = {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10,
    minPoolSize: 2,
    maxIdleTimeMS: 30000,
  };

  if (process.env.NODE_ENV === 'development') {
    // Preserve the client across HMR reloads in dev.
    if (!global._mongoClientPromise) {
      const client = new MongoClient(uri, options);
      global._mongoClientPromise = client.connect();
    }
    clientPromise = global._mongoClientPromise;
  } else {
    const client = new MongoClient(uri, options);
    clientPromise = client.connect();
  }

  return clientPromise;
}

export async function connectToDatabase() {
  const client = await getClientPromise();
  const dbName = process.env.DB_NAME || 'forkcast';
  const db = client.db(dbName);
  return { client, db };
}

export default { connectToDatabase };
