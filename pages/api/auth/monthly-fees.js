import jwt from 'jsonwebtoken'
import { MongoClient, ObjectId } from 'mongodb'
import nodemailer from 'nodemailer'

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

// Enhanced email configuration with debugging
const createEmailTransporter = () => {

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    throw new Error('Missing SMTP configuration. Please check environment variables.')
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    },
    tls: {
      rejectUnauthorized: false
    },
    debug: true, // Enable debug logs
    logger: true // Enable logger
  })
}

function generateIdentityCard(studentData) {
 const photoUrl = studentData.photoUrl ?? 'https://res.cloudinary.com/dfmcngduw/image/upload/v1753630244/D9179F2C-2DF5-40D9-AB82-5E0702AE36A5_znoivl.png';
  return `
    <div style="width: 400px; margin: 20px auto; font-family: Arial, sans-serif; border-radius: 15px; overflow: hidden; box-shadow: 0 4px 8px rgba(0,0,0,0.2);">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #4A90E2, #357ABD); color: white; padding: 15px; text-align: center; position: relative;">
        <!-- Card hole punch -->
        <div style="background: white; width: 60px; height: 12px; border-radius: 6px; margin: 0 auto 15px;"></div>
        
        <!-- Logo and Title -->
        <div style="display: flex; align-items: center; justify-content: center; gap: 15px;">
          <!-- Graduation cap icon -->
          <div style="width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
              <path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z"/>
            </svg>
          </div>
          <h1 style="margin: 0; font-size: 28px; font-weight: bold; letter-spacing: 1px;">SK TUTORIAL</h1>
        </div>
      </div>

      <!-- Content Area -->
      <div style="background: white; padding: 0;">
        <!-- Student Photo -->
        <div style="text-align: center; padding: 20px 20px 10px;">
          <div style="width: 120px; height: 120px; border-radius: 50%; border: 4px solid #4A90E2; margin: 0 auto; overflow: hidden;">
            <img src="${photoUrl}" alt="Student Photo" style="width: 100%; height: 100%; object-fit: cover;">
          </div>
        </div>

        <!-- Student Name -->
        <div style="text-align: center; padding: 0 20px 20px;">
          <h2 style="margin: 0; color: #4A90E2; font-size: 24px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">
            ${studentData.studentName || studentData.name || 'N/A'}
          </h2>
        </div>

        <!-- Details -->
        <div style="padding: 0 30px 30px; color: #333;">
          <div style="margin-bottom: 12px;">
            <span style="font-weight: bold; color: #333; display: inline-block; width: 140px;">Class :</span>
            <span style="color: #4A90E2; font-weight: 600;">${studentData.class || studentData.grade || 'N/A'}</span>
          </div>
          
          <div style="margin-bottom: 12px;">
            <span style="font-weight: bold; color: #333; display: inline-block; width: 140px;">Birth Date :</span>
            <span style="color: #4A90E2; font-weight: 600;">${studentData.birthdate ? new Date(studentData.birthdate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : 'N/A'}</span>
          </div>
          
          <div style="margin-bottom: 12px;">
            <span style="font-weight: bold; color: #333; display: inline-block; width: 140px;">Admission Date :</span>
            <span style="color: #4A90E2; font-weight: 600;">${studentData.admissiondate || studentData.admissionDate ? new Date(studentData.admissiondate || studentData.admissionDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : 'N/A'}</span>
          </div>
          
          <div style="margin-bottom: 12px;">
            <span style="font-weight: bold; color: #333; display: inline-block; width: 140px;">School Name :</span>
            <span style="color: #4A90E2; font-weight: 600;">${studentData.schoolName || 'N/A'}</span>
          </div>
          
          <div style="margin-bottom: 12px;">
            <span style="font-weight: bold; color: #333; display: inline-block; width: 140px;">Parent Name :</span>
            <span style="color: #4A90E2; font-weight: 600;">${studentData.parentName || 'N/A'}</span>
          </div>
          
          <div style="margin-bottom: 12px;">
            <span style="font-weight: bold; color: #333; display: inline-block; width: 140px;">Contact Number :</span>
            <span style="color: #4A90E2; font-weight: 600;">${studentData.contactNumber || studentData.contact || 'N/A'}</span>
          </div>
          
          <div style="margin-bottom: 0;">
            <span style="font-weight: bold; color: #333; display: inline-block; width: 140px;">Address :</span>
            <span style="color: #4A90E2; font-weight: 600;">${studentData.address || 'N/A'}</span>
          </div>
        </div>
      </div>
    </div>
  `
}

// Enhanced email sending function with better error handling
async function sendFeeConfirmationEmail(studentData, feeDetails, transporter) {
  try {


    if (!studentData.parentEmail) {
      throw new Error('Parent email is missing or empty')
    }

    // Verify transporter configuration
    await transporter.verify()

    const identityCardHtml = generateIdentityCard(studentData)
    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
        <h2 style="color: #2c3e50; text-align: center; margin-bottom: 30px;">
          📧 Fee Payment Confirmation
        </h2>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
          <h3 style="color: #27ae60; margin-top: 0;">✅ Payment Received Successfully</h3>
          <p style="margin: 0; color: #555;">
            Dear <strong>${studentData.parentName || 'Parent'}</strong>,
          </p>
          <p style="color: #555;">
            We have successfully received the fee payment for your child <strong>${studentData.studentName}</strong>.
          </p>
        </div>

        <div style="background-color: #fff; border: 1px solid #eee; padding: 20px; border-radius: 6px;">
          <h4 style="color: #2c3e50; margin-top: 0; border-bottom: 2px solid #3498db; padding-bottom: 10px;">
            Payment Details
          </h4>
          
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #555;">Student Name:</td>
              <td style="padding: 8px 0; color: #333;">${studentData.studentName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #555;">Class:</td>
              <td style="padding: 8px 0; color: #333;">${studentData.class || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #555;">Month:</td>
              <td style="padding: 8px 0; color: #333;">${feeDetails.month}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #555;">Amount:</td>
              <td style="padding: 8px 0; color: #333; font-weight: bold;">₹${feeDetails.amount}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #555;">Payment Mode:</td>
              <td style="padding: 8px 0; color: #333;">${feeDetails.paymentMode}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #555;">Payment Date:</td>
              <td style="padding: 8px 0; color: #333;">${new Date(feeDetails.paidOn).toLocaleDateString('en-IN')}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #555;">Contact Number:</td>
              <td style="padding: 8px 0; color: #333;">${studentData.contactNumber}</td>
            </tr>
          </table>
        </div>

        <div style="margin-top: 30px; padding: 15px; background-color: #e8f6fd; border-left: 4px solid #3498db; border-radius: 4px;">
          <p style="margin: 0; color: #555; font-size: 14px;">
            <strong>Note:</strong> Please keep this email as proof of payment. If you have any queries regarding this payment, 
            please contact us with the above payment details.
          </p>
        </div>

        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
          <p style="color: #777; font-size: 14px; margin: 0;">
            Thank you for choosing our institution.
          </p>
          <p style="color: #777; font-size: 12px; margin: 10px 0 0 0;">
            This is an automated email. Please do not reply to this email.
          </p>
        </div>
      </div>
    `

    const mailOptions = {
      from: {
        name: 'Sk-Tutorial Fee Management System',
        address: process.env.SMTP_USER
      },
      to: studentData.parentEmail,
      subject: `Fee Payment Confirmation - ${studentData.studentName} - ${feeDetails.month}`,
      html: identityCardHtml + emailContent
    }


    const result = await transporter.sendMail(mailOptions)

    return { success: true, messageId: result.messageId, response: result.response }

  } catch (error) {
    console.error('❌ Error sending email:', error)
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      command: error.command,
      stack: error.stack
    })
    return { success: false, error: error.message, details: error }
  }
}

// Enhanced function to get student data by contact number with format normalization
async function getStudentDataByContact(contactNumber) {
  try {

    const database = await connectDB()
    const studentsDataCollection = database.collection('studentsData')

    // Function to normalize contact number (remove spaces, special chars except +)
    const normalizeContact = (contact) => {
      if (!contact) return null
      return String(contact).replace(/\s+/g, '').replace(/[^\d+]/g, '')
    }

    const normalizedSearchContact = normalizeContact(contactNumber)

    // Try exact match first
    let studentData = await studentsDataCollection.findOne({
      contactNumber: contactNumber
    })

    // If not found, try string conversion
    if (!studentData) {
      studentData = await studentsDataCollection.findOne({
        contactNumber: String(contactNumber)
      })
    }

    // If still not found, try number conversion
    if (!studentData && !isNaN(contactNumber)) {
      studentData = await studentsDataCollection.findOne({
        contactNumber: parseInt(contactNumber)
      })
    }

    // If still not found, try normalized matching
    if (!studentData && normalizedSearchContact) {

      // Get all contacts and normalize them for comparison
      const allStudents = await studentsDataCollection.find({}).toArray()

      for (const student of allStudents) {
        const normalizedDbContact = normalizeContact(student.contactNumber)

        if (normalizedDbContact === normalizedSearchContact) {
          studentData = student
          break
        }
      }
    }

    // If still not found, try partial matching (last 10 digits)
    if (!studentData && normalizedSearchContact && normalizedSearchContact.length >= 10) {
      const lastTenDigits = normalizedSearchContact.slice(-10)

      const allStudents = await studentsDataCollection.find({}).toArray()

      for (const student of allStudents) {
        const normalizedDbContact = normalizeContact(student.contactNumber)
        if (normalizedDbContact && normalizedDbContact.slice(-10) === lastTenDigits) {
          studentData = student
          break
        }
      }
    }

    return studentData
  } catch (error) {
    console.error('❌ Error fetching student data:', error)
    return null
  }
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
      // Fetch all students with their fee status (unchanged)
      try {
        const studentsList = await students.find({
          isActive: true
        }).toArray()

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
      // Update student's monthly fee payment with enhanced email handling
      try {

        const { studentId, monthlyFeeStatus, lastFeePaidDate, contactNumber } = req.body

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

        // Email sending logic with better error handling
        const contactToUse = contactNumber || student.contact

        if (contactToUse) {

          // Check if any fee was marked as paid
          const paidFees = monthlyFeeStatus.filter(fee => fee.paid === true)

          if (paidFees.length > 0) {
            try {
              // Get student data from studentsData collection
              const studentData = await getStudentDataByContact(contactToUse)

              if (studentData && studentData.parentEmail) {
                const transporter = createEmailTransporter()

                // Send email for each paid fee
                for (const paidFee of paidFees) {
                  const emailResult = await sendFeeConfirmationEmail(studentData, paidFee, transporter)

                  if (emailResult.success) {
                  } else {
                    console.error(`❌ Failed to send email for ${studentData.studentName} - ${paidFee.month}:`, emailResult.error)
                  }
                }
              }
            } catch (emailError) {
              console.error('❌ Email process error:', emailError)
            }
          }
        }

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
        console.error('❌ Error updating payment:', error)
        res.status(500).json({
          message: 'Error updating payment record',
          error: error.message
        })
      }

    } else if (req.method === 'POST') {
      // Add a new fee payment record with enhanced email handling
      try {

        const { studentId, month, paymentMode, amount, paidOn, contactNumber } = req.body

        // Validate input
        if (!studentId || !month || !paymentMode || !amount) {
          return res.status(400).json({
            message: 'Student ID, month, payment mode, and amount are required'
          })
        }

        if (!contactNumber) {
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
          existingFeeStatus[existingIndex] = newFeeEntry
        } else {
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
        console.error('❌ Error recording payment:', error)
        res.status(500).json({
          message: 'Error recording payment',
          error: error.message
        })
      }

    } else if (req.method === 'DELETE') {
      // Delete a fee payment record (unchanged from original)
      try {
        const { studentId, month } = req.body

        if (!studentId || !month) {
          return res.status(400).json({
            message: 'Student ID and month are required'
          })
        }

        if (!ObjectId.isValid(studentId)) {
          return res.status(400).json({
            message: 'Invalid student ID format'
          })
        }

        const student = await students.findOne({
          _id: new ObjectId(studentId),
          isActive: true
        })

        if (!student) {
          return res.status(404).json({
            message: 'Student not found'
          })
        }

        const existingFeeStatus = student.monthlyFeeStatus || []
        const updatedFeeStatus = existingFeeStatus.filter(status => status.month !== month)

        if (existingFeeStatus.length === updatedFeeStatus.length) {
          return res.status(404).json({
            message: 'Payment record for specified month not found'
          })
        }

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

    console.error('❌ Monthly fees API error:', error)
    res.status(500).json({
      message: 'Internal server error',
      error: error.message
    })
  }
}