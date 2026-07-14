import mongoose from 'mongoose';
import { config } from './index';

export async function connectDB() {
  const MONGODB_URI = config.mongodbUri;
  try {
    // Note: Mongoose v6+ no longer requires useNewUrlParser or useUnifiedTopology flags
    await mongoose.connect(MONGODB_URI);
    console.log('Successfully connected to MongoDB database.');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
}

export async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB connection disconnected.');
});
