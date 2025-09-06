import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/supabase-db';

export async function GET() {
  try {
    console.log('Testing Supabase Database connection...');
    
    const { db } = await connectToDatabase();
    
    // Test basic database operation
    const users = await db.collection('users').find();
    const meals = await db.collection('meals').find();
    
    console.log('Connected successfully!');
    console.log('Users found:', users.length);
    console.log('Meals found:', meals.length);
    
    return NextResponse.json({
      success: true,
      message: 'Supabase Database connection successful',
      database: 'Supabase PostgreSQL',
      users: users.length,
      meals: meals.length,
      sampleUser: users[0] ? { username: users[0].username, id: users[0].id } : null,
      sampleMeal: meals[0] ? { title: meals[0].title, id: meals[0].id } : null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database connection error:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack,
      database: 'Supabase PostgreSQL',
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Present' : 'Missing',
      supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Present' : 'Missing'
    }, { status: 500 });
  }
}