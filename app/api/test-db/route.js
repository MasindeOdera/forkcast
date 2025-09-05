import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

export async function GET() {
  try {
    console.log('Testing MongoDB connection...');
    console.log('MONGO_URL:', process.env.MONGO_URL ? 'Present' : 'Missing');
    console.log('DB_NAME:', process.env.DB_NAME);
    
    const { db } = await connectToDatabase();
    
    // Test basic database operation
    const collections = await db.listCollections().toArray();
    console.log('Connected successfully! Collections:', collections.map(c => c.name));
    
    return NextResponse.json({
      success: true,
      message: 'Database connection successful',
      database: process.env.DB_NAME,
      collections: collections.map(c => c.name),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database connection error:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack,
      mongoUrl: process.env.MONGO_URL ? 'Present (hidden)' : 'Missing',
      dbName: process.env.DB_NAME
    }, { status: 500 });
  }
}