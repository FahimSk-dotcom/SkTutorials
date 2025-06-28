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
      // Mark attendance - Memory Efficient Way
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

        // Process each student's attendance
        for (const [studentId, status] of Object.entries(attendance)) {
          // Validate status
          if (!['present', 'absent', 'leave'].includes(status)) {
            return res.status(400).json({ 
              message: `Invalid attendance status: ${status}` 
            })
          }

          try {
            // Fetch student details
            const studentDetails = await studentsCollection.findOne({
              _id: new ObjectId(studentId)
            })

            if (!studentDetails) {
              console.log(`Student not found: ${studentId}`)
              continue // Skip this student and continue with others
            }

            // Create attendance record for this date
            const attendanceRecord = {
              date: date,
              status: status,
              markedBy: decoded.userId,
              markedAt: new Date()
            }

            // Find existing record for this student and year
            const existingRecord = await attendanceCollection.findOne({
              studentId: new ObjectId(studentId),
              year: year
            })

            if (existingRecord) {
              // EXISTING YEAR RECORD - ADD TO MONTH
              console.log(`Updating existing record for ${studentDetails.name} - ${year}`)
              
              const monthData = { ...existingRecord.months } // Copy existing months
              
              // Initialize month array if it doesn't exist
              if (!monthData[month]) {
                monthData[month] = []
                console.log(`Creating new month ${month} for ${studentDetails.name}`)
              }

              // Check if attendance for this date already exists
              const existingDateIndex = monthData[month].findIndex(entry => entry.date === date)
              
              if (existingDateIndex >= 0) {
                // UPDATE EXISTING DATE
                console.log(`Updating attendance for ${studentDetails.name} on ${date}`)
                monthData[month][existingDateIndex] = attendanceRecord
              } else {
                // ADD NEW DATE TO EXISTING MONTH
                console.log(`Adding new date ${date} for ${studentDetails.name} in ${month}`)
                monthData[month].push(attendanceRecord)
              }

              // Update the existing record
              await attendanceCollection.updateOne(
                { studentId: new ObjectId(studentId), year: year },
                { 
                  $set: { 
                    months: monthData,
                    updatedAt: new Date(),
                    updatedBy: decoded.userId,
                    // Update student details in case they changed
                    studentName: studentDetails.name,
                    studentGrade: studentDetails.grade
                  }
                }
              )

            } else {
              // NEW YEAR RECORD - CREATE NEW DOCUMENT
              console.log(`Creating new year record for ${studentDetails.name} - ${year}`)
              
              const newRecord = {
                studentId: new ObjectId(studentId),
                studentName: studentDetails.name,
                studentGrade: studentDetails.grade,
                year: year,
                months: {
                  [month]: [attendanceRecord] // Create new month with first attendance
                },
                createdAt: new Date(),
                createdBy: decoded.userId
              }

              await attendanceCollection.insertOne(newRecord)
            }

          } catch (studentError) {
            console.error(`Error processing student ${studentId}:`, studentError)
            // Continue with other students
          }
        }

        res.status(200).json({
          message: 'Attendance marked successfully',
          date: date,
          month: month,
          year: year,
          studentsProcessed: Object.keys(attendance).length
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