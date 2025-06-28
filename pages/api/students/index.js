// api/students/index.js
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

// Middleware to verify JWT token
function verifyToken(req) {
  const token = req.headers.authorization?.split(' ')[1]
  
  if (!token) {
    throw new Error('No token provided')
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    return decoded
  } catch (error) {
    throw new Error('Invalid token')
  }
}

// Validation function for student data
function validateStudentData(data) {
  const { name, grade, parentName, contact, admissionDate } = data
  
  if (!name || !grade || !parentName || !contact || !admissionDate) {
    throw new Error('All fields are required: name, grade, parentName, contact, admissionDate')
  }

  if (name.trim().length < 2) {
    throw new Error('Student name must be at least 2 characters long')
  }

  if (parentName.trim().length < 2) {
    throw new Error('Parent name must be at least 2 characters long')
  }

  // Validate phone number format (Indian mobile number)
  const phoneRegex = /^\+91\s?[6-9]\d{9}$/
  if (!phoneRegex.test(contact.replace(/\s/g, ''))) {
    throw new Error('Invalid contact number format. Use +91 followed by 10 digits')
  }

  const validGrades = ['Nursery', 'LKG', 'UKG', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th']
  if (!validGrades.includes(grade)) {
    throw new Error('Invalid grade selected')
  }

  // Validate admission date
  const admission = new Date(admissionDate)
  if (isNaN(admission.getTime())) {
    throw new Error('Invalid admission date format')
  }

  // Check if admission date is not in the future
  const today = new Date()
  today.setHours(23, 59, 59, 999) // Set to end of today
  if (admission > today) {
    throw new Error('Admission date cannot be in the future')
  }

  return {
    name: name.trim(),
    grade: grade.trim(),
    parentName: parentName.trim(),
    contact: contact.trim(),
    admissionDate: admission
  }
}

export default async function handler(req, res) {
  try {
    // Verify authentication for all requests
    const user = verifyToken(req)
    
    // Only admin and teacher roles can manage students
    if (!['admin', 'teacher'].includes(user.role)) {
      return res.status(403).json({ 
        message: 'Access denied. Insufficient permissions.' 
      })
    }

    const database = await connectDB()
    const students = database.collection('students')

    switch (req.method) {
      case 'GET':
        return await handleGet(req, res, students)
      case 'POST':
        return await handlePost(req, res, students, user)
      case 'PUT':
        return await handlePut(req, res, students, user)
      case 'DELETE':
        return await handleDelete(req, res, students, user)
      default:
        return res.status(405).json({ message: 'Method not allowed' })
    }
  } catch (error) {
    console.error('API Error:', error)
    
    if (error.message === 'No token provided' || error.message === 'Invalid token') {
      return res.status(401).json({ message: 'Unauthorized' })
    }
    
    return res.status(500).json({ 
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
}

// GET - Fetch all students with optional filtering
async function handleGet(req, res, students) {
  try {
    const { search, grade, page = 1, limit = 50 } = req.query
    
    let query = { isActive: { $ne: false } } // Exclude soft-deleted students
    
    // Add search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { parentName: { $regex: search, $options: 'i' } },
        { contact: { $regex: search, $options: 'i' } }
      ]
    }
    
    // Add grade filter
    if (grade && grade !== 'All') {
      query.grade = grade
    }
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit)
    
    // Fetch students with pagination
    const studentList = await students
      .find(query)
      .sort({ createdAt: -1, name: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray()
    
    // Get total count for pagination
    const totalCount = await students.countDocuments(query)
    
    // Format response
    const formattedStudents = studentList.map(student => ({
      id: student._id.toString(),
      name: student.name,
      grade: student.grade,
      parentName: student.parentName,
      contact: student.contact,
      admissionDate: student.admissionDate,
      lastFeePaidDate: student.lastFeePaidDate,
      monthlyFeeStatus: student.monthlyFeeStatus,
      createdAt: student.createdAt,
      updatedAt: student.updatedAt
    }))
    
    return res.status(200).json({
      message: 'Students fetched successfully',
      data: {
        students: formattedStudents,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalCount,
          hasNextPage: skip + formattedStudents.length < totalCount,
          hasPrevPage: parseInt(page) > 1
        }
      }
    })
  } catch (error) {
    throw new Error(`Failed to fetch students: ${error.message}`)
  }
}

// POST - Create new student with admission and fee tracking
async function handlePost(req, res, students, user) {
  try {
    const validatedData = validateStudentData(req.body)
    
    // Check if student with same name and grade already exists
    const existingStudent = await students.findOne({
      name: validatedData.name,
      grade: validatedData.grade,
      isActive: { $ne: false }
    })
    
    if (existingStudent) {
      return res.status(409).json({
        message: 'A student with this name already exists in the same grade'
      })
    }
    
    // Generate the month string from admission date
    const month = validatedData.admissionDate.toLocaleString('default', { 
      month: 'long', 
      year: 'numeric' 
    })
    
    // Create new student document with fee tracking
    const newStudent = {
      name: validatedData.name,
      grade: validatedData.grade,
      parentName: validatedData.parentName,
      contact: validatedData.contact,
      admissionDate: validatedData.admissionDate,
      lastFeePaidDate: validatedData.admissionDate,
      monthlyFeeStatus: [
        {
          month: month,
          paid: true,
          paidOn: validatedData.admissionDate
        }
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: user.userId,
      isActive: true
    }
    
    const result = await students.insertOne(newStudent)
    
    // Return created student
    const createdStudent = {
      id: result.insertedId.toString(),
      name: newStudent.name,
      grade: newStudent.grade,
      parentName: newStudent.parentName,
      contact: newStudent.contact,
      admissionDate: newStudent.admissionDate,
      lastFeePaidDate: newStudent.lastFeePaidDate,
      monthlyFeeStatus: newStudent.monthlyFeeStatus,
      createdAt: newStudent.createdAt,
      updatedAt: newStudent.updatedAt
    }
    
    return res.status(201).json({
      message: 'Student created successfully',
      data: createdStudent
    })
  } catch (error) {
    if (error.message.includes('required') || error.message.includes('Invalid')) {
      return res.status(400).json({ message: error.message })
    }
    throw new Error(`Failed to create student: ${error.message}`)
  }
}

// PUT - Update existing student
async function handlePut(req, res, students, user) {
  try {
    const { id } = req.query
    
    if (!id) {
      return res.status(400).json({ message: 'Student ID is required' })
    }
    
    // Validate ObjectId
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid student ID format' })
    }
    
    const validatedData = validateStudentData(req.body)
    
    // Check if student exists
    const existingStudent = await students.findOne({
      _id: new ObjectId(id),
      isActive: { $ne: false }
    })
    
    if (!existingStudent) {
      return res.status(404).json({ message: 'Student not found' })
    }
    
    // Check if another student with same name and grade exists (excluding current student)
    const duplicateStudent = await students.findOne({
      _id: { $ne: new ObjectId(id) },
      name: validatedData.name,
      grade: validatedData.grade,
      isActive: { $ne: false }
    })
    
    if (duplicateStudent) {
      return res.status(409).json({
        message: 'Another student with this name already exists in the same grade'
      })
    }
    
    // Prepare base update data
    const updateData = {
      name: validatedData.name,
      grade: validatedData.grade,
      parentName: validatedData.parentName,
      contact: validatedData.contact,
      admissionDate: validatedData.admissionDate,
      updatedAt: new Date(),
      updatedBy: user.userId
    }
    
    // Check if admission date has changed - if so, update fee-related fields
    const oldAdmissionDate = existingStudent.admissionDate
    const newAdmissionDate = validatedData.admissionDate
    const admissionDateChanged = oldAdmissionDate.getTime() !== newAdmissionDate.getTime()
    
    if (admissionDateChanged) {
      // Update lastFeePaidDate if it was originally the same as old admission date
      const lastFeePaidDate = existingStudent.lastFeePaidDate
      const wasLastFeePaidSameAsAdmission = lastFeePaidDate && 
        lastFeePaidDate.getTime() === oldAdmissionDate.getTime()
      
      if (wasLastFeePaidSameAsAdmission) {
        updateData.lastFeePaidDate = newAdmissionDate
      }
      
      // Update the first entry in monthlyFeeStatus if it exists
      const monthlyFeeStatus = existingStudent.monthlyFeeStatus || []
      if (monthlyFeeStatus.length > 0) {
        // Generate new month string from new admission date
        const newMonth = newAdmissionDate.toLocaleString('default', { 
          month: 'long', 
          year: 'numeric' 
        })
        
        // Update the first entry if it was paid on the old admission date
        const firstEntry = monthlyFeeStatus[0]
        const wasFirstEntryOnAdmissionDate = firstEntry.paidOn && 
          firstEntry.paidOn.getTime() === oldAdmissionDate.getTime()
        
        if (wasFirstEntryOnAdmissionDate) {
          // Create updated monthlyFeeStatus array
          const updatedMonthlyFeeStatus = [...monthlyFeeStatus]
          updatedMonthlyFeeStatus[0] = {
            ...firstEntry,
            month: newMonth,
            paidOn: newAdmissionDate
          }
          updateData.monthlyFeeStatus = updatedMonthlyFeeStatus
        }
      }
    }
    
    const result = await students.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    )
    
    if (result.modifiedCount === 0) {
      return res.status(404).json({ message: 'Student not found or no changes made' })
    }
    
    // Fetch the updated student to return complete data
    const updatedStudent = await students.findOne({ _id: new ObjectId(id) })
    
    // Return updated student
    const responseData = {
      id: id,
      name: updatedStudent.name,
      grade: updatedStudent.grade,
      parentName: updatedStudent.parentName,
      contact: updatedStudent.contact,
      admissionDate: updatedStudent.admissionDate,
      lastFeePaidDate: updatedStudent.lastFeePaidDate,
      monthlyFeeStatus: updatedStudent.monthlyFeeStatus,
      updatedAt: updatedStudent.updatedAt
    }
    
    return res.status(200).json({
      message: 'Student updated successfully',
      data: responseData
    })
  } catch (error) {
    if (error.message.includes('required') || error.message.includes('Invalid')) {
      return res.status(400).json({ message: error.message })
    }
    throw new Error(`Failed to update student: ${error.message}`)
  }
}

// DELETE - Soft delete student
async function handleDelete(req, res, students, user) {
  try {
    const { id } = req.query
    
    if (!id) {
      return res.status(400).json({ message: 'Student ID is required' })
    }
    
    // Validate ObjectId
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid student ID format' })
    }
    
    // Check if student exists
    const existingStudent = await students.findOne({
      _id: new ObjectId(id),
      isActive: { $ne: false }
    })
    
    if (!existingStudent) {
      return res.status(404).json({ message: 'Student not found' })
    }
    
    // Soft delete - mark as inactive instead of permanent deletion
    const result = await students.updateOne(
      { _id: new ObjectId(id) },
      { 
        $set: { 
          isActive: false,
          deletedAt: new Date(),
          deletedBy: user.userId
        }
      }
    )
    
    if (result.modifiedCount === 0) {
      return res.status(404).json({ message: 'Student not found' })
    }
    
    return res.status(200).json({
      message: 'Student deleted successfully',
      data: { id }
    })
  } catch (error) {
    throw new Error(`Failed to delete student: ${error.message}`)
  }
}