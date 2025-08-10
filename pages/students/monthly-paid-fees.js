import { useEffect, useState } from 'react'
import { Eye, Calendar, DollarSign, CreditCard, Banknote } from 'lucide-react'
import Layout from '@/components/Layout'

export default function PaidStudentsPage() {
  const [students, setStudents] = useState([])
  const [allStudents, setAllStudents] = useState([]) // Store all students data
  const [availableMonths, setAvailableMonths] = useState([])
  const [selectedMonth, setSelectedMonth] = useState('')
  const [totalPaid, setTotalPaid] = useState(0)
  const [totalAmount, setTotalAmount] = useState(0)
  const [cashTotal, setCashTotal] = useState(0)
  const [onlineTotal, setOnlineTotal] = useState(0)
  const [otherTotal, setOtherTotal] = useState(0)
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Generate available months from current month going backwards
  const generateAvailableMonths = (studentsData) => {
    const months = new Set()
    const currentDate = new Date()
    
    // Add current month
    const currentMonth = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })
    months.add(currentMonth)
    
    // Add previous months from students' fee data
    studentsData.forEach(student => {
      if (student.monthlyFeeStatus) {
        student.monthlyFeeStatus.forEach(fee => {
          if (fee.paid && fee.month) {
            months.add(fee.month)
          }
        })
      }
    })
    
    // Convert to array and sort (most recent first)
    const monthsArray = Array.from(months).sort((a, b) => {
      const dateA = new Date(a.split(' ')[1] + ' ' + a.split(' ')[0] + ' 1')
      const dateB = new Date(b.split(' ')[1] + ' ' + b.split(' ')[0] + ' 1')
      return dateB - dateA
    })
    
    return monthsArray
  }

  // Filter students by selected month
  const filterStudentsByMonth = (studentsData, month) => {
    let totalAmountCollected = 0
    let totalCash = 0
    let totalOnline = 0
    let totalOther = 0

    const paidStudents = studentsData.filter(student => {
      const status = student.monthlyFeeStatus?.find(m => m.month === month && m.paid)
      if (status) {
        const amount = status.amount || 0
        totalAmountCollected += amount

        // Categorize payment modes
        if (status.paymentMode === 'Cash') {
          totalCash += amount
        } else if (status.paymentMode === 'Online' || status.paymentMode === 'UPI' || status.paymentMode === 'Bank Transfer') {
          totalOnline += amount
        } else {
          totalOther += amount
        }

        // Add current month fee info to student object
        student.currentMonthFee = {
          ...status,
          formattedPaidOn: new Date(status.paidOn).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
          })
        }
        return true
      }
      return false
    })

    // Sort students by payment date (most recent first)
    paidStudents.sort((a, b) => {
      const dateA = new Date(a.currentMonthFee.paidOn)
      const dateB = new Date(b.currentMonthFee.paidOn)
      return dateB - dateA
    })

    return {
      paidStudents,
      totalAmountCollected,
      totalCash,
      totalOnline,
      totalOther
    }
  }

  const fetchStudentsData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const token = localStorage.getItem('authToken')
      if (!token) throw new Error('No token found')

      const res = await fetch('/api/auth/monthly-fees', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('Unauthorized. Please login again.')
        }
        throw new Error('Failed to fetch students')
      }

      const data = await res.json()
      setAllStudents(data)
      
      // Generate available months
      const months = generateAvailableMonths(data)
      setAvailableMonths(months)
      
      // Set current month as default if no month selected
      const currentMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' })
      const defaultMonth = selectedMonth || currentMonth
      setSelectedMonth(defaultMonth)
      
      // Filter students for the selected/default month
      const filtered = filterStudentsByMonth(data, defaultMonth)
      setStudents(filtered.paidStudents)
      setTotalPaid(filtered.paidStudents.length)
      setTotalAmount(filtered.totalAmountCollected)
      setCashTotal(filtered.totalCash)
      setOnlineTotal(filtered.totalOnline)
      setOtherTotal(filtered.totalOther)
      
    } catch (err) {
      console.error('Error fetching students:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Handle month selection change
  const handleMonthChange = (month) => {
    setSelectedMonth(month)
    
    const filtered = filterStudentsByMonth(allStudents, month)
    setStudents(filtered.paidStudents)
    setTotalPaid(filtered.paidStudents.length)
    setTotalAmount(filtered.totalAmountCollected)
    setCashTotal(filtered.totalCash)
    setOnlineTotal(filtered.totalOnline)
    setOtherTotal(filtered.totalOther)
  }

  useEffect(() => {
    fetchStudentsData()
  }, [])

  if (loading) {
    return (
      <Layout>
        <div className="p-6 text-white min-h-screen bg-[#0f172a]">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        </div>
      </Layout>
    )
  }

  if (error) {
    return (
      <Layout>
        <div className="p-6 text-white min-h-screen bg-[#0f172a]">
          <div className="flex items-center justify-center h-64">
            <div className="text-red-400 text-center">
              <p className="text-xl mb-4">Error: {error}</p>
              <button
                onClick={fetchStudentsData}
                className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="p-6 text-white min-h-screen bg-[#0f172a]">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold mb-2">Paid Students</h1>
            <p className="text-gray-400">View students who have paid their fees</p>
          </div>
          
          {/* Month Selector */}
          <div className="flex items-center gap-3 mt-4 sm:mt-0">
            <Calendar size={20} className="text-gray-400" />
            <select
              value={selectedMonth}
              onChange={(e) => handleMonthChange(e.target.value)}
              className="bg-[#1e293b] border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
            >
              {availableMonths.map(month => (
                <option key={month} value={month}>{month}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div className="bg-[#1e293b] rounded-xl p-5 shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-300">Students Paid</p>
                <p className="text-3xl font-bold text-green-400">{totalPaid}</p>
              </div>
              <div className="p-3 bg-green-600 rounded-lg">
                <DollarSign size={24} className="text-white" />
              </div>
            </div>
          </div>
          
          <div className="bg-[#1e293b] rounded-xl p-5 shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-300">Total Collected</p>
                <p className="text-3xl font-bold text-blue-400">₹{totalAmount.toLocaleString('en-IN')}</p>
              </div>
              <div className="p-3 bg-blue-600 rounded-lg">
                <DollarSign size={24} className="text-white" />
              </div>
            </div>
          </div>
          
          <div className="bg-[#1e293b] rounded-xl p-5 shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-300">Cash Collection</p>
                <p className="text-3xl font-bold text-yellow-400">₹{cashTotal.toLocaleString('en-IN')}</p>
              </div>
              <div className="p-3 bg-yellow-600 rounded-lg">
                <Banknote size={24} className="text-white" />
              </div>
            </div>
          </div>
          
          <div className="bg-[#1e293b] rounded-xl p-5 shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-300">Online Collection</p>
                <p className="text-3xl font-bold text-cyan-400">₹{onlineTotal.toLocaleString('en-IN')}</p>
              </div>
              <div className="p-3 bg-cyan-600 rounded-lg">
                <CreditCard size={24} className="text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Additional Stats Row */}
        {otherTotal > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
            <div className="bg-[#1e293b] rounded-xl p-5 shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-300">Other Payments</p>
                  <p className="text-2xl font-bold text-purple-400">₹{otherTotal.toLocaleString('en-IN')}</p>
                </div>
                <div className="p-3 bg-purple-600 rounded-lg">
                  <CreditCard size={20} className="text-white" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Students Table */}
        <div className="bg-[#1e293b] rounded-xl overflow-hidden shadow-lg">
          <div className="px-6 py-4 bg-[#334155] border-b border-gray-600">
            <h3 className="text-lg font-semibold text-white">
              Students who paid in {selectedMonth} ({totalPaid} students)
            </h3>
          </div>
          
          {students.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-400 text-lg">No students have paid for {selectedMonth}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#334155] text-gray-300">
                  <tr>
                    <th className="py-3 px-4 text-left">#</th>
                    <th className="py-3 px-4 text-left">Student</th>
                    <th className="py-3 px-4 text-left">Grade</th>
                    <th className="py-3 px-4 text-left">Parent</th>
                    <th className="py-3 px-4 text-left">Contact</th>
                    <th className="py-3 px-4 text-left">Payment Date</th>
                    <th className="py-3 px-4 text-left">Amount</th>
                    <th className="py-3 px-4 text-left">Mode</th>
                    <th className="py-3 px-4 text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student, idx) => (
                    <tr key={student._id} className="border-b border-[#475569] text-gray-100 hover:bg-[#2d3b4f]">
                      <td className="py-3 px-4 text-gray-400">{idx + 1}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-sm font-medium">
                            {student.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium">{student.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 bg-blue-600 rounded-full text-xs font-medium">
                          {student.grade}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-300">{student.parentName}</td>
                      <td className="py-3 px-4 text-gray-300">{student.contact}</td>
                      <td className="py-3 px-4 text-gray-300">{student.currentMonthFee.formattedPaidOn}</td>
                      <td className="py-3 px-4">
                        <span className="text-green-400 font-semibold">
                          ₹{student.currentMonthFee.amount?.toLocaleString('en-IN') || 'N/A'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          student.currentMonthFee.paymentMode === 'Cash' 
                            ? 'bg-yellow-600 text-yellow-100'
                            : student.currentMonthFee.paymentMode === 'Online' || student.currentMonthFee.paymentMode === 'UPI'
                            ? 'bg-blue-600 text-blue-100'
                            : 'bg-purple-600 text-purple-100'
                        }`}>
                          {student.currentMonthFee.paymentMode}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          className="text-blue-400 hover:text-blue-600 p-1 rounded hover:bg-gray-700 transition-colors"
                          onClick={() => setSelectedStudent(student)}
                          title="View Details"
                        >
                          <Eye size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Student Details Modal */}
        {selectedStudent && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-[#1e293b] text-white p-6 rounded-xl w-full max-w-md mx-4 shadow-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center text-lg font-medium">
                  {selectedStudent.name.charAt(0).toUpperCase()}
                </div>
                <h2 className="text-xl font-bold">{selectedStudent.name}</h2>
              </div>
              
              <div className="space-y-3 mb-6">
                <div className="flex justify-between">
                  <span className="text-gray-400">Grade:</span>
                  <span className="font-medium">{selectedStudent.grade}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Parent:</span>
                  <span className="font-medium">{selectedStudent.parentName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Contact:</span>
                  <span className="font-medium">{selectedStudent.contact}</span>
                </div>
                <hr className="border-gray-600" />
                <div className="flex justify-between">
                  <span className="text-gray-400">Month:</span>
                  <span className="font-medium">{selectedStudent.currentMonthFee?.month}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Paid On:</span>
                  <span className="font-medium">{selectedStudent.currentMonthFee?.formattedPaidOn}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Payment Mode:</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    selectedStudent.currentMonthFee?.paymentMode === 'Cash' 
                      ? 'bg-yellow-600 text-yellow-100'
                      : selectedStudent.currentMonthFee?.paymentMode === 'Online' || selectedStudent.currentMonthFee?.paymentMode === 'UPI'
                      ? 'bg-blue-600 text-blue-100'
                      : 'bg-purple-600 text-purple-100'
                  }`}>
                    {selectedStudent.currentMonthFee?.paymentMode}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Amount:</span>
                  <span className="text-green-400 font-bold text-lg">
                    ₹{selectedStudent.currentMonthFee?.amount?.toLocaleString('en-IN') || 'N/A'}
                  </span>
                </div>
              </div>
              
              <div className="flex justify-end">
                <button
                  className="bg-red-500 px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
                  onClick={() => setSelectedStudent(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}