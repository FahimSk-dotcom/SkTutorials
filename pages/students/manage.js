import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Search, Edit, Trash2, Users, Phone, User, GraduationCap, X, Check, AlertCircle, Calendar, DollarSign, Eye } from 'lucide-react';
import Layout from '@/components/Layout';

const gradeOrder = ['Nursery', 'LKG', 'UKG', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];

// API utility functions
const getAuthToken = () => {
  // Assuming you store the JWT token in localStorage
  return localStorage.getItem('authToken');
};

const apiRequest = async (url, options = {}) => {
  const token = getAuthToken();
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `HTTP error! status: ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
};

// API functions
const studentAPI = {
  getAll: async (params = {}) => {
    const queryParams = new URLSearchParams();
    
    if (params.search) queryParams.append('search', params.search);
    if (params.grade && params.grade !== 'All') queryParams.append('grade', params.grade);
    if (params.page) queryParams.append('page', params.page);
    if (params.limit) queryParams.append('limit', params.limit);

    const url = `/api/students${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return await apiRequest(url, { method: 'GET' });
  },

  create: async (studentData) => {
    return await apiRequest('/api/students', {
      method: 'POST',
      body: JSON.stringify(studentData),
    });
  },

  update: async (id, studentData) => {
    return await apiRequest(`/api/students?id=${id}`, {
      method: 'PUT',
      body: JSON.stringify(studentData),
    });
  },

  delete: async (id) => {
    return await apiRequest(`/api/students?id=${id}`, {
      method: 'DELETE',
    });
  }
};

const ManageStudents = ({ darkMode, toggleDarkMode }) => {
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFeeStatusModalOpen, setIsFeeStatusModalOpen] = useState(false);
  const [selectedStudentFeeStatus, setSelectedStudentFeeStatus] = useState(null);
  const [editingStudent, setEditingStudent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    hasNextPage: false,
    hasPrevPage: false
  });
  const [formData, setFormData] = useState({
    name: '',
    grade: 'Nursery',
    parentName: '',
    contact: '',
    admissionDate: ''
  });

  // Refs for maintaining focus
  const searchInputRef = useRef(null);
  const debounceTimeoutRef = useRef(null);

  // Debounce search term
  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setPagination(prev => ({ ...prev, currentPage: 1 })); // Reset to first page on search
    }, 300); // 300ms debounce

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [searchTerm]);

  // Load students when debounced search term, grade filter, or page changes
  useEffect(() => {
    loadStudents();
  }, [debouncedSearchTerm, selectedGrade, pagination.currentPage]);

  const loadStudents = async () => {
    setLoading(true);
    setError('');
    
    try {
      const params = {
        search: debouncedSearchTerm,
        grade: selectedGrade,
        page: pagination.currentPage,
        limit: 50
      };

      const response = await studentAPI.getAll(params);
      
      if (response.data) {
        setStudents(response.data.students);
        setFilteredStudents(response.data.students);
        setPagination(response.data.pagination);
      }
    } catch (error) {
      setError(`Failed to load students: ${error.message}`);
      console.error('Error loading students:', error);
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    if (!formData.name.trim() || formData.name.trim().length < 2) {
      setError('Student name must be at least 2 characters long');
      return false;
    }
    
    if (!formData.parentName.trim() || formData.parentName.trim().length < 2) {
      setError('Parent name must be at least 2 characters long');
      return false;
    }
    
    if (!formData.contact.trim()) {
      setError('Contact number is required');
      return false;
    }
    
    // Validate Indian phone number format
    const phoneRegex = /^\+91\s?[6-9]\d{9}$/;
    if (!phoneRegex.test(formData.contact.replace(/\s/g, ''))) {
      setError('Invalid contact number format. Use +91 followed by 10 digits');
      return false;
    }
    
    if (!formData.admissionDate) {
      setError('Admission date is required');
      return false;
    }
    
    // Validate admission date is not in the future
    const admissionDate = new Date(formData.admissionDate);
    const today = new Date();
    today.setHours(23, 59, 59, 999); // Set to end of today
    
    if (admissionDate > today) {
      setError('Admission date cannot be in the future');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async () => {
    setError('');
    setSuccess('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      let response;
      
      if (editingStudent) {
        response = await studentAPI.update(editingStudent.id, formData);
        setSuccess('Student updated successfully');
      } else {
        response = await studentAPI.create(formData);
        setSuccess('Student added successfully');
      }
      
      // Refresh the students list
      await loadStudents();
      
      resetForm();
      setIsModalOpen(false);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (student) => {
    setEditingStudent(student);
    setFormData({
      name: student.name,
      grade: student.grade,
      parentName: student.parentName,
      contact: student.contact,
      admissionDate: student.admissionDate ? student.admissionDate.split('T')[0] : '' // Format date for input
    });
    setError('');
    setSuccess('');
    setIsModalOpen(true);
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`Are you sure you want to delete ${name}?`)) {
      setLoading(true);
      setError('');
      
      try {
        await studentAPI.delete(id);
        await loadStudents(); // Refresh the list
        setSuccess('Student deleted successfully');
        
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(''), 3000);
        
      } catch (error) {
        setError(`Failed to delete student: ${error.message}`);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleViewFeeStatus = (student) => {
    setSelectedStudentFeeStatus(student);
    setIsFeeStatusModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      grade: 'Nursery',
      parentName: '',
      contact: '',
      admissionDate: ''
    });
    setEditingStudent(null);
    setError('');
    setSuccess('');
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const closeFeeStatusModal = () => {
    setIsFeeStatusModalOpen(false);
    setSelectedStudentFeeStatus(null);
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    // Don't reset pagination here as it will be handled in the debounced effect
  };

  const handleGradeFilter = (e) => {
    setSelectedGrade(e.target.value);
    setPagination(prev => ({ ...prev, currentPage: 1 })); // Reset to first page on filter
  };

  const getGradeColor = (grade) => {
    const colors = {
      'Nursery': 'bg-pink-100 text-pink-800',
      'LKG': 'bg-purple-100 text-purple-800',
      'UKG': 'bg-indigo-100 text-indigo-800',
      '1st': 'bg-blue-100 text-blue-800',
      '2nd': 'bg-cyan-100 text-cyan-800',
      '3rd': 'bg-green-100 text-green-800',
      '4th': 'bg-yellow-100 text-yellow-800',
      '5th': 'bg-orange-100 text-orange-800',
      '6th': 'bg-red-100 text-red-800',
      '7th': 'bg-rose-100 text-rose-800',
      '8th': 'bg-violet-100 text-violet-800',
      '9th': 'bg-slate-100 text-slate-800'
    };
    return colors[grade] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getFeeStatusColor = (isPaid) => {
    return isPaid ? 'text-green-400' : 'text-red-400';
  };

  return (
    <Layout darkMode={darkMode} toggleDarkMode={toggleDarkMode}>
      <div className="min-h-screen bg-slate-900 text-white">
        {/* Success/Error Messages */}
        {success && (
          <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg">
            {success}
          </div>
        )}
        
        {error && (
          <div className="fixed top-4 right-4 z-50 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center">
            <AlertCircle className="h-4 w-4 mr-2" />
            {error}
          </div>
        )}

        {/* Header */}
        <div className="bg-slate-800 border-b border-slate-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-4">
                <div className="bg-green-600 p-2 rounded-lg">
                  <Users className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold">Manage Students</h1>
                  <p className="text-sm text-slate-400">Add, edit, or remove student records</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(true)}
                className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
                disabled={loading}
              >
                <Plus className="h-4 w-4" />
                <span>Add Student</span>
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Filters */}
          <div className="mb-6 flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search students, parents, or contact..."
                value={searchTerm}
                onChange={handleSearch}
                className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                disabled={loading}
              />
            </div>
            <select
              value={selectedGrade}
              onChange={handleGradeFilter}
              className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              disabled={loading}
            >
              <option value="All">All Grades</option>
              {gradeOrder.map(grade => (
                <option key={grade} value={grade}>{grade}</option>
              ))}
            </select>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
              <div className="flex items-center">
                <div className="bg-blue-600 p-3 rounded-lg">
                  <Users className="h-6 w-6" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-slate-400">Total Students</p>
                  <p className="text-2xl font-bold">{pagination.totalCount}</p>
                </div>
              </div>
            </div>
            <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
              <div className="flex items-center">
                <div className="bg-green-600 p-3 rounded-lg">
                  <GraduationCap className="h-6 w-6" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-slate-400">Active Grades</p>
                  <p className="text-2xl font-bold">{gradeOrder.length}</p>
                </div>
              </div>
            </div>
            <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
              <div className="flex items-center">
                <div className="bg-purple-600 p-3 rounded-lg">
                  <Search className="h-6 w-6" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-slate-400">Current Page</p>
                  <p className="text-2xl font-bold">{pagination.currentPage}/{pagination.totalPages}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Students Table */}
          <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Student</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Grade</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Parent</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Contact</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Admission Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Last Fee Paid</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {loading ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-4 text-center text-slate-400">
                        Loading students...
                      </td>
                    </tr>
                  ) : filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-4 text-center text-slate-400">
                        {debouncedSearchTerm || selectedGrade !== 'All' ? 'No students found matching your criteria' : 'No students added yet'}
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((student) => (
                      <tr key={student.id} className="hover:bg-slate-750">
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="bg-green-600 p-2 rounded-full">
                              <User className="h-4 w-4" />
                            </div>
                            <div className="ml-3">
                              <div className="text-sm font-medium">{student.name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getGradeColor(student.grade)}`}>
                            {student.grade}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-300">{student.parentName}</td>
                        <td className="px-6 py-4">
                          <a href={`tel:${student.contact}`} className="flex items-center text-sm text-slate-300">
                            <Phone className="h-4 w-4 mr-2" />
                            {student.contact}
                          </a>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center text-sm text-slate-300">
                            <Calendar className="h-4 w-4 mr-2" />
                            {formatDate(student.admissionDate)}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center text-sm text-slate-300">
                            <DollarSign className="h-4 w-4 mr-2" />
                            {student.lastFeePaidDate ? formatDate(student.lastFeePaidDate) : 'No payments yet'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleViewFeeStatus(student)}
                              className="text-blue-400 hover:text-blue-300 p-1 rounded"
                              disabled={loading}
                              title="View fee status"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleEdit(student)}
                              className="text-yellow-400 hover:text-yellow-300 p-1 rounded"
                              disabled={loading}
                              title="Edit student"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(student.id, student.name)}
                              className="text-red-400 hover:text-red-300 p-1 rounded"
                              disabled={loading}
                              title="Delete student"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="bg-slate-700 px-6 py-3 flex items-center justify-between border-t border-slate-600">
                <div className="text-sm text-slate-400">
                  Showing {filteredStudents.length} of {pagination.totalCount} students
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, currentPage: prev.currentPage - 1 }))}
                    disabled={!pagination.hasPrevPage || loading}
                    className="px-3 py-1 text-sm bg-slate-600 hover:bg-slate-500 disabled:opacity-50 disabled:cursor-not-allowed rounded"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-slate-400">
                    Page {pagination.currentPage} of {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, currentPage: prev.currentPage + 1 }))}
                    disabled={!pagination.hasNextPage || loading}
                    className="px-3 py-1 text-sm bg-slate-600 hover:bg-slate-500 disabled:opacity-50 disabled:cursor-not-allowed rounded"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Student Form Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 rounded-lg border border-slate-700 w-full max-w-md">
              <div className="flex items-center justify-between p-6 border-b border-slate-700">
                <h2 className="text-lg font-semibold">
                  {editingStudent ? 'Edit Student' : 'Add New Student'}
                </h2>
                <button
                  onClick={closeModal}
                  className="text-slate-400 hover:text-slate-300"
                  disabled={loading}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                {error && (
                  <div className="bg-red-600 text-white p-3 rounded-lg text-sm flex items-center">
                    <AlertCircle className="h-4 w-4 mr-2" />
                    {error}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Student Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Enter student name"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Grade *
                  </label>
                  <select
                    required
                    value={formData.grade}
                    onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    disabled={loading}
                  >
                    {gradeOrder.map(grade => (
                      <option key={grade} value={grade}>{grade}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Parent Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.parentName}
                    onChange={(e) => setFormData({ ...formData, parentName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Enter parent name"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Contact Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.contact}
                    onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="+91 9876543210"
                    disabled={loading}
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    Format: +91 followed by 10 digits
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Admission Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.admissionDate}
                    onChange={(e) => setFormData({ ...formData, admissionDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    disabled={loading}
                    max={new Date().toISOString().split('T')[0]} // Prevent future dates
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    Date when the student was admitted
                  </p>
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 text-slate-400 hover:text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-700 transition-colors"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={loading}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center space-x-2 transition-colors disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" />
                    <span>{loading ? 'Saving...' : (editingStudent ? 'Update' : 'Add')}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Fee Status Modal */}
        {isFeeStatusModalOpen && selectedStudentFeeStatus && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 rounded-lg border border-slate-700 w-full max-w-lg">
              <div className="flex items-center justify-between p-6 border-b border-slate-700">
                <h2 className="text-lg font-semibold">
                  Fee Status - {selectedStudentFeeStatus.name}
                </h2>
                <button
                  onClick={closeFeeStatusModal}
                  className="text-slate-400 hover:text-slate-300"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-400">Grade:</span>
                      <span className="ml-2 font-medium">{selectedStudentFeeStatus.grade}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Parent:</span>
                      <span className="ml-2 font-medium">{selectedStudentFeeStatus.parentName}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Admission Date:</span>
                      <span className="ml-2 font-medium">{formatDate(selectedStudentFeeStatus.admissionDate)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Last Fee Paid:</span>
                      <span className="ml-2 font-medium">
                        {selectedStudentFeeStatus.lastFeePaidDate ? formatDate(selectedStudentFeeStatus.lastFeePaidDate) : 'No payments yet'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="border-t border-slate-700 pt-4">
                    <h3 className="text-sm font-medium text-slate-300 mb-3">Monthly Fee Status</h3>
                    {selectedStudentFeeStatus.monthlyFeeStatus && Object.keys(selectedStudentFeeStatus.monthlyFeeStatus).length > 0 ? (
                      <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
                        {Object.entries(selectedStudentFeeStatus.monthlyFeeStatus)
                          .sort(([a], [b]) => new Date(b) - new Date(a)) // Sort by date descending
                          .map(([month, isPaid]) => (
                          <div key={month} className="flex items-center justify-between py-2 px-3 bg-slate-700 rounded-lg">
                            <span className="text-sm">{new Date(month + '-01').toLocaleDateString('en-IN', { year: 'numeric', month: 'long' })}</span>
                            <span className={`text-sm font-medium ${getFeeStatusColor(isPaid)}`}>
                              {isPaid ? '✓ Paid' : '✗ Unpaid'}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-slate-400">
                        <DollarSign className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>No fee records available</p>
                        <p className="text-xs mt-1">Fee status will appear here once payments are recorded</p>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex justify-end pt-4 border-t border-slate-700 mt-6">
                  <button
                    onClick={closeFeeStatusModal}
                    className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
    </Layout>
  );
};

export default ManageStudents;