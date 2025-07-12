import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'
import { getUserFromToken, getAuthToken } from '../utils/auth'
import {
  ClipboardDocumentListIcon,
  UsersIcon,
  ChartBarIcon,
  BanknotesIcon,
  CalendarIcon,
  AcademicCapIcon
} from '@heroicons/react/24/outline'
import { format } from 'date-fns'

export default function Dashboard({ darkMode, toggleDarkMode }) {
  const [user, setUser] = useState(null)
  const [currentDate, setCurrentDate] = useState(new Date())
  const router = useRouter()
  const [date, setDate] = useState('')

  useEffect(() => {
    const token = getAuthToken()
    if (!token) {
      router.push('/login')
      return
    }

    const userData = getUserFromToken(token)
    if (userData) {
      setUser(userData)
    } else {
      router.push('/login')
    }
  }, [router])

  useEffect(() => {
    // Runs only on the client after hydration
    setDate(new Date().toLocaleDateString())
  }, [])

  const adminLinks = [
    {
      href: '/attendance/report',
      icon: ChartBarIcon,
      title: 'View Reports',
      description: 'Check attendance reports and analytics',
      color: 'bg-blue-500'
    },
    {
      href: '/students/manage',
      icon: UsersIcon,
      title: 'Manage Students',
      description: 'Add, edit, or remove student records',
      color: 'bg-green-500'
    },
    {
      href: '/students/monthly-fees',
      icon: BanknotesIcon,
      title: 'Monthly Fees',
      description: 'View Fees Collection Details',
      color: 'bg-amber-500'
    },

  ]

  const teacherLinks = [
    {
      href: '/attendance/mark',
      icon: ClipboardDocumentListIcon,
      title: 'Mark Attendance',
      description: 'Record daily student attendance',
      color: 'bg-orange-500'
    }

  ]

  if (!user) {
    return (
      <Layout darkMode={darkMode} toggleDarkMode={toggleDarkMode}>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      </Layout>
    )
  }

  const links = user.role === 'admin' ? adminLinks : teacherLinks

  return (
    <Layout darkMode={darkMode} toggleDarkMode={toggleDarkMode}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="card mb-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between">
            <div className="flex items-center space-x-4 mb-4 md:mb-0">
              <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center">
                <AcademicCapIcon className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Welcome back, {user.name}!
                </h1>
                <p className="text-gray-600 dark:text-gray-300">
                  {user.role === 'admin' ? 'Administrator' : 'Teacher'} Dashboard
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-300">
              <CalendarIcon className="w-5 h-5" />
              <span className="text-sm">
                {format(currentDate, 'EEEE, MMMM do, yyyy')}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {links.map((link, index) => (
            <div
              key={index}
              onClick={() => router.push(link.href)}
              className="card hover:shadow-lg transition-all duration-200 cursor-pointer group"
            >
              <div className="flex items-start space-x-4">
                <div className={`w-12 h-12 ${link.color} rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  <link.icon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                    {link.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {link.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Stats Cards for Admin */}
        {user.role === 'admin' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="card text-center">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center mx-auto mb-4">
                <UsersIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">12</div>
              <div className="text-sm text-gray-600 dark:text-gray-300">Total Students</div>
            </div>

            <div className="card text-center">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center mx-auto mb-4">
                <ChartBarIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">85%</div>
              <div className="text-sm text-gray-600 dark:text-gray-300">Avg. Attendance</div>
            </div>

            <div className="card text-center">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center mx-auto mb-4">
                <AcademicCapIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">9</div>
              <div className="text-sm text-gray-600 dark:text-gray-300">Grade Levels</div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}