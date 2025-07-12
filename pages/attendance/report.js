import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '../../components/Layout'
import { getUserFromToken, getAuthToken } from '../../utils/auth'
import { mockStudents, gradeOrder } from '../../utils/data'
import {
  ChartBarIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  DocumentArrowDownIcon,
  CalendarDaysIcon,
  AcademicCapIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts'

export default function AttendanceReports({ darkMode, toggleDarkMode }) {
  const [user, setUser] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedGrade, setSelectedGrade] = useState('all')
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [reportType, setReportType] = useState('summary')
  const [attendanceThreshold, setAttendanceThreshold] = useState(75)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  // Add attendanceData state
  const [attendanceData, setAttendanceData] = useState([])

  // Month names for the calculateGradeWiseData function
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                     'July', 'August', 'September', 'October', 'November', 'December']

  // Enhanced mock attendance data with more realistic patterns
  const generateAttendanceData = () => {
    return mockStudents.map(student => {
      const workingDays = getWorkingDaysInMonth(selectedYear, selectedMonth - 1)
      const baseAttendance = Math.random() > 0.8 ? 0.6 : 0.85 // Some students have poor attendance
      const presentDays = Math.floor(workingDays * (baseAttendance + Math.random() * 0.2))
      const leaveDays = Math.floor(Math.random() * 2)
      const absentDays = workingDays - presentDays - leaveDays

      return {
        ...student,
        totalDays: workingDays,
        presentDays: Math.max(0, presentDays),
        absentDays: Math.max(0, absentDays),
        leaveDays: Math.max(0, leaveDays),
        attendancePercentage: workingDays > 0 ? Math.round((presentDays / workingDays) * 100) : 0,
        lastAttended: new Date(Date.now() - Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000).toLocaleDateString(),
        monthlyTrend: generateMonthlyTrend(),
        studentGrade: student.grade, // Add this for calculateGradeWiseData compatibility
        // Add months structure for calculateGradeWiseData compatibility
        months: {
          [monthNames[selectedMonth - 1]]: Array.from({ length: workingDays }, (_, i) => ({
            date: new Date(selectedYear, selectedMonth - 1, i + 1),
            status: Math.random() > 0.15 ? 'present' : (Math.random() > 0.5 ? 'absent' : 'leave')
          }))
        }
      }
    })
  }

  const generateMonthlyTrend = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
    return months.map(month => ({
      month,
      attendance: Math.floor(Math.random() * 30) + 70
    }))
  }

  const getWorkingDaysInMonth = (year, month) => {
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    let workingDays = 0
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day)
      const dayOfWeek = date.getDay()
      if (dayOfWeek !== 0) workingDays++ // Exclude Sundays
    }
    return workingDays
  }

  // Update attendanceData when month/year changes
  useEffect(() => {
    setAttendanceData(generateAttendanceData())
  }, [selectedMonth, selectedYear])

  useEffect(() => {
    const token = getAuthToken()
    if (!token) {
      router.push('/login')
      return
    }

    const userData = getUserFromToken(token)
    if (userData && userData.role === 'admin') {
      setUser(userData)
    } else {
      router.push('/dashboard')
    }
  }, [router])

  // Updated useEffect to load attendance data
  useEffect(() => {
    const loadAttendanceData = async () => {
      const data = await fetchAttendanceData();
      setAttendanceData(data);
    };

    loadAttendanceData();
  }, [selectedMonth, selectedYear, selectedGrade]);

  const fetchAttendanceData = async () => {
    try {
      setLoading(true);

      // Replace this with your actual API call
      const response = await fetch('/api/attendance/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({
          year: selectedYear,
          month: selectedMonth,
          grade: selectedGrade !== 'all' ? selectedGrade : undefined
        })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch attendance data');
      }

      const data = await response.json();
      return data;

    } catch (error) {
      console.error('Error fetching attendance data:', error);
      // Fallback to mock data for now
      return generateAttendanceData();
    } finally {
      setLoading(false);
    }
  };

  const filteredData = attendanceData.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.parentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.rollNumber.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesGrade = selectedGrade === 'all' || student.grade === selectedGrade
    return matchesSearch && matchesGrade
  })

  const chartData = filteredData.slice(0, 10).map(student => ({
    name: student.name.split(' ')[0],
    attendance: student.attendancePercentage,
    grade: student.grade,
    present: student.presentDays,
    absent: student.absentDays
  }))

  const overallStats = {
    totalStudents: filteredData.length,
    avgAttendance: filteredData.length > 0 ? Math.round(filteredData.reduce((sum, s) => sum + s.attendancePercentage, 0) / filteredData.length) : 0,
    excellentAttendance: filteredData.filter(s => s.attendancePercentage >= 90).length,
    goodAttendance: filteredData.filter(s => s.attendancePercentage >= 75 && s.attendancePercentage < 90).length,
    poorAttendance: filteredData.filter(s => s.attendancePercentage < attendanceThreshold).length,
    totalWorkingDays: attendanceData.length > 0 ? attendanceData[0].totalDays : 0
  }

  const calculateGradeWiseData = (attendanceData) => {
    // Group attendance data by grade
    const gradeMap = new Map();

    attendanceData.forEach(record => {
      const grade = record.studentGrade || record.grade; // Handle both field names
      if (!gradeMap.has(grade)) {
        gradeMap.set(grade, {
          grade: grade,
          students: [],
          totalStudents: 0,
          totalPresentDays: 0,
          totalPossibleDays: 0,
          excellent: 0,
          poor: 0
        });
      }

      const gradeData = gradeMap.get(grade);
      gradeData.students.push(record);
      gradeData.totalStudents++;

      // Calculate attendance for current month
      const currentMonth = monthNames[selectedMonth - 1];
      const monthData = record.months ? record.months[currentMonth] || [] : [];

      if (monthData.length > 0) {
        const presentDays = monthData.filter(day => day.status === 'present').length;
        const totalDays = monthData.length;
        const attendancePercentage = totalDays > 0 ? (presentDays / totalDays) * 100 : 0;

        gradeData.totalPresentDays += presentDays;
        gradeData.totalPossibleDays += totalDays;

        // Count performance levels
        if (attendancePercentage >= 90) {
          gradeData.excellent++;
        } else if (attendancePercentage < attendanceThreshold) {
          gradeData.poor++;
        }
      } else {
        // Fallback to use existing attendance data if months structure is not available
        gradeData.totalPresentDays += record.presentDays || 0;
        gradeData.totalPossibleDays += record.totalDays || 0;
        
        if (record.attendancePercentage >= 90) {
          gradeData.excellent++;
        } else if (record.attendancePercentage < attendanceThreshold) {
          gradeData.poor++;
        }
      }
    });

    // Convert to array and calculate average attendance
    return Array.from(gradeMap.values()).map(gradeData => ({
      grade: gradeData.grade,
      attendance: gradeData.totalPossibleDays > 0
        ? Math.round((gradeData.totalPresentDays / gradeData.totalPossibleDays) * 100)
        : 0,
      students: gradeData.totalStudents,
      excellent: gradeData.excellent,
      poor: gradeData.poor
    })).sort((a, b) => {
      // Sort grades in logical order
      const gradeOrder = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'];
      return gradeOrder.indexOf(a.grade) - gradeOrder.indexOf(b.grade);
    });
  };

  // Now this will work without ReferenceError
  const gradeWiseData = calculateGradeWiseData(attendanceData);
  const pieData = [
    { name: 'Excellent (90%+)', value: overallStats.excellentAttendance, color: '#10b981' },
    { name: 'Good (75-89%)', value: overallStats.goodAttendance, color: '#f59e0b' },
    { name: 'Poor (<75%)', value: overallStats.poorAttendance, color: '#ef4444' }
  ].filter(item => item.value > 0)


  const exportToCSV = () => {
    setLoading(true)
    const headers = ['Roll Number', 'Student Name', 'Grade', 'Parent Name', 'Total Days', 'Present', 'Absent', 'Leave', 'Attendance %', 'Last Attended']
    const csvData = [
      headers.join(','),
      ...filteredData.map(student => [
        student.rollNumber,
        `"${student.name}"`,
        student.grade,
        `"${student.parentName}"`,
        student.totalDays,
        student.presentDays,
        student.absentDays,
        student.leaveDays,
        student.attendancePercentage,
        student.lastAttended
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvData], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `SK_Tutorial_Attendance_Report_${monthNames[selectedMonth - 1]}_${selectedYear}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
    setLoading(false)
  }

  const getAttendanceStatus = (percentage) => {
    if (percentage >= 90) return { text: 'Excellent', color: 'text-green-600 dark:text-green-400' }
    if (percentage >= 75) return { text: 'Good', color: 'text-yellow-600 dark:text-yellow-400' }
    return { text: 'Poor', color: 'text-red-600 dark:text-red-400' }
  }

  if (!user) {
    return (
      <Layout darkMode={darkMode} toggleDarkMode={toggleDarkMode}>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout darkMode={darkMode} toggleDarkMode={toggleDarkMode}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="card">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between">
            <div className="flex items-center space-x-4 mb-4 lg:mb-0">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <ChartBarIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  SK Tutorial - Attendance Reports
                </h1>
                <p className="text-gray-600 dark:text-gray-300 mt-1">
                  Comprehensive attendance analysis for {monthNames[selectedMonth - 1]} {selectedYear}
                </p>
              </div>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={exportToCSV}
                disabled={loading}
                className="btn-primary flex items-center space-x-2 disabled:opacity-50"
              >
                <DocumentArrowDownIcon className="w-4 h-4" />
                <span>{loading ? 'Exporting...' : 'Export CSV'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="card">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Search */}
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Search Students
              </label>
              <div className="relative">
                <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, parent, or roll number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input-field pl-10"
                />
              </div>
            </div>

            {/* Grade Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Grade
              </label>
              <select
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                className="input-field"
              >
                <option value="all">All Grades</option>
                {gradeOrder.map(grade => (
                  <option key={grade} value={grade}>{grade}</option>
                ))}
              </select>
            </div>

            {/* Month Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Month
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="input-field"
              >
                {monthNames.map((month, index) => (
                  <option key={month} value={index + 1}>{month}</option>
                ))}
              </select>
            </div>

            {/* Report Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Report Type
              </label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="input-field"
              >
                <option value="summary">Summary View</option>
                <option value="detailed">Detailed View</option>
                <option value="charts">Charts Only</option>
                <option value="alerts">Low Attendance Alerts</option>
              </select>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="card text-center bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
            <UserGroupIcon className="w-8 h-8 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {overallStats.totalStudents}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-300">Total Students</div>
          </div>

          <div className="card text-center bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20">
            <ChartBarIcon className="w-8 h-8 text-green-600 dark:text-green-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-green-600 dark:text-green-400 mb-1">
              {overallStats.avgAttendance}%
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-300">Average Attendance</div>
          </div>

          <div className="card text-center bg-gradient-to-r from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20">
            <CheckCircleIcon className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mb-1">
              {overallStats.excellentAttendance}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-300">Excellent (90%+)</div>
          </div>

          <div className="card text-center bg-gradient-to-r from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20">
            <ExclamationTriangleIcon className="w-8 h-8 text-red-600 dark:text-red-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-red-600 dark:text-red-400 mb-1">
              {overallStats.poorAttendance}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-300">Needs Attention</div>
          </div>

          <div className="card text-center bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20">
            <CalendarDaysIcon className="w-8 h-8 text-purple-600 dark:text-purple-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mb-1">
              {overallStats.totalWorkingDays}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-300">Working Days</div>
          </div>
        </div>

        {/* Low Attendance Alert */}
        {overallStats.poorAttendance > 0 && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="w-5 h-5 text-red-600 dark:text-red-400 mr-2" />
              <span className="text-red-800 dark:text-red-200 font-medium">
                Alert: {overallStats.poorAttendance} students have attendance below {attendanceThreshold}%
              </span>
            </div>
          </div>
        )}

        {/* Charts */}
        {(reportType === 'summary' || reportType === 'charts') && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Grade-wise Bar Chart */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <AcademicCapIcon className="w-5 h-5 mr-2" />
                Grade-wise Attendance Analysis - {monthNames[selectedMonth - 1]} {selectedYear}
              </h3>

              {loading ? (
                <div className="h-80 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={gradeWiseData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="grade"
                        tick={{ fontSize: 12 }}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 12 }}
                        label={{ value: 'Attendance %', angle: -90, position: 'insideLeft' }}
                      />
                      <Tooltip
                        formatter={(value, name) => {
                          if (name === 'attendance') return [`${value}%`, 'Average Attendance'];
                          return [value, name];
                        }}
                        labelFormatter={(label) => `Grade: ${label}`}
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                                <p className="font-semibold text-gray-900 dark:text-white">{`Grade: ${label}`}</p>
                                <p className="text-blue-600 dark:text-blue-400">{`Attendance: ${data.attendance}%`}</p>
                                <p className="text-gray-600 dark:text-gray-300">{`Students: ${data.students}`}</p>
                                <p className="text-green-600 dark:text-green-400">{`Excellent (90%+): ${data.excellent}`}</p>
                                <p className="text-red-600 dark:text-red-400">{`Needs Attention: ${data.poor}`}</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar
                        dataKey="attendance"
                        fill="#3b82f6"
                        radius={[4, 4, 0, 0]}
                        name="attendance"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Grade Summary Below Chart */}
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {gradeWiseData.map(grade => (
                  <div key={grade.grade} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        Grade {grade.grade}
                      </span>
                      <span className={`text-lg font-bold ${grade.attendance >= 90 ? 'text-green-600 dark:text-green-400' :
                        grade.attendance >= 75 ? 'text-yellow-600 dark:text-yellow-400' :
                          'text-red-600 dark:text-red-400'
                        }`}>
                        {grade.attendance}%
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                      {grade.students} students • {grade.excellent} excellent • {grade.poor} need attention
                    </div>
                  </div>
                ))}
              </div>

              {gradeWiseData.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <AcademicCapIcon className="mx-auto h-12 w-12 mb-2" />
                  <p>No attendance data available for the selected criteria</p>
                </div>
              )}
            </div>

            {/* Pie Chart */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Attendance Distribution
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="value"
                      label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Top Performers and Low Attendance */}
        {(reportType === 'summary' || reportType === 'alerts') && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Performers */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <CheckCircleIcon className="w-5 h-5 mr-2 text-green-600" />
                Top Performers (90%+ Attendance)
              </h3>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {filteredData
                  .filter(s => s.attendancePercentage >= 90)
                  .sort((a, b) => b.attendancePercentage - a.attendancePercentage)
                  .slice(0, 10)
                  .map((student, index) => (
                    <div key={student.rollNumber} className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {student.name} ({student.rollNumber})
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-300">
                          Grade {student.grade}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-green-600 dark:text-green-400">
                          {student.attendancePercentage}%
                        </div>
                        <div className="text-xs text-gray-500">
                          {student.presentDays}/{student.totalDays} days
                        </div>
                      </div>
                    </div>
                  ))}
                {filteredData.filter(s => s.attendancePercentage >= 90).length === 0 && (
                  <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                    No students with 90%+ attendance this month
                  </div>
                )}
              </div>
            </div>

            {/* Low Attendance Alert */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <ExclamationTriangleIcon className="w-5 h-5 mr-2 text-red-600" />
                Low Attendance Alert (&lt;{attendanceThreshold}%)
              </h3>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {filteredData
                  .filter(s => s.attendancePercentage < attendanceThreshold)
                  .sort((a, b) => a.attendancePercentage - b.attendancePercentage)
                  .map(student => (
                    <div key={student.rollNumber} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border-l-4 border-red-500">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {student.name} ({student.rollNumber})
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-300">
                          Grade {student.grade} • Parent: {student.parentName}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Last attended: {student.lastAttended}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-red-600 dark:text-red-400">
                          {student.attendancePercentage}%
                        </div>
                        <div className="text-xs text-gray-500">
                          {student.presentDays}/{student.totalDays} days
                        </div>
                        <div className="text-xs text-red-600 dark:text-red-400">
                          {student.absentDays} absent
                        </div>
                      </div>
                    </div>
                  ))}
                {filteredData.filter(s => s.attendancePercentage < attendanceThreshold).length === 0 && (
                  <div className="text-center py-4 text-green-600 dark:text-green-400">
                    🎉 No low attendance alerts! All students above {attendanceThreshold}%
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Detailed Student Table */}
        {(reportType === 'summary' || reportType === 'detailed') && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Student Attendance Details ({filteredData.length} students)
              </h3>
              <div className="flex items-center space-x-2">
                <label className="text-sm text-gray-600 dark:text-gray-300">
                  Threshold:
                </label>
                <select
                  value={attendanceThreshold}
                  onChange={(e) => setAttendanceThreshold(parseInt(e.target.value))}
                  className="input-field text-sm py-1"
                >
                  <option value={60}>60%</option>
                  <option value={70}>70%</option>
                  <option value={75}>75%</option>
                  <option value={80}>80%</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Student Details
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Grade
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Present
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Absent
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Leave
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Attendance %
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Last Attended
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredData
                    .sort((a, b) => b.attendancePercentage - a.attendancePercentage)
                    .map((student) => {
                      const status = getAttendanceStatus(student.attendancePercentage)
                      return (
                        <tr key={student.rollNumber} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10">
                                <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white font-medium">
                                  {student.name.charAt(0)}
                                </div>
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                  {student.name}
                                </div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                  {student.rollNumber} • {student.parentName}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200">
                              {student.grade}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className="text-sm font-medium text-green-600 dark:text-green-400">
                              {student.presentDays}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className="text-sm font-medium text-red-600 dark:text-red-400">
                              {student.absentDays}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                              {student.leaveDays}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <div className="flex items-center justify-center">
                              <div className="text-sm font-bold text-gray-900 dark:text-white mr-2">
                                {student.attendancePercentage}%
                              </div>
                              <div className={`w-16 h-2 rounded-full ${student.attendancePercentage >= 90 ? 'bg-green-200 dark:bg-green-800' :
                                student.attendancePercentage >= 75 ? 'bg-yellow-200 dark:bg-yellow-800' :
                                  'bg-red-200 dark:bg-red-800'
                                }`}>
                                <div
                                  className={`h-full rounded-full ${student.attendancePercentage >= 90 ? 'bg-green-500' :
                                    student.attendancePercentage >= 75 ? 'bg-yellow-500' :
                                      'bg-red-500'
                                    }`}
                                  style={{ width: `${Math.min(student.attendancePercentage, 100)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${student.attendancePercentage >= 90
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200'
                              : student.attendancePercentage >= 75
                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200'
                                : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200'
                              }`}>
                              {status.text}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            <div className="flex items-center">
                              <ClockIcon className="w-4 h-4 mr-1" />
                              {student.lastAttended}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>

              {filteredData.length === 0 && (
                <div className="text-center py-12">
                  <UserGroupIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No students found</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Try adjusting your search or filter criteria.
                  </p>
                </div>
              )}
            </div>

            {/* {filteredData.length > 0 && (
              <div className="bg-gray-50 dark:bg-gray-800 px-6 py-3 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-700 dark:text-gray-300">
                    Showing {filteredData.length} of {mockAttendanceData.length} students
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Report generated for {monthNames[selectedMonth - 1]} {selectedYear}
                  </div>
                </div>
              </div>
            )} */}
          </div>
        )}

        {/* Monthly Trend Chart */}
        {reportType === 'detailed' && (
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Monthly Attendance Trend (Top 5 Students)
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={filteredData.slice(0, 5).reduce((acc, student, index) => {
                  student.monthlyTrend.forEach((month, monthIndex) => {
                    if (!acc[monthIndex]) {
                      acc[monthIndex] = { month: month.month }
                    }
                    acc[monthIndex][student.name.split(' ')[0]] = month.attendance
                  })
                  return acc
                }, [])} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  {filteredData.slice(0, 5).map((student, index) => (
                    <Line
                      key={student.rollNumber}
                      type="monotone"
                      dataKey={student.name.split(' ')[0]}
                      stroke={['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'][index]}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Grade Performance Summary */}
        {(reportType === 'summary' || reportType === 'detailed') && (
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Grade-wise Performance Summary
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {gradeWiseData.map(grade => (
                <div key={grade.grade} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Grade {grade.grade}
                    </h4>
                    <span className={`text-2xl font-bold ${grade.attendance >= 90 ? 'text-green-600 dark:text-green-400' :
                      grade.attendance >= 75 ? 'text-yellow-600 dark:text-yellow-400' :
                        'text-red-600 dark:text-red-400'
                      }`}>
                      {grade.attendance}%
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-300">Total Students:</span>
                      <span className="font-medium text-gray-900 dark:text-white">{grade.students}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-300">Excellent (90%+):</span>
                      <span className="font-medium text-green-600 dark:text-green-400">{grade.excellent}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-300">Needs Attention:</span>
                      <span className="font-medium text-red-600 dark:text-red-400">{grade.poor}</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-3">
                      <div
                        className={`h-2 rounded-full ${grade.attendance >= 90 ? 'bg-green-500' :
                          grade.attendance >= 75 ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`}
                        style={{ width: `${grade.attendance}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Items */}
        <div className="card bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            📋 Action Items & Recommendations
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">Immediate Actions:</h4>
              <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                <li>• Contact parents of {overallStats.poorAttendance} low-attendance students</li>
                <li>• Schedule counseling sessions for chronic absentees</li>
                <li>• Review and update attendance policies if needed</li>
                <li>• Send appreciation letters to top performers</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">Monitoring:</h4>
              <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                <li>• Weekly attendance review meetings</li>
                <li>• Parent-teacher conferences for at-risk students</li>
                <li>• Implement early warning system for declining attendance</li>
                <li>• Monthly progress reports to stakeholders</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-4">
          <p>SK Tutorial Management System • Report generated on {new Date().toLocaleDateString()}</p>
          <p>For any queries, contact the administration office.</p>
        </div>
      </div>
    </Layout>
  )
}