import { useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'
import { isAuthenticated } from '../utils/auth'
import { AcademicCapIcon, UsersIcon, ChartBarIcon, PhoneIcon } from '@heroicons/react/24/outline'

export default function Home({ darkMode, toggleDarkMode }) {
  const router = useRouter()

  useEffect(() => {
    if (isAuthenticated()) {
      router.push('/dashboard')
    }
  }, [router])

  const features = [
    {
      icon: UsersIcon,
      title: 'Student Management',
      description: 'Manage student records, grades, and contact information easily.'
    },
    {
      icon: AcademicCapIcon,
      title: 'Attendance Tracking',
      description: 'Mark daily attendance and track student presence efficiently.'
    },
    {
      icon: ChartBarIcon,
      title: 'Reports & Analytics',
      description: 'Generate detailed attendance reports and share with parents.'
    },
    {
      icon: PhoneIcon,
      title: 'Parent Communication',
      description: 'Easy contact management and communication with parents.'
    }
  ]

  return (
    <Layout darkMode={darkMode} toggleDarkMode={toggleDarkMode}>
      <div className="max-w-6xl mx-auto">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primary-600 rounded-full mb-6">
            <AcademicCapIcon className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Welcome to <span className="text-primary-600">SK Tutorial</span>
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
            Streamline your attendance management with our easy-to-use system designed for teachers and administrators.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => router.push('/login')}
              className="btn-primary px-8 py-3 text-lg"
            >
              Get Started
            </button>
            <button
              onClick={() => router.push('/contact')}
              className="btn-secondary px-8 py-3 text-lg"
            >
              Contact Us
            </button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {features.map((feature, index) => (
            <div key={index} className="card text-center hover:shadow-md transition-shadow">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-100 dark:bg-primary-900 rounded-lg mb-4">
                <feature.icon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-gray-600 dark:text-gray-300 text-sm">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* About Section */}
        <div className="card text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            About SK Tutorial
          </h2>
          <p className="text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            We provide quality education for students from Nursery to 9th grade. Our attendance management system 
            helps us maintain accurate records and keep parents informed about their child's progress and attendance.
          </p>
        </div>
      </div>
    </Layout>
  )
}