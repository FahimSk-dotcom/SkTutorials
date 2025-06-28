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

export default async function handler(req, res) {
  try {
    // Verify authentication
    const decoded = verifyToken(req)
    
    const database = await connectDB()
    const students = database.collection('students')

    if (req.method === 'GET') {
      // Fetch all students with their fee status
      try {
        const studentsList = await students.find({
          isActive: true
        }).toArray()

        // Transform data to match frontend expectations
        const transformedStudents = studentsList.map(student => ({
          _id: student._id.toString(),
          name: student.name,
          grade: student.grade,
          parentName: student.parentName,
          contact: student.contact,
          admissionDate: student.admissionDate,
          monthlyFeeStatus: student.monthlyFeeStatus || []
        }))

        res.status(200).json(transformedStudents)

      } catch (error) {
        console.error('Error fetching students:', error)
        res.status(500).json({ 
          message: 'Error fetching students data' 
        })
      }

    } else if (req.method === 'PUT') {
      // Update student's monthly fee payment
      try {
        const { studentId, monthlyFeeStatus, lastFeePaidDate } = req.body

        // Validate input
        if (!studentId || !monthlyFeeStatus) {
          return res.status(400).json({ 
            message: 'Student ID and monthly fee status are required' 
          })
        }

        // Validate ObjectId
        if (!ObjectId.isValid(studentId)) {
          return res.status(400).json({ 
            message: 'Invalid student ID format' 
          })
        }

        // Find the student first
        const student = await students.findOne({ 
          _id: new ObjectId(studentId),
          isActive: true 
        })

        if (!student) {
          return res.status(404).json({ 
            message: 'Student not found' 
          })
        }

        // Update the student's fee status
        const updateResult = await students.updateOne(
          { _id: new ObjectId(studentId) },
          { 
            $set: { 
              monthlyFeeStatus: monthlyFeeStatus,
              lastFeePaidDate: lastFeePaidDate || new Date(),
              updatedAt: new Date(),
              updatedBy: decoded.userId
            } 
          }
        )

        if (updateResult.matchedCount === 0) {
          return res.status(404).json({ 
            message: 'Student not found' 
          })
        }

        if (updateResult.modifiedCount === 0) {
          return res.status(400).json({ 
            message: 'No changes made to student record' 
          })
        }

        // Get the updated student record
        const updatedStudent = await students.findOne({ 
          _id: new ObjectId(studentId) 
        })

        res.status(200).json({
          message: 'Payment updated successfully',
          student: {
            _id: updatedStudent._id.toString(),
            name: updatedStudent.name,
            grade: updatedStudent.grade,
            parentName: updatedStudent.parentName,
            contact: updatedStudent.contact,
            admissionDate: updatedStudent.admissionDate,
            monthlyFeeStatus: updatedStudent.monthlyFeeStatus,
            lastFeePaidDate: updatedStudent.lastFeePaidDate
          }
        })

      } catch (error) {
        console.error('Error updating payment:', error)
        res.status(500).json({ 
          message: 'Error updating payment record' 
        })
      }

    } else if (req.method === 'POST') {
      // Add a new fee payment record (alternative to PUT)
      try {
        const { studentId, month, paymentMode, amount, paidOn } = req.body

        // Validate input
        if (!studentId || !month || !paymentMode || !amount) {
          return res.status(400).json({ 
            message: 'Student ID, month, payment mode, and amount are required' 
          })
        }

        // Validate ObjectId
        if (!ObjectId.isValid(studentId)) {
          return res.status(400).json({ 
            message: 'Invalid student ID format' 
          })
        }

        // Find the student
        const student = await students.findOne({ 
          _id: new ObjectId(studentId),
          isActive: true 
        })

        if (!student) {
          return res.status(404).json({ 
            message: 'Student not found' 
          })
        }

        // Calculate due date based on admission date
        const admissionDate = new Date(student.admissionDate)
        const today = new Date()
        const dueDate = new Date(today.getFullYear(), today.getMonth(), admissionDate.getDate())

        // Create new fee entry
        const newFeeEntry = {
          month: month,
          paid: true,
          dueDate: dueDate.toISOString(),
          paidOn: paidOn || new Date().toISOString(),
          paymentMode: paymentMode,
          amount: parseFloat(amount),
          recordedBy: decoded.userId,
          recordedAt: new Date()
        }

        // Get existing fee status
        const existingFeeStatus = student.monthlyFeeStatus || []
        
        // Check if payment for this month already exists
        const existingIndex = existingFeeStatus.findIndex(status => status.month === month)
        
        if (existingIndex >= 0) {
          // Update existing entry
          existingFeeStatus[existingIndex] = newFeeEntry
        } else {
          // Add new entry
          existingFeeStatus.push(newFeeEntry)
        }

        // Update the student record
        const updateResult = await students.updateOne(
          { _id: new ObjectId(studentId) },
          { 
            $set: { 
              monthlyFeeStatus: existingFeeStatus,
              lastFeePaidDate: new Date(),
              updatedAt: new Date(),
              updatedBy: decoded.userId
            } 
          }
        )

        if (updateResult.modifiedCount === 0) {
          return res.status(400).json({ 
            message: 'Failed to update payment record' 
          })
        }

        res.status(201).json({
          message: 'Payment recorded successfully',
          feeEntry: newFeeEntry
        })

      } catch (error) {
        console.error('Error recording payment:', error)
        res.status(500).json({ 
          message: 'Error recording payment' 
        })
      }

    } else if (req.method === 'DELETE') {
      // Delete a fee payment record
      try {
        const { studentId, month } = req.body

        // Validate input
        if (!studentId || !month) {
          return res.status(400).json({ 
            message: 'Student ID and month are required' 
          })
        }

        // Validate ObjectId
        if (!ObjectId.isValid(studentId)) {
          return res.status(400).json({ 
            message: 'Invalid student ID format' 
          })
        }

        // Find the student
        const student = await students.findOne({ 
          _id: new ObjectId(studentId),
          isActive: true 
        })

        if (!student) {
          return res.status(404).json({ 
            message: 'Student not found' 
          })
        }

        // Get existing fee status and remove the specified month
        const existingFeeStatus = student.monthlyFeeStatus || []
        const updatedFeeStatus = existingFeeStatus.filter(status => status.month !== month)

        if (existingFeeStatus.length === updatedFeeStatus.length) {
          return res.status(404).json({ 
            message: 'Payment record for specified month not found' 
          })
        }

        // Update the student record
        const updateResult = await students.updateOne(
          { _id: new ObjectId(studentId) },
          { 
            $set: { 
              monthlyFeeStatus: updatedFeeStatus,
              updatedAt: new Date(),
              updatedBy: decoded.userId
            } 
          }
        )

        if (updateResult.modifiedCount === 0) {
          return res.status(400).json({ 
            message: 'Failed to delete payment record' 
          })
        }

        res.status(200).json({
          message: 'Payment record deleted successfully'
        })

      } catch (error) {
        console.error('Error deleting payment:', error)
        res.status(500).json({ 
          message: 'Error deleting payment record' 
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
    
    console.error('Monthly fees API error:', error)
    res.status(500).json({ 
      message: 'Internal server error' 
    })
  }
}