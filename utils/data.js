// Mock data for development
export const mockStudents = [
  { id: 1, name: 'Aarav Sharma', grade: 'Nursery', parentName: 'Raj Sharma', contact: '+91 9876543210' },
  { id: 2, name: 'Priya Patel', grade: 'LKG', parentName: 'Amit Patel', contact: '+91 9876543211' },
  { id: 3, name: 'Arjun Singh', grade: 'UKG', parentName: 'Sunita Singh', contact: '+91 9876543212' },
  { id: 4, name: 'Kavya Reddy', grade: '1st', parentName: 'Ravi Reddy', contact: '+91 9876543213' },
  { id: 5, name: 'Rohan Kumar', grade: '2nd', parentName: 'Meera Kumar', contact: '+91 9876543214' },
  { id: 6, name: 'Ananya Gupta', grade: '3rd', parentName: 'Vikram Gupta', contact: '+91 9876543215' },
  { id: 7, name: 'Karan Joshi', grade: '4th', parentName: 'Pooja Joshi', contact: '+91 9876543216' },
  { id: 8, name: 'Ishita Agarwal', grade: '5th', parentName: 'Suresh Agarwal', contact: '+91 9876543217' },
  { id: 9, name: 'Dhruv Malhotra', grade: '6th', parentName: 'Nisha Malhotra', contact: '+91 9876543218' },
  { id: 10, name: 'Sneha Iyer', grade: '7th', parentName: 'Raman Iyer', contact: '+91 9876543219' },
  { id: 11, name: 'Varun Chopra', grade: '8th', parentName: 'Preet Chopra', contact: '+91 9876543220' },
  { id: 12, name: 'Riya Bansal', grade: '9th', parentName: 'Ashok Bansal', contact: '+91 9876543221' }
]


export const gradeOrder = ['Nursery', 'LKG', 'UKG', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th']

export const getStudentsByGrade = () => {
  const grouped = {}
  gradeOrder.forEach(grade => {
    grouped[grade] = mockStudents.filter(student => student.grade === grade)
  })
  return grouped
}