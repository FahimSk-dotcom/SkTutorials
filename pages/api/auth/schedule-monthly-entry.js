// pages/api/auth/schedule-monthly-entry.js
import { MongoClient, ObjectId } from 'mongodb'

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
  if (req.method !== 'PUT') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  // ✅ Step 1: Secure the endpoint using CRON_SECRET
  const authHeader = req.headers.authorization || ''
  const token = authHeader.split(' ')[1] // "Bearer <token>"
  if (token !== process.env.CRON_SECRET) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  try {
    const db = await connectDB()
    const studentsCollection = db.collection('students')

    const today = new Date()
    const currentMonth = today.toLocaleString('default', {
      month: 'long',
      year: 'numeric'
    })

    const todayDate = today.getDate()

    const activeStudents = await studentsCollection.find({ isActive: true }).toArray()
    console.log(`📦 Found ${activeStudents.length} active students`)

    let updatedCount = 0

    for (const student of activeStudents) {
      const lastPaidDate = new Date(student.lastFeePaidDate)
      const lastPaidDay = lastPaidDate.getDate()

      if (todayDate !== lastPaidDay) continue

      const monthlyFeeStatus = student.monthlyFeeStatus || []
      const alreadyExists = monthlyFeeStatus.some(entry => entry.month === currentMonth)
      if (alreadyExists) continue

      const admissionDate = new Date(student.admissionDate)
      const dueDate = new Date(today.getFullYear(), today.getMonth(), admissionDate.getDate())

      const newEntry = {
        month: currentMonth,
        paid: false,
        paidOn: null,
        dueDate: dueDate.toISOString()
      }

      await studentsCollection.updateOne(
        { _id: new ObjectId(student._id) },
        {
          $push: { monthlyFeeStatus: newEntry },
          $set: { updatedAt: new Date() }
        }
      )
      updatedCount++
      console.log(`✅ Added unpaid entry for: ${student.name}`)
    }

    return res.status(200).json({
      message: `Monthly unpaid entry added for ${updatedCount} student(s) on ${today.toDateString()}`
    })

  } catch (error) {
    console.error('❌ Schedule monthly entry error:', error)
    return res.status(500).json({ message: 'Internal server error' })
  }
}
