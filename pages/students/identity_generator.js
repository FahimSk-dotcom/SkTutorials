import Layout from '@/components/Layout';
import { useState, useEffect, useRef } from 'react';

export default function GenerateStudentID() {
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [idCardData, setIdCardData] = useState(null);
  const [currentStudentData, setCurrentStudentData] = useState(null); // Added to store current student data
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const idCardRef = useRef(null);

  const [formData, setFormData] = useState({
    class: '',
    studentName: '',
    birthdate: '',
    admissiondate: '',
    schoolName: '',
    parentName: '',
    parentEmail: '',
    contactNumber: '',
    address: '',
    photo: null
  });

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = () => {
    setLoading(true);
    // Update the fetchStudents function to handle the new API response format
    fetch('/api/students/idgenstd')
      .then(response => response.json())
      .then(result => {
        // Handle both old format (array) and new format (object with data property)
        const data = result.data || result;
        setStudents(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(error => {
        console.error('Error fetching students:', error);
        setMessage('Error fetching students: ' + error.message);
        setLoading(false);
      });
  };

  const generateStudentID = () => {
    if (!selectedStudent) {
      setMessage('Please select a student first');
      return;
    }

    const student = students.find(s => s._id === selectedStudent);
    if (!student) {
      setMessage('Student not found');
      return;
    }

    // Generate roll number if not exists
    const rollNumber = `SK${String(students.indexOf(student) + 1).padStart(3, '0')}`;

    setIdCardData({
      ...student,
      rollNumber,
      idNumber: `ID-${new Date().getFullYear()}-${rollNumber}`,
      validUntil: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0]
    });

    setMessage('ID Card generated successfully!');
  };

  const downloadIDCard = () => {
    if (!idCardData || !idCardRef.current) {
      setMessage('Please generate ID card first');
      return;
    }

    try {
      // Create a canvas to convert the ID card to image
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const idCardElement = idCardRef.current;

      // Set canvas dimensions
      canvas.width = idCardElement.offsetWidth * 2;
      canvas.height = idCardElement.offsetHeight * 2;

      // Scale for better quality
      ctx.scale(2, 2);

      // Simple download trigger - you can implement html2canvas for better results
      setMessage('ID Card ready for download! (You can implement html2canvas for better image export)');

    } catch (error) {
      setMessage('Error preparing download: ' + error.message);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, files } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'file' ? files[0] : value
    }));
  };

  const resetForm = () => {
    setFormData({
      class: '',
      studentName: '',
      birthdate: '',
      admissiondate: '',
      schoolName: '',
      parentName: '',
      parentEmail: '',
      contactNumber: '',
      address: '',
      photo: null
    });
    setShowForm(false);
    setEditingStudent(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const submitData = new FormData();
    Object.keys(formData).forEach(key => {
      if (formData[key] !== null) {
        submitData.append(key, formData[key]);
      }
    });

    try {
      const url = editingStudent ? '/api/students/idgenstd' : '/api/students/idgenstd';
      const method = editingStudent ? 'PUT' : 'POST';

      if (editingStudent) {
        submitData.append('studentId', editingStudent);
      }

      const response = await fetch(url, {
        method,
        body: submitData
      });

      const result = await response.json();
      if (result.success) {
        setMessage(editingStudent ? 'Student updated successfully!' : 'Student added successfully!');
        resetForm();
        fetchStudents();
      } else {
        setMessage('Error: ' + (result.error || result.details || 'Unknown error'));
      }
    } catch (error) {
      setMessage('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (student) => {
    setEditingStudent(student._id);
    setFormData({
      class: student.class,
      studentName: student.studentName,
      birthdate: student.birthdate,
      admissiondate: student.admissiondate || '',
      schoolName: student.schoolName,
      parentName: student.parentName,
      parentEmail: student.parentEmail || '',
      contactNumber: student.contactNumber,
      address: student.address,
      photo: null
    });
    setShowForm(true);
    setMessage('');
  };

  const handleDelete = async (studentId) => {
    if (!window.confirm('Are you sure you want to delete this student?')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/students/delete_Id/${studentId}`, {
        method: 'DELETE'
      });

      const result = await response.json();
      if (result.success) {
        setMessage('Student deleted successfully!');
        fetchStudents();
      } else {
        setMessage('Error deleting student: ' + result.error);
      }
    } catch (error) {
      setMessage('Error deleting student: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = students.filter(student => {
    const matchesSearch = student.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.parentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.contactNumber.includes(searchTerm);
    const matchesClass = !classFilter || student.class === classFilter;
    return matchesSearch && matchesClass;
  });

  const classes = ['Nursery', 'Jr.Kg', 'Sr.Kg', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];

  return (
    <Layout>
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                Student ID Card Generator
              </h1>
              <p className="text-gray-600">Generate and manage student ID cards</p>
            </div>
            <button
              onClick={() => setShowForm(!showForm)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center gap-2"
            >
              <span className="text-lg">+</span>
              Add Student
            </button>
          </div>
        </div>

        {/* Message Display */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg border ${message.includes('Error') || message.includes('error')
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-green-50 border-green-200 text-green-800'
            }`}>
            {message}
          </div>
        )}

        {/* Student Form */}
        {showForm && (
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                {editingStudent ? 'Edit Student' : 'Add New Student'}
              </h2>
              <button
                onClick={resetForm}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
              >
                ×
              </button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Class *</label>
                  <select
                    name="class"
                    value={formData.class}
                    onChange={handleInputChange}
                    required
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-500"
                  >
                    <option value="" className="text-gray-500">Select Class</option>
                    {classes.map(cls => (
                      <option key={cls} value={cls} className="text-gray-900">{cls}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Student Name *</label>
                  <input
                    type="text"
                    name="studentName"
                    value={formData.studentName}
                    onChange={handleInputChange}
                    required
                    placeholder="Enter student name"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Birth Date *</label>
                  <input
                    type="date"
                    name="birthdate"
                    value={formData.birthdate}
                    onChange={handleInputChange}
                    required
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Admission Date *</label>
                  <input
                    type="date"
                    name="admissiondate"
                    value={formData.admissiondate}
                    onChange={handleInputChange}
                    required
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">School Name *</label>
                  <input
                    type="text"
                    name="schoolName"
                    value={formData.schoolName}
                    onChange={handleInputChange}
                    required
                    placeholder="Enter school name"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Parent Name *</label>
                  <input
                    type="text"
                    name="parentName"
                    value={formData.parentName}
                    onChange={handleInputChange}
                    required
                    placeholder="Enter parent name"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Parent Email *</label>
                  <input
                    type="email"
                    name="parentEmail"
                    value={formData.parentEmail}
                    onChange={handleInputChange}
                    required
                    placeholder="Enter parent email"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Contact Number *</label>
                  <input
                    type="tel"
                    name="contactNumber"
                    value={formData.contactNumber}
                    onChange={handleInputChange}
                    required
                    placeholder="Enter contact number"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Address *</label>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  required
                  rows={3}
                  placeholder="Enter full address"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none bg-white text-gray-900 placeholder-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Student Photo (Optional)</label>
                <input
                  type="file"
                  name="photo"
                  accept="image/*"
                  onChange={handleInputChange}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200"
                >
                  {loading ? 'Saving...' : editingStudent ? 'Update Student' : 'Add Student'}
                </button>
                <button
                  onClick={resetForm}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ID Card Generator */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Generate ID Card</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Student</label>
                <select
                  value={selectedStudent}
                  onChange={(e) => setSelectedStudent(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none appearance-none"
                >
                  <option value="" className="text-gray-500">Choose a student</option>
                  {students.map(student => (
                    <option key={student._id} value={student._id} className="text-gray-900">
                      {student.studentName} - {student.class}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={generateStudentID}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 flex-1"
                >
                  Generate ID Card
                </button>
                {idCardData && (
                  <button
                    onClick={downloadIDCard}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 flex-1"
                  >
                    Download ID Card
                  </button>
                )}
              </div>
            </div>

            {/* ID Card Preview */}
            {idCardData && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">ID Card Preview</h3>
                <div
                  ref={idCardRef}
                  className="bg-gradient-to-br from-blue-600 to-purple-700 text-white p-6 rounded-xl max-w-sm mx-auto shadow-lg"
                >
                  <div className="text-center mb-4">
                    <h4 className="text-lg font-bold">{idCardData.schoolName}</h4>
                    <p className="text-sm opacity-90">Student ID Card</p>
                  </div>

                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center overflow-hidden">
                      {idCardData.photoUrl ? (
                        <img
                          src={idCardData.photoUrl}
                          alt="Student"
                          className="w-14 h-14 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-14 h-14 bg-gray-300 rounded-full flex items-center justify-center">
                          <span className="text-gray-600 text-2xl font-bold">
                            {idCardData.studentName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <h5 className="font-semibold text-lg capitalize">{idCardData.studentName}</h5>
                      <p className="text-sm opacity-90">Class: {idCardData.class}</p>
                      <p className="text-sm opacity-90">ID: {idCardData.idNumber}</p>
                    </div>
                  </div>

                  <div className="text-xs space-y-1 bg-black bg-opacity-20 p-3 rounded-lg">
                    <p><span className="font-medium">Roll No:</span> {idCardData.rollNumber}</p>
                    <p><span className="font-medium">Parent:</span> {idCardData.parentName}</p>
                    <p><span className="font-medium">Contact:</span> {idCardData.contactNumber}</p>
                    <p><span className="font-medium">Valid Until:</span> {new Date(idCardData.validUntil).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Students List */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <h2 className="text-xl font-bold text-gray-900">Students List</h2>
              <div className="text-sm text-gray-600">
                Total: {filteredStudents.length} students
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search students, parents, or contact..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="sm:w-40">
                <select
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none appearance-none"
                >
                  <option value="" className="text-gray-500">All Classes</option>
                  {classes.map(cls => (
                    <option key={cls} value={cls} className="text-gray-900">{cls}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Students Grid */}
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {loading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="mt-2 text-gray-600">Loading students...</p>
                </div>
              ) : filteredStudents.length > 0 ? (
                filteredStudents.map(student => (
                  <div key={student._id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors duration-200">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                          {student.photoUrl ? (
                            <img
                              src={student.photoUrl}
                              alt="Student"
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <span className="text-blue-600 font-medium text-lg">
                              {student.studentName.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-medium text-gray-900 capitalize truncate">{student.studentName}</h4>
                          <div className="flex flex-col sm:flex-row sm:gap-4 text-sm text-gray-600">
                            <span>Class: {student.class}</span>
                            <span>Parent: {student.parentName}</span>
                          </div>
                          <div className="flex flex-col sm:flex-row sm:gap-4 text-sm text-gray-500">
                            <span>{student.contactNumber}</span>
                            <span>{student.parentEmail}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => {
                            setSelectedStudent(student._id);
                            generateStudentID();
                          }}
                          className="bg-purple-100 hover:bg-purple-200 text-purple-700 px-3 py-2 rounded-lg transition-colors duration-200 text-sm font-medium"
                          title="Generate ID Card"
                        >
                          🆔 ID Card
                        </button>
                        <button
                          onClick={() => handleEdit(student)}
                          className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-2 rounded-lg transition-colors duration-200 text-sm font-medium"
                          title="Edit Student"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => handleDelete(student._id)}
                          className="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-2 rounded-lg transition-colors duration-200 text-sm font-medium"
                          title="Delete Student"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <div className="text-gray-400 mb-4">
                    <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                  </div>
                  <p className="text-gray-600">No students found</p>
                  <p className="text-gray-500 text-sm mt-1">
                    {searchTerm || classFilter ? 'Try adjusting your search filters' : 'Add your first student to get started'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Students</p>
                <p className="text-2xl font-bold text-gray-900">{students.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Classes</p>
                <p className="text-2xl font-bold text-gray-900">
                  {new Set(students.map(s => s.class)).size}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-lg">
                <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V4a2 2 0 114 0v2m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">ID Cards Generated</p>
                <p className="text-2xl font-bold text-gray-900">{currentStudentData ? '1' : '0'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </Layout>
  );
}