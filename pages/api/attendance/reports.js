// api/attendance/reports.js
import { MongoClient, ObjectId } from 'mongodb'
import jwt from 'jsonwebtoken'

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

// Helper function to verify JWT token
function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET)
  } catch (error) {
    return null
  }
}

// Helper function to get month name from month number
function getMonthName(monthNumber) {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]
  return months[monthNumber - 1]
}

// Helper function to validate and format attendance data
function validateAndFormatAttendanceData(records) {
  return records.map(record => ({
    _id: record._id,
    studentId: record.studentId,
    studentName: record.studentName,
    studentGrade: record.studentGrade,
    year: record.year,
    months: record.months || {},
    createdAt: record.createdAt,
    createdBy: record.createdBy,
    updatedAt: record.updatedAt,
    updatedBy: record.updatedBy
  }))
}

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      message: 'Method not allowed' 
    })
  }

  try {
    // Verify authentication
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication token required' 
      })
    }

    const token = authHeader.substring(7)
    const decoded = verifyToken(token)
    
    if (!decoded) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid or expired token' 
      })
    }

    // Connect to database
    const database = await connectDB()
    const attendanceCollection = database.collection('students-attendance')

    // Extract query parameters
    const { year, month, grade, studentId } = req.body

    // Validate required parameters
    if (!year || !month) {
      return res.status(400).json({
        success: false,
        message: 'Year and month are required parameters'
      })
    }

    // Validate year and month ranges
    const currentYear = new Date().getFullYear()
    if (year < 2020 || year > currentYear + 1) {
      return res.status(400).json({
        success: false,
        message: 'Invalid year. Must be between 2020 and ' + (currentYear + 1)
      })
    }

    if (month < 1 || month > 12) {
      return res.status(400).json({
        success: false,
        message: 'Invalid month. Must be between 1 and 12'
      })
    }

    // Build query filter
    const filter = {
      year: parseInt(year)
    }

    // Add grade filter if specified
    if (grade && grade !== 'all') {
      filter.studentGrade = grade
    }

    // Add student ID filter if specified
    if (studentId) {
      try {
        filter.studentId = new ObjectId(studentId)
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: 'Invalid student ID format'
        })
      }
    }

    // Add month filter to ensure the month exists in the months object
    const monthName = getMonthName(month)
    filter[`months.${monthName}`] = { $exists: true }

    console.log('Query filter:', filter)

    // Fetch attendance records
    const attendanceRecords = await attendanceCollection
      .find(filter)
      .sort({ studentGrade: 1, studentName: 1 })
      .toArray()

    console.log(`Found ${attendanceRecords.length} attendance records`)

    // Validate and format the data
    const formattedData = validateAndFormatAttendanceData(attendanceRecords)

    // Calculate summary statistics
    const summary = {
      totalStudents: formattedData.length,
      monthName: monthName,
      year: year,
      grades: [...new Set(formattedData.map(record => record.studentGrade))].sort(),
      dateRange: {
        start: null,
        end: null
      }
    }

    // Calculate date range from attendance data
    let earliestDate = null
    let latestDate = null

    formattedData.forEach(record => {
      const monthData = record.months[monthName] || []
      monthData.forEach(day => {
        const date = new Date(day.date)
        if (!earliestDate || date < earliestDate) {
          earliestDate = date
        }
        if (!latestDate || date > latestDate) {
          latestDate = date
        }
      })
    })

    if (earliestDate && latestDate) {
      summary.dateRange = {
        start: earliestDate.toISOString().split('T')[0],
        end: latestDate.toISOString().split('T')[0]
      }
    }

    // Calculate attendance statistics
    let totalPresentDays = 0
    let totalPossibleDays = 0
    let studentsWithData = 0

    formattedData.forEach(record => {
      const monthData = record.months[monthName] || []
      if (monthData.length > 0) {
        studentsWithData++
        const presentDays = monthData.filter(day => day.status === 'present').length
        totalPresentDays += presentDays
        totalPossibleDays += monthData.length
      }
    })

    summary.overallAttendanceRate = totalPossibleDays > 0 
      ? Math.round((totalPresentDays / totalPossibleDays) * 100) 
      : 0
    summary.studentsWithData = studentsWithData

    // Return successful response
    res.status(200).json({
      success: true,
      message: 'Attendance data retrieved successfully',
      data: formattedData,
      summary: summary,
      meta: {
        requestedYear: year,
        requestedMonth: month,
        requestedGrade: grade,
        requestedStudentId: studentId,
        queryFilter: filter,
        recordCount: formattedData.length
      }
    })

  } catch (error) {
    console.error('Error fetching attendance data:', error)
    
    // Return appropriate error response
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching attendance data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
}

// Additional helper function for getting attendance statistics by grade
export async function getAttendanceStatsByGrade(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const database = await connectDB()
    const attendanceCollection = database.collection('students-attendance')

    const { year, month } = req.query
    
    if (!year || !month) {
      return res.status(400).json({
        success: false,
        message: 'Year and month are required'
      })
    }

    const monthName = getMonthName(parseInt(month))
    
    const pipeline = [
      {
        $match: {
          year: parseInt(year),
          [`months.${monthName}`]: { $exists: true, $ne: [] }
        }
      },
      {
        $group: {
          _id: '$studentGrade',
          totalStudents: { $sum: 1 },
          students: { $push: '$$ROOT' }
        }
      },
      {
        $sort: { '_id': 1 }
      }
    ]

    const gradeStats = await attendanceCollection.aggregate(pipeline).toArray()

    res.status(200).json({
      success: true,
      data: gradeStats,
      month: monthName,
      year: parseInt(year)
    })

  } catch (error) {
    console.error('Error fetching grade statistics:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
}