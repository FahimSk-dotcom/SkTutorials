import Navbar from './Navbar'
import { useState, useEffect } from 'react'

export default function Layout({ children }) {
  const [darkMode, setDarkMode] = useState(false)
  const [date, setDate] = useState('')
  useEffect(() => {
    const savedDarkMode = localStorage.getItem('darkMode')
    if (savedDarkMode) {
      setDarkMode(JSON.parse(savedDarkMode))
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      setDarkMode(prefersDark)
    }
  }, [])
  useEffect(() => {
    // Runs only on the client after hydration
    setDate(new Date().toLocaleDateString())
  }, [])

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('darkMode', JSON.stringify(darkMode))
  }, [darkMode])

  const toggleDarkMode = () => {
    setDarkMode(!darkMode)
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <Navbar darkMode={darkMode} toggleDarkMode={toggleDarkMode} />

      {/* Content Area */}
      <main className="flex-grow container mx-auto px-4 py-8">
        {children}
      </main>
      <footer className="text-center text-sm text-gray-500 dark:text-gray-400 py-4">
        <p>SK Tutorial Management System • Report generated on {date}</p>
        <p>For any queries, contact the administration office.</p>
      </footer>
    </div>
  )
}
