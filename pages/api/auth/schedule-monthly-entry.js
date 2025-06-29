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

  // ✅ Secure the endpoint using CRON_SECRET
  const authHeader = req.headers.authorization || ''
  const token = authHeader.split(' ')[1] // Bearer <token>
  
  if (token !== process.env.CRON_SECRET) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  try {
    const db = await connectDB()
    const studentsCollection = db.collection('students')
    
    const today = new Date()
    
    // ✅ FIXED: Get CURRENT month instead of next month
    const currentMonthString = today.toLocaleString('default', {
      month: 'long',
      year: 'numeric'
    })

    console.log(`📅 Processing monthly entries for: ${currentMonthString}`)

    const activeStudents = await studentsCollection.find({ isActive: true }).toArray()
    console.log(`📦 Found ${activeStudents.length} active students`)

    let updatedCount = 0
    
    for (const student of activeStudents) {
      const admissionDate = new Date(student.admissionDate)
      const monthlyFeeStatus = student.monthlyFeeStatus || []

      // ✅ Skip if fee entry already exists for current month
      const alreadyExists = monthlyFeeStatus.some(entry => entry.month === currentMonthString)
      if (alreadyExists) {
        console.log(`⏭️  Entry already exists for ${student.name} - ${currentMonthString}`)
        continue
      }

      // ✅ Check if student was admitted before or during current month
      const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)
      if (admissionDate > currentMonthStart) {
        console.log(`⏭️  Skipping ${student.name} - admitted after current month start`)
        continue
      }

      // ✅ Create due date using admission day in current month
      // Handle edge case where admission date doesn't exist in current month
      const admissionDay = admissionDate.getDate()
      const lastDayOfCurrentMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
      
      // Use the admission day or last day of month if admission day doesn't exist
      const dueDateDay = Math.min(admissionDay, lastDayOfCurrentMonth)
      const dueDate = new Date(today.getFullYear(), today.getMonth(), dueDateDay)

      const newEntry = {
        month: currentMonthString,
        paid: false,
        paidOn: null,
        dueDate: dueDate.toISOString(),
        paymentMode: null,
        amount: null,
        createdAt: new Date(),
        createdBy: 'system-cron'
      }

      await studentsCollection.updateOne(
        { _id: new ObjectId(student._id) },
        {
          $push: { monthlyFeeStatus: newEntry },
          $set: { updatedAt: new Date() }
        }
      )

      updatedCount++
      console.log(`✅ Added unpaid entry for: ${student.name} - Due: ${dueDate.toDateString()}`)
    }

    return res.status(200).json({
      message: `Monthly unpaid entry added for ${updatedCount} student(s) for ${currentMonthString}`,
      processedMonth: currentMonthString,
      studentsUpdated: updatedCount,
      totalActiveStudents: activeStudents.length
    })

  } catch (error) {
    console.error('❌ Schedule monthly entry error:', error)
    return res.status(500).json({ 
      message: 'Internal server error',
      error: error.message 
    })
  }
}