import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/jsondb';

export async function GET() {
  try {
    console.log('Testing JSON Database connection...');
    
    const { db } = await connectToDatabase();
    
    // Test basic database operation
    const users = await db.collection('users').find().then(results => 
      Array.isArray(results) ? results : []
    );
    const meals = await db.collection('meals').find().then(results => 
      Array.isArray(results) ? results : []
    );
    
    console.log('Connected successfully!');
    console.log('Users:', users.length);
    console.log('Meals:', meals.length);
    
    return NextResponse.json({
      success: true,
      message: 'JSON Database connection successful',
      database: 'JSON Database',
      users: users.length,
      meals: meals.length,
      sampleUser: users[0] ? { username: users[0].username, id: users[0].id } : null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database connection error:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack,
      database: 'JSON Database'
    }, { status: 500 });
  }
}