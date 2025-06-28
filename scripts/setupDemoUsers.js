const { MongoClient } = require('mongodb')
const bcrypt = require('bcryptjs')
require('dotenv').config({ path: '.env.local' })

async function setupDemoUsers() {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017')
  
  try {
    await client.connect()
    console.log('Connected to MongoDB')
    
    const db = client.db('sk-tutorial')
    const users = db.collection('users')

    // Check if demo users already exist
    const adminExists = await users.findOne({ email: 'admin@sktutorial.com' })
    const teacherExists = await users.findOne({ email: 'teacher@sktutorial.com' })

    if (adminExists && teacherExists) {
      console.log('Demo users already exist')
      return
    }

    // Delete existing demo users if any
    await users.deleteMany({ 
      email: { $in: ['admin@sktutorial.com', 'teacher@sktutorial.com'] } 
    })

    // Hash passwords
    const adminPassword = await bcrypt.hash('admin@FahimCEO', 12)
    const teacherPassword = await bcrypt.hash('teacher@SkTutorial', 12)

    // Create demo users
    const demoUsers = [
      {
        name: 'Admin User',
        email: 'admin@sktutorial.com',
        password: adminPassword,
        role: 'admin',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLogin: null
      },
      {
        name: 'Teacher User',
        email: 'teacher@sktutorial.com',
        password: teacherPassword,
        role: 'teacher',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLogin: null
      }
    ]

    const result = await users.insertMany(demoUsers)
    console.log('Demo users created successfully:', result.insertedIds)
    
  } catch (error) {
    console.error('Error setting up demo users:', error)
  } finally {
    await client.close()
  }
}

setupDemoUsers()