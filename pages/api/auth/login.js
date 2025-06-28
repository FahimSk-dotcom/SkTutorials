// api/auth/Login.js
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { MongoClient } from 'mongodb'

let client
let db

async function connectDB() {
  if (!client) {
    client = new MongoClient(process.env.MONGODB_URI)
    await client.connect()
    db = client.db('sk-tutorial')
  }
  return db
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const database = await connectDB()
    const users = database.collection('users')

    const { email, password, role } = req.body

    // Validate input
    if (!email || !password || !role) {
      return res.status(400).json({ 
        message: 'Email, password, and role are required' 
      })
    }

    // Find user by email and role
    const user = await users.findOne({ 
      email: email.toLowerCase(),
      role: role
    })

    if (!user) {
      return res.status(401).json({ 
        message: 'Invalid credentials or role' 
      })
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({ 
        message: 'Account is deactivated. Please contact administrator.' 
      })
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password)
    
    if (!isPasswordValid) {
      return res.status(401).json({ 
        message: 'Invalid credentials' 
      })
    }

    // Create JWT token
    const token = jwt.sign(
      { 
        userId: user._id,
        email: user.email,
        role: user.role,
        name: user.name
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    )

    // Update last login
    await users.updateOne(
      { _id: user._id },
      { $set: { lastLogin: new Date() } }
    )

    // Return success response
    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive
      }
    })

  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ 
      message: 'Internal server error' 
    })
  }
}