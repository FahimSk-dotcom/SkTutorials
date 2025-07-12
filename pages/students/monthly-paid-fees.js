import { useEffect, useState } from 'react'
import { Eye } from 'lucide-react'
import Layout from '@/components/Layout'

export default function PaidStudentsPage() {
  const [students, setStudents] = useState([])
  const [totalPaid, setTotalPaid] = useState(0)
  const [totalAmount, setTotalAmount] = useState(0)
  const [cashTotal, setCashTotal] = useState(0)
  const [onlineTotal, setOnlineTotal] = useState(0)
  const [selectedStudent, setSelectedStudent] = useState(null)

  useEffect(() => {
    const fetchPaidStudents = async () => {
      try {
        const token = localStorage.getItem('authToken')
        if (!token) throw new Error('No token found')

        const res = await fetch('/api/auth/monthly-fees', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })

        if (!res.ok) throw new Error('Failed to fetch students')

        const data = await res.json()
        const today = new Date()
        const currentMonth = today.toLocaleString('default', { month: 'long', year: 'numeric' })

        let totalAmountCollected = 0
        let totalCash = 0
        let totalOnline = 0

        const paidStudents = data.filter(student => {
          const status = student.monthlyFeeStatus?.find(m => m.month === currentMonth && m.paid)
          if (status) {
            const amount = status.amount || 0
            totalAmountCollected += amount

            if (status.paymentMode === 'Cash') {
              totalCash += amount
            } else {
              totalOnline += amount
            }

            student.currentMonthFee = status
            return true
          }
          return false
        })

        setStudents(paidStudents)
        setTotalPaid(paidStudents.length)
        setTotalAmount(totalAmountCollected)
        setCashTotal(totalCash)
        setOnlineTotal(totalOnline)
      } catch (err) {
        console.error('Error fetching students:', err)
      }
    }

    fetchPaidStudents()
  }, [])

  return (
    <Layout>
    <div className="p-6 text-white min-h-screen bg-[#0f172a]">
      <h1 className="text-2xl font-semibold mb-6">Paid Students</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-[#1e293b] rounded-xl p-5 shadow-md">
          <p className="text-lg font-medium text-gray-300">Students Paid This Month</p>
          <p className="text-3xl font-bold text-green-400">{totalPaid}</p>
        </div>
        <div className="bg-[#1e293b] rounded-xl p-5 shadow-md">
          <p className="text-lg font-medium text-gray-300">Total Amount Collected</p>
          <p className="text-3xl font-bold text-green-400">₹{totalAmount}</p>
        </div>
        <div className="bg-[#1e293b] rounded-xl p-5 shadow-md">
          <p className="text-lg font-medium text-gray-300">Amount Collected (Cash)</p>
          <p className="text-3xl font-bold text-yellow-400">₹{cashTotal}</p>
        </div>
        <div className="bg-[#1e293b] rounded-xl p-5 shadow-md">
          <p className="text-lg font-medium text-gray-300">Amount Collected (Online)</p>
          <p className="text-3xl font-bold text-cyan-400">₹{onlineTotal}</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl">
        <table className="w-full text-sm bg-[#1e293b]">
          <thead className="bg-[#334155] text-gray-300">
            <tr>
              <th className="py-3 px-4 text-left">Student</th>
              <th className="py-3 px-4 text-left">Grade</th>
              <th className="py-3 px-4 text-left">Parent</th>
              <th className="py-3 px-4 text-left">Contact</th>
              <th className="py-3 px-4 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student, idx) => (
              <tr key={idx} className="border-b border-[#475569] text-gray-100">
                <td className="py-3 px-4 whitespace-nowrap">{student.name}</td>
                <td className="py-3 px-4 whitespace-nowrap">{student.grade}</td>
                <td className="py-3 px-4 whitespace-nowrap">{student.parentName}</td>
                <td className="py-3 px-4 whitespace-nowrap">{student.contact}</td>
                <td className="py-3 px-4">
                  <button
                    className="text-blue-400 hover:text-blue-600"
                    onClick={() => setSelectedStudent(student)}
                  >
                    <Eye size={20} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[#1e293b] text-white p-6 rounded-xl w-full max-w-md mx-4 shadow-lg">
            <h2 className="text-xl font-bold mb-4">{selectedStudent.name}'s Payment</h2>
            <p><span className="text-gray-400">Month:</span> {selectedStudent.currentMonthFee?.month}</p>
            <p><span className="text-gray-400">Paid On:</span> {new Date(selectedStudent.currentMonthFee?.paidOn).toLocaleDateString()}</p>
            <p><span className="text-gray-400">Payment Mode:</span> {selectedStudent.currentMonthFee?.paymentMode}</p>
            <p><span className="text-gray-400">Amount:</span> ₹{selectedStudent.currentMonthFee?.amount}</p>
            <div className="mt-6 text-right">
              <button
                className="bg-red-500 px-4 py-2 rounded hover:bg-red-600"
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