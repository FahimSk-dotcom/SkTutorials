import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '../../components/Layout'
import Toast from '../../components/Toast'
import { getUserFromToken, getAuthToken } from '../../utils/auth'
import { format } from 'date-fns'
import {
  ClipboardDocumentListIcon,
  CalendarIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline'

export default function MarkAttendance({ darkMode, toggleDarkMode }) {
  const [user, setUser] = useState(null)
  const [attendanceData, setAttendanceData] = useState({})
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)
  const [studentsByGrade, setStudentsByGrade] = useState({})
  const [studentsLoading, setStudentsLoading] = useState(true)
  const router = useRouter()

  const gradeOrder = ['Nursery', 'LKG', 'UKG', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th']

  useEffect(() => {
    const token = getAuthToken()
    if (!token) {
      router.push('/login')
      return
    }
    
    const userData = getUserFromToken(token)
    if (userData && userData.role === 'teacher') {
      setUser(userData)
      loadStudents()
    } else {
      router.push('/dashboard')
    }
  }, [router])

  const loadStudents = async () => {
    try {
      const token = getAuthToken()
      const response = await fetch('/api/attendance/mark', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      })

      if (response.ok) {
        const students = await response.json()
        
        // Group students by grade
        const grouped = {}
        students.forEach(student => {
          const grade = student.grade
          if (!grouped[grade]) {
            grouped[grade] = []
          }
          grouped[grade].push({
            id: student._id,
            name: student.name,
            grade: student.grade
          })
        })
        
        setStudentsByGrade(grouped)
        initializeAttendance(grouped)
      } else {
        setToast({ message: 'Failed to load students', type: 'error' })
      }
    } catch (error) {
      setToast({ message: 'Error loading students', type: 'error' })
    } finally {
      setStudentsLoading(false)
    }
  }

  const handleAttendanceChange = (studentId, status) => {
    setAttendanceData(prev => ({
      ...prev,
      [studentId]: status
    }))
  }

  const initializeAttendance = (students = studentsByGrade) => {
    const initialData = {}
    Object.values(students).flat().forEach(student => {
      initialData[student.id] = 'present'
    })
    setAttendanceData(initialData)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const token = getAuthToken()
      const response = await fetch('/api/attendance/mark', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: selectedDate,
          attendance: attendanceData
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setToast({ message: 'Attendance marked successfully!', type: 'success' })
      } else {
        setToast({ message: data.message || 'Failed to mark attendance', type: 'error' })
      }
    } catch (error) {
      setToast({ message: 'An error occurred. Please try again.', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  if (!user || studentsLoading) {
    return (
      <Layout darkMode={darkMode} toggleDarkMode={toggleDarkMode}>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout darkMode={darkMode} toggleDarkMode={toggleDarkMode}>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="card mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center">
                <ClipboardDocumentListIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Mark Attendance
                </h1>
                <p className="text-gray-600 dark:text-gray-300">
                  Record daily student attendance
                </p>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Date Selection */}
          <div className="card mb-6">
            <div className="flex items-center space-x-4">
              <CalendarIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Select Date
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  max={format(new Date(), 'yyyy-MM-dd')}
                  className="input-field w-auto"
                  required
                />
              </div>
            </div>
          </div>

          {/* Students by Grade */}
          <div className="space-y-6">
            {gradeOrder.map(grade => {
              const students = studentsByGrade[grade] || [] // Fix: Add || [] to handle undefined
              if (students.length === 0) return null

              return (
                <div key={grade} className="card">
                  <div className="mb-4">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                      Grade: {grade}
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {students.length} student{students.length !== 1 ? 's' : ''}
                    </p>
                  </div>

                  <div className="space-y-4">
                    {students.map(student => (
                      <div key={student.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-white">
                            {student.name}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-300">
                            Grade: {student.grade}
                          </p>
                        </div>

                        <div className="flex space-x-4">
                          {/* Present */}
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="radio"
                              name={`attendance-${student.id}`}
                              value="present"
                              checked={attendanceData[student.id] === 'present'}
                              onChange={() => handleAttendanceChange(student.id, 'present')}
                              className="w-4 h-4 text-green-600 bg-gray-100 border-gray-300 focus:ring-green-500 dark:focus:ring-green-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                            />
                            <span className="text-sm font-medium text-green-600 dark:text-green-400">Present</span>
                          </label>

                          {/* Absent */}
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="radio"
                              name={`attendance-${student.id}`}
                              value="absent"
                              checked={attendanceData[student.id] === 'absent'}
                              onChange={() => handleAttendanceChange(student.id, 'absent')}
                              className="w-4 h-4 text-red-600 bg-gray-100 border-gray-300 focus:ring-red-500 dark:focus:ring-red-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                            />
                            <span className="text-sm font-medium text-red-600 dark:text-red-400">Absent</span>
                          </label>

                          {/* Late */}
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="radio"
                              name={`attendance-${student.id}`}
                              value="late"
                              checked={attendanceData[student.id] === 'late'}
                              onChange={() => handleAttendanceChange(student.id, 'late')}
                              className="w-4 h-4 text-yellow-600 bg-gray-100 border-gray-300 focus:ring-yellow-500 dark:focus:ring-yellow-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                            />
                            <span className="text-sm font-medium text-yellow-600 dark:text-yellow-400">Late</span>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Submit Button */}
          <div className="card mt-6">
            <button
              type="submit"
              disabled={loading}
              className={`w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-lg font-medium transition-colors ${loading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
            >
              <CheckCircleIcon className="w-5 h-5" />
              <span>{loading ? 'Submitting...' : 'Submit Attendance'}</span>
            </button>
          </div>
        </form>
      </div>
    </Layout>
  )
}