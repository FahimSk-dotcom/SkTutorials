import React, { useState, useEffect, useMemo } from 'react';
import { Search, DollarSign, Calendar, Filter, X, Check, Clock, AlertCircle, Plus, Eye, Edit, Trash2 } from 'lucide-react';
import Layout from '../../components/Layout'
const MonthlyFeesPage = ({ darkMode, toggleDarkMode }) => {
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('All');
    const [currentPage, setCurrentPage] = useState(1);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [paymentData, setPaymentData] = useState({
        paymentMode: '',
        amount: '',
        month: ''
    });

    const studentsPerPage = 10;

    // Fetch students data
    useEffect(() => {
        fetchStudents();
    }, []);
    const fetchStudents = async () => {
        try {
            setLoading(true);
            setError(null);

            // Get the token from localStorage or wherever you store it
            const token = localStorage.getItem('authToken'); // Adjust based on your auth implementation

            if (!token) {
                throw new Error('No authentication token found');
            }

            const response = await fetch('/api/auth/monthly-fees', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Unauthorized access. Please login again.');
                }
                throw new Error('Failed to fetch students');
            }

            const data = await response.json();
            setStudents(data);
            setLoading(false);

        } catch (err) {
            setError(err.message);
            setLoading(false);

            // If it's an auth error, you might want to redirect to login
            if (err.message.includes('Unauthorized') || err.message.includes('token')) {
                // Redirect to login page or clear auth state
                // Example: window.location.href = '/login';
                // Or: clearAuthState();
            }
        }
    };

    // Calculate fee status for a student
    const calculateFeeStatus = (student) => {
        const today = new Date();
        const currentMonth = today.toLocaleString('default', { month: 'long', year: 'numeric' });

        // Calculate due date based on admission date
        const admissionDate = new Date(student.admissionDate);
        const dueDate = new Date(today.getFullYear(), today.getMonth(), admissionDate.getDate());

        // Check if current month fee is paid
        const currentMonthStatus = student.monthlyFeeStatus?.find(status => status.month === currentMonth);

        let status = 'due';
        let statusColor = 'bg-amber-500';
        let statusIcon = Clock;

        if (currentMonthStatus?.paid) {
            status = 'paid';
            statusColor = 'bg-green-500';
            statusIcon = Check;
        } else if (dueDate < today) {
            status = 'overdue';
            statusColor = 'bg-red-500';
            statusIcon = AlertCircle;
        } else if (dueDate.toDateString() === today.toDateString()) {
            status = 'due-today';
            statusColor = 'bg-amber-500';
            statusIcon = Clock;
        }
        return {
            status,
            statusColor,
            statusIcon,
            dueDate,
            currentMonthStatus,
            currentMonth
        };

    };

    // Filter and search students
    const filteredStudents = useMemo(() => {
        let filtered = students.filter(student => {
            const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                student.grade.toLowerCase().includes(searchTerm.toLowerCase()) ||
                student.parentName.toLowerCase().includes(searchTerm.toLowerCase());

            if (!matchesSearch) return false;

            if (filterStatus === 'All') return true;

            const feeStatus = calculateFeeStatus(student);

            switch (filterStatus) {
                case 'Paid':
                    return feeStatus.status === 'paid';
                case 'Due Today':
                    return feeStatus.status === 'due-today';
                case 'Overdue':
                    return feeStatus.status === 'overdue';
                case 'Due':
                    return feeStatus.status === 'due' || feeStatus.status === 'due-today';
                default:
                    return true;
            }
        });

        return filtered;
    }, [students, searchTerm, filterStatus]);

    // Pagination
    const totalPages = Math.ceil(filteredStudents.length / studentsPerPage);
    const currentStudents = filteredStudents.slice(
        (currentPage - 1) * studentsPerPage,
        currentPage * studentsPerPage
    );

    // Handle payment submission
    const handlePaymentSubmit = async () => {
        // Validation
        if (!paymentData.paymentMode || !paymentData.amount) {
            alert('Please fill in all required fields');
            return;
        }

        try {
            const today = new Date();
            const currentMonth = today.toLocaleString('default', { month: 'long', year: 'numeric' });

            // Get the token from localStorage or wherever you store it
            const token = localStorage.getItem('authToken'); // Using the correct key from your app

            if (!token) {
                throw new Error('No authentication token found');
            }

            const updatedFeeStatus = [...(selectedStudent.monthlyFeeStatus || [])];
            const existingIndex = updatedFeeStatus.findIndex(status => status.month === currentMonth);

            const newFeeEntry = {
                month: currentMonth,
                paid: true,
                dueDate: calculateFeeStatus(selectedStudent).dueDate.toISOString(),
                paidOn: new Date().toISOString(),
                paymentMode: paymentData.paymentMode,
                amount: parseFloat(paymentData.amount)
            };

            if (existingIndex >= 0) {
                updatedFeeStatus[existingIndex] = newFeeEntry;
            } else {
                updatedFeeStatus.push(newFeeEntry);
            }

            // Make API call to update payment
            const response = await fetch('/api/auth/monthly-fees', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    studentId: selectedStudent._id,
                    monthlyFeeStatus: updatedFeeStatus,
                    lastFeePaidDate: new Date().toISOString()
                })
            });

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Unauthorized access. Please login again.');
                }
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to update payment');
            }

            const result = await response.json();

            // Update the student in the local state
            const updatedStudents = students.map(student =>
                student._id === selectedStudent._id
                    ? { ...student, monthlyFeeStatus: updatedFeeStatus, lastFeePaidDate: new Date().toISOString() }
                    : student
            );
            setStudents(updatedStudents);

            // Close modal
            setShowPaymentModal(false);
            setSelectedStudent(null);
            setPaymentData({ paymentMode: '', amount: '', month: '' });

            // Show success message
            alert('Payment updated successfully!');

        } catch (err) {
            setError(err.message);
            alert('Error updating payment: ' + err.message);

            // If it's an auth error, you might want to redirect to login
            if (err.message.includes('Unauthorized') || err.message.includes('token')) {
                // Redirect to login page or clear auth state
                // Example: window.location.href = '/login';
                // Or: clearAuthState();
            }
        }
    };

    const openPaymentModal = (student) => {
        setSelectedStudent(student);
        const today = new Date();
        const currentMonth = today.toLocaleString('default', { month: 'long', year: 'numeric' });
        setPaymentData({
            paymentMode: '',
            amount: '',
            month: currentMonth
        });
        setShowPaymentModal(true);
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-GB');
    };

    const StatusBadge = ({ feeInfo }) => {
        const Icon = feeInfo.statusIcon;

        const getStatusText = () => {
            switch (feeInfo.status) {
                case 'paid': return 'Paid';
                case 'due-today': return 'Due Today';
                case 'overdue': return 'Overdue';
                default: return 'Due';
            }
        };

        return (
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium text-white ${feeInfo.statusColor}`}>
                <Icon size={12} />
                {getStatusText()}
            </span>
        );
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 text-white p-6">
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <Layout darkMode={darkMode} toggleDarkMode={toggleDarkMode}>
                <div className="min-h-screen bg-gray-900 text-white p-6">
                    <div className="flex items-center justify-center h-64">
                        <div className="text-red-400 text-center">
                            <AlertCircle size={48} className="mx-auto mb-4" />
                            <p>Error: {error}</p>
                            <button
                                onClick={fetchStudents}
                                className="mt-4 px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700"
                            >
                                Retry
                            </button>
                        </div>
                    </div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout darkMode={darkMode} toggleDarkMode={toggleDarkMode}>
            <div className="min-h-screen bg-gray-900 text-white">
                {/* Header */}
                <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-orange-600 rounded-lg">
                                <DollarSign size={24} className="text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-semibold">Monthly Fees</h1>
                                <p className="text-gray-400 text-sm">View and manage fee collection details</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-sm text-gray-400">
                                {new Date().toLocaleDateString('en-GB', {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                })}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="p-6">
                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                        <div className="bg-gray-800 rounded-lg p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-600 rounded-lg">
                                    <DollarSign size={20} />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{students.length}</p>
                                    <p className="text-gray-400 text-sm">Total Students</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-gray-800 rounded-lg p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-green-600 rounded-lg">
                                    <Check size={20} />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">
                                        {filteredStudents.filter(s => calculateFeeStatus(s).status === 'paid').length}
                                    </p>
                                    <p className="text-gray-400 text-sm">Paid This Month</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-gray-800 rounded-lg p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-amber-600 rounded-lg">
                                    <Clock size={20} />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">
                                        {filteredStudents.filter(s => calculateFeeStatus(s).status === 'due-today').length}
                                    </p>
                                    <p className="text-gray-400 text-sm">Due Today</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-gray-800 rounded-lg p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-red-600 rounded-lg">
                                    <AlertCircle size={20} />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">
                                        {filteredStudents.filter(s => calculateFeeStatus(s).status === 'overdue').length}
                                    </p>
                                    <p className="text-gray-400 text-sm">Overdue</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Search and Filters */}
                    <div className="bg-gray-800 rounded-lg p-4 mb-6">
                        <div className="flex flex-col md:flex-row gap-4">
                            {/* Search */}
                            <div className="flex-1 relative">
                                <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search students, parents, or grade..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                                />
                            </div>

                            {/* Filter Buttons */}
                            <div className="flex gap-2">
                                {['All', 'Paid', 'Due Today', 'Overdue', 'Due'].map((filter) => (
                                    <button
                                        key={filter}
                                        onClick={() => setFilterStatus(filter)}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filterStatus === filter
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                            }`}
                                    >
                                        {filter}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Students Table */}
                    <div className="bg-gray-800 rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-700 border-b border-gray-600">
                                    <tr>
                                        <th className="text-left p-4 font-medium text-gray-300">Student</th>
                                        <th className="text-left p-4 font-medium text-gray-300">Grade</th>
                                        <th className="text-left p-4 font-medium text-gray-300">Parent</th>
                                        <th className="text-left p-4 font-medium text-gray-300">Contact</th>
                                        <th className="text-left p-4 font-medium text-gray-300">Due Date</th>
                                        <th className="text-left p-4 font-medium text-gray-300">Status</th>
                                        <th className="text-left p-4 font-medium text-gray-300">Payment Mode</th>
                                        <th className="text-left p-4 font-medium text-gray-300">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentStudents.map((student) => {
                                        const feeInfo = calculateFeeStatus(student);

                                        return (
                                            <tr key={student._id} className="border-b border-gray-700 hover:bg-gray-750">
                                                <td className="p-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-sm font-medium">
                                                            {student.name.charAt(0)}
                                                        </div>
                                                        <span className="font-medium">{student.name}</span>
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <span className="px-2 py-1 bg-blue-600 rounded-full text-xs font-medium">
                                                        {student.grade}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-gray-300">{student.parentName}</td>
                                                <td className="p-4 text-gray-300">{student.contact}</td>
                                                <td className="p-4">
                                                    <div className="flex items-center gap-2">
                                                        <Calendar size={16} className="text-gray-400" />
                                                        <span className="text-sm">{formatDate(feeInfo.dueDate)}</span>
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <StatusBadge feeInfo={feeInfo} />
                                                </td>
                                                <td className="p-4 text-gray-300">
                                                    {feeInfo.currentMonthStatus?.paymentMode || '-'}
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex items-center gap-2">
                                                        {!feeInfo.currentMonthStatus?.paid && (
                                                            <button
                                                                onClick={() => openPaymentModal(student)}
                                                                className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium transition-colors"
                                                            >
                                                                Receive Fee
                                                            </button>
                                                        )}
                                                        <button className="p-1 text-gray-400 hover:text-white">
                                                            <Eye size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="p-4 border-t border-gray-700 flex items-center justify-between">
                                <p className="text-sm text-gray-400">
                                    Showing {((currentPage - 1) * studentsPerPage) + 1} to {Math.min(currentPage * studentsPerPage, filteredStudents.length)} of {filteredStudents.length} students
                                </p>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                        disabled={currentPage === 1}
                                        className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm"
                                    >
                                        Previous
                                    </button>
                                    <span className="px-3 py-1 bg-blue-600 rounded-lg text-sm font-medium">
                                        {currentPage} of {totalPages}
                                    </span>
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                        disabled={currentPage === totalPages}
                                        className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Payment Modal */}
                {showPaymentModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                        <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold">Receive Fee Payment</h3>
                                <button
                                    onClick={() => setShowPaymentModal(false)}
                                    className="text-gray-400 hover:text-white"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="mb-4 p-3 bg-gray-700 rounded-lg">
                                <p className="text-sm text-gray-300">Student: <span className="font-medium text-white">{selectedStudent?.name}</span></p>
                                <p className="text-sm text-gray-300">Grade: <span className="font-medium text-white">{selectedStudent?.grade}</span></p>
                                <p className="text-sm text-gray-300">Month: <span className="font-medium text-white">{paymentData.month}</span></p>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Payment Mode *
                                    </label>
                                    <select
                                        value={paymentData.paymentMode}
                                        onChange={(e) => setPaymentData({ ...paymentData, paymentMode: e.target.value })}
                                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                                    >
                                        <option value="">Select payment mode</option>
                                        <option value="Cash">Cash</option>
                                        <option value="Online">Online</option>
                                        <option value="Cheque">Cheque</option>
                                        <option value="UPI">UPI</option>
                                        <option value="Bank Transfer">Bank Transfer</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Amount *
                                    </label>
                                    <input
                                        type="number"
                                        value={paymentData.amount}
                                        onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                                        placeholder="Enter fee amount"
                                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                                    />
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowPaymentModal(false)}
                                        className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handlePaymentSubmit}
                                        className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition-colors"
                                    >
                                        Receive Payment
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

export default MonthlyFeesPage;