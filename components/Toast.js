import { useEffect, useState } from 'react'
import { CheckCircleIcon, XMarkIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline'

export default function Toast({ message, type = 'success', onClose, duration = 3000 }) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(onClose, 300) // Wait for animation to complete
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, onClose])

  const icons = {
    success: CheckCircleIcon,
    error: ExclamationCircleIcon,
    warning: ExclamationCircleIcon
  }

  const colors = {
    success: 'bg-green-50 text-green-800 border-green-200',
    error: 'bg-red-50 text-red-800 border-red-200',
    warning: 'bg-yellow-50 text-yellow-800 border-yellow-200'
  }

  const Icon = icons[type]

  return (
    <div
      className={`fixed top-4 right-4 z-50 flex items-center space-x-2 px-4 py-3 rounded-lg border shadow-lg transition-all duration-300 ${
        isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      } ${colors[type]}`}
    >
      <Icon className="w-5 h-5" />
      <span className="text-sm font-medium">{message}</span>
      <button
        onClick={() => {
          setIsVisible(false)
          setTimeout(onClose, 300)
        }}
        className="ml-2 hover:opacity-70 transition-opacity"
      >
        <XMarkIcon className="w-4 h-4" />
      </button>
    </div>
  )
}