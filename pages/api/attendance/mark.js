import jwt from 'jsonwebtoken'
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

// Middleware to verify JWT token
function verifyToken(req) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('No token provided')
  }

  const token = authHeader.substring(7)
  try {
    return jwt.verify(token, process.env.JWT_SECRET)
  } catch (error) {
    throw new Error('Invalid token')
  }
}

// Helper function to get month name from date
function getMonthFromDate(dateString) {
  const date = new Date(dateString)
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]
  return months[date.getMonth()]
}

export default async function handler(req, res) {
  try {
    // Verify authentication
    const decoded = verifyToken(req)
    
    const database = await connectDB()

    if (req.method === 'GET') {
      // Fetch all students for attendance marking
      try {
        const studentsCollection = database.collection('students')
        const studentsList = await studentsCollection.find({
          isActive: true
        }).sort({ grade: 1, name: 1 }).toArray()

        res.status(200).json(studentsList)

      } catch (error) {
        console.error('Error fetching students:', error)
        res.status(500).json({ 
          message: 'Error fetching students data' 
        })
      }

    } else if (req.method === 'POST') {
      // Mark attendance - Ultra-fast bulk operations
      try {
        const { date, attendance } = req.body

        // Validate input
        if (!date || !attendance || typeof attendance !== 'object') {
          return res.status(400).json({ 
            message: 'Date and attendance data are required' 
          })
        }

        const attendanceCollection = database.collection('students-attendance')
        const studentsCollection = database.collection('students')
        const month = getMonthFromDate(date)
        const year = new Date(date).getFullYear()

        console.log(`Marking attendance for ${month} ${year}`)

        // Get all student IDs to process
        const studentIds = Object.keys(attendance)
        
        // Validate all attendance statuses upfront
        const invalidStatuses = Object.values(attendance).filter(status => 
          !['present', 'absent', 'late'].includes(status)
        )
        if (invalidStatuses.length > 0) {
          return res.status(400).json({ 
            message: `Invalid attendance status found: ${invalidStatuses.join(', ')}` 
          })
        }

        // BULK FETCH: Get all students in one query
        const objectIds = studentIds.map(id => new ObjectId(id))
        const studentsMap = new Map()
        
        const students = await studentsCollection.find({
          _id: { $in: objectIds }
        }).toArray()
        
        students.forEach(student => {
          studentsMap.set(student._id.toString(), student)
        })

        // BULK FETCH: Get all existing attendance records for this year
        const existingRecords = await attendanceCollection.find({
          studentId: { $in: objectIds },
          year: year
        }).toArray()

        const existingRecordsMap = new Map()
        existingRecords.forEach(record => {
          existingRecordsMap.set(record.studentId.toString(), record)
        })

        // Prepare bulk operations
        const bulkOps = []
        const newRecords = []
        
        const attendanceRecord = {
          date: date,
          markedBy: decoded.userId,
          markedAt: new Date()
        }

        // Process each student (in memory - no DB calls)
        for (const [studentId, status] of Object.entries(attendance)) {
          const studentDetails = studentsMap.get(studentId)
          
          if (!studentDetails) {
            console.log(`Student not found: ${studentId}`)
            continue
          }

          const recordWithStatus = {
            ...attendanceRecord,
            status: status
          }

          const existingRecord = existingRecordsMap.get(studentId)

          if (existingRecord) {
            // EXISTING YEAR RECORD - UPDATE
            const monthData = { ...existingRecord.months }
            
            if (!monthData[month]) {
              monthData[month] = []
            }

            // Check if attendance for this date already exists
            const existingDateIndex = monthData[month].findIndex(entry => entry.date === date)
            
            if (existingDateIndex >= 0) {
              // UPDATE EXISTING DATE
              monthData[month][existingDateIndex] = recordWithStatus
            } else {
              // ADD NEW DATE TO EXISTING MONTH
              monthData[month].push(recordWithStatus)
            }

            // Add to bulk operations
            bulkOps.push({
              updateOne: {
                filter: { studentId: new ObjectId(studentId), year: year },
                update: { 
                  $set: { 
                    months: monthData,
                    updatedAt: new Date(),
                    updatedBy: decoded.userId,
                    studentName: studentDetails.name,
                    studentGrade: studentDetails.grade
                  }
                }
              }
            })

          } else {
            // NEW YEAR RECORD - CREATE NEW DOCUMENT
            const newRecord = {
              studentId: new ObjectId(studentId),
              studentName: studentDetails.name,
              studentGrade: studentDetails.grade,
              year: year,
              months: {
                [month]: [recordWithStatus]
              },
              createdAt: new Date(),
              createdBy: decoded.userId
            }

            newRecords.push(newRecord)
          }
        }

        // Execute all database operations in parallel
        const dbPromises = []
        
        // Bulk update existing records
        if (bulkOps.length > 0) {
          dbPromises.push(
            attendanceCollection.bulkWrite(bulkOps, { ordered: false })
          )
        }
        
        // Bulk insert new records
        if (newRecords.length > 0) {
          dbPromises.push(
            attendanceCollection.insertMany(newRecords, { ordered: false })
          )
        }

        // Wait for all operations to complete
        await Promise.all(dbPromises)

        res.status(200).json({
          message: 'Attendance marked successfully',
          date: date,
          month: month,
          year: year,
          studentsProcessed: Object.keys(attendance).length,
          updated: bulkOps.length,
          created: newRecords.length
        })

      } catch (error) {
        console.error('Error marking attendance:', error)
        res.status(500).json({ 
          message: 'Error marking attendance',
          error: error.message 
        })
      }

    } else {
      res.status(405).json({ 
        message: 'Method not allowed' 
      })
    }

  } catch (error) {
    if (error.message === 'No token provided' || error.message === 'Invalid token') {
      return res.status(401).json({ 
        message: 'Unauthorized access' 
      })
    }
    
    console.error('Attendance API error:', error)
    res.status(500).json({ 
      message: 'Internal server error' 
    })
  }
}