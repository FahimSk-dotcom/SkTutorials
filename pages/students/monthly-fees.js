import React, { useState, useEffect, useMemo } from 'react';
import { Search, IndianRupee, Calendar, X, Check, Clock, AlertCircle, Eye, ChevronDown } from 'lucide-react';
import Layout from '../../components/Layout';

// ─── Academic Year Helpers ────────────────────────────────────────────────────

/**
 * Returns the current academic year string, e.g. "2025-26"
 * Academic year: June of year Y → May of year Y+1
 */
function getCurrentAcademicYear() {
    const today = new Date();
    const month = today.getMonth(); // 0-indexed; May=4, June=5
    const year = today.getFullYear();
    // If current month is June (5) or later → year-{year+1 short}
    // If current month is before June → (year-1)-{year short}
    const startYear = month >= 5 ? year : year - 1;
    return `${startYear}-${String(startYear + 1).slice(-2)}`;
}

/**
 * Given an academic year string like "2025-26",
 * returns { start: Date(June 2025), end: Date(May 2026 last day) }
 */
function getAcademicYearRange(academicYear) {
    const [startYearStr] = academicYear.split('-');
    const startYear = parseInt(startYearStr, 10);
    const endYear = startYear + 1;
    return {
        start: new Date(startYear, 5, 1),       // June 1 of startYear
        end: new Date(endYear, 4, 31, 23, 59, 59) // May 31 of endYear
    };
}

/**
 * Build a list of available academic years based on the student list.
 * Always includes the current academic year.
 */
function buildAcademicYearOptions(students) {
    const yearsSet = new Set();
    yearsSet.add(getCurrentAcademicYear());

    students.forEach(student => {
        (student.monthlyFeeStatus || []).forEach(fee => {
            // Parse month string like "June 2025"
            const date = new Date(fee.month);
            if (!isNaN(date)) {
                const m = date.getMonth();
                const y = date.getFullYear();
                const startYear = m >= 5 ? y : y - 1;
                yearsSet.add(`${startYear}-${String(startYear + 1).slice(-2)}`);
            }
        });

        // Also consider admission date
        if (student.admissionDate) {
            const ad = new Date(student.admissionDate);
            if (!isNaN(ad)) {
                const m = ad.getMonth();
                const y = ad.getFullYear();
                const startYear = m >= 5 ? y : y - 1;
                yearsSet.add(`${startYear}-${String(startYear + 1).slice(-2)}`);
            }
        }
    });

    return Array.from(yearsSet).sort((a, b) => {
        const aY = parseInt(a.split('-')[0]);
        const bY = parseInt(b.split('-')[0]);
        return bY - aY; // newest first
    });
}

/**
 * Returns all months (as "Month YYYY" strings) that fall within
 * the academic year range AND between admission date and today.
 */
function getRelevantMonths(student, academicYear) {
    const { start, end } = getAcademicYearRange(academicYear);
    const admissionDate = new Date(student.admissionDate);
    const today = new Date();

    // Clamp start to admission date (whichever is later)
    const effectiveStart = admissionDate > start ? admissionDate : start;
    // Clamp end to today (whichever is earlier)
    const effectiveEnd = today < end ? today : end;

    const months = [];
    let cursor = new Date(effectiveStart.getFullYear(), effectiveStart.getMonth(), 1);
    const endMonth = new Date(effectiveEnd.getFullYear(), effectiveEnd.getMonth(), 1);

    while (cursor <= endMonth) {
        months.push(cursor.toLocaleString('default', { month: 'long', year: 'numeric' }));
        cursor.setMonth(cursor.getMonth() + 1);
    }

    return months;
}

// ─── Fee Status Calculator (scoped to academic year) ─────────────────────────

function calculateFeeStatus(student, academicYear) {
    const today = new Date();
    const admissionDate = new Date(student.admissionDate);
    const relevantMonths = getRelevantMonths(student, academicYear);

    if (relevantMonths.length === 0) {
        // Student not yet admitted in this academic year
        return {
            status: 'not-applicable',
            statusColor: 'bg-gray-500',
            statusIcon: Calendar,
            dueDate: null,
            currentMonthStatus: null,
            currentMonth: null,
            unpaidMonths: [],
            pastMonthsUnpaid: [],
            currentMonthUnpaid: false,
            totalUnpaidMonths: 0
        };
    }

    const currentMonthStr = today.toLocaleString('default', { month: 'long', year: 'numeric' });

    // Find unpaid months within the academic year scope
    const unpaidMonths = relevantMonths
        .filter(monthStr => {
            const monthStatus = student.monthlyFeeStatus?.find(s => s.month === monthStr);
            return !monthStatus?.paid;
        });

    const currentMonthUnpaid = unpaidMonths.includes(currentMonthStr);
    const pastMonthsUnpaid = unpaidMonths.filter(m => m !== currentMonthStr);

    const dueDate = new Date(today.getFullYear(), today.getMonth(), admissionDate.getDate());

    let status, statusColor, statusIcon;

    if (unpaidMonths.length === 0) {
        status = 'paid';
        statusColor = 'bg-green-500';
        statusIcon = Check;
    } else if (pastMonthsUnpaid.length > 0) {
        status = 'past-overdue';
        statusColor = 'bg-red-600';
        statusIcon = AlertCircle;
    } else if (currentMonthUnpaid) {
        const currentDay = today.getDate();
        const dueDay = admissionDate.getDate();
        if (currentDay === dueDay) {
            status = 'due-today';
            statusColor = 'bg-amber-500';
            statusIcon = Clock;
        } else if (currentDay > dueDay) {
            status = 'overdue';
            statusColor = 'bg-red-500';
            statusIcon = AlertCircle;
        } else {
            status = 'due';
            statusColor = 'bg-amber-500';
            statusIcon = Clock;
        }
    } else {
        status = 'due';
        statusColor = 'bg-amber-500';
        statusIcon = Clock;
    }

    const currentMonthStatus = student.monthlyFeeStatus?.find(s => s.month === currentMonthStr);

    return {
        status,
        statusColor,
        statusIcon,
        dueDate,
        currentMonthStatus,
        currentMonth: currentMonthStr,
        unpaidMonths,
        pastMonthsUnpaid,
        currentMonthUnpaid,
        totalUnpaidMonths: unpaidMonths.length
    };
}

// ─── Component ────────────────────────────────────────────────────────────────

const MonthlyFeesPage = ({ darkMode, toggleDarkMode }) => {
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('All');
    const [currentPage, setCurrentPage] = useState(1);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [paymentData, setPaymentData] = useState({ paymentMode: '', amount: '', month: '' });

    // ── Academic year state ──
    const [selectedYear, setSelectedYear] = useState(getCurrentAcademicYear());
    const [showYearDropdown, setShowYearDropdown] = useState(false);

    const studentsPerPage = 10;

    // Derive available years from loaded students
    const academicYearOptions = useMemo(() => buildAcademicYearOptions(students), [students]);

    useEffect(() => { fetchStudents(); }, []);

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e) => {
            if (!e.target.closest('#year-dropdown-wrapper')) {
                setShowYearDropdown(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const fetchStudents = async () => {
        try {
            setLoading(true);
            setError(null);
            const token = localStorage.getItem('authToken');
            if (!token) throw new Error('No authentication token found');

            const response = await fetch('/api/auth/monthly-fees', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                if (response.status === 401) throw new Error('Unauthorized access. Please login again.');
                throw new Error('Failed to fetch students');
            }

            const data = await response.json();
            setStudents(data);
            setLoading(false);
        } catch (err) {
            setError(err.message);
            setLoading(false);
        }
    };

    // ── Filtered students scoped to selected academic year ──
    const filteredStudents = useMemo(() => {
        return students.filter(student => {
            const matchesSearch =
                student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                student.grade.toLowerCase().includes(searchTerm.toLowerCase()) ||
                student.parentName.toLowerCase().includes(searchTerm.toLowerCase());

            if (!matchesSearch) return false;

            if (filterStatus === 'All') return true;

            const feeInfo = calculateFeeStatus(student, selectedYear);

            switch (filterStatus) {
                case 'Paid':        return feeInfo.status === 'paid';
                case 'Due Today':   return feeInfo.status === 'due-today';
                case 'Overdue':     return feeInfo.status === 'overdue';
                case 'Past Overdue':return feeInfo.status === 'past-overdue';
                case 'Due':         return feeInfo.status === 'due' || feeInfo.status === 'due-today';
                default:            return true;
            }
        });
    }, [students, searchTerm, filterStatus, selectedYear]);

    // Pagination
    const totalPages = Math.ceil(filteredStudents.length / studentsPerPage);
    const currentStudents = filteredStudents.slice(
        (currentPage - 1) * studentsPerPage,
        currentPage * studentsPerPage
    );

    // Reset to page 1 when year or filter changes
    useEffect(() => { setCurrentPage(1); }, [selectedYear, filterStatus, searchTerm]);

    // ── Payment submission ──
    const handlePaymentSubmit = async () => {
        if (!paymentData.paymentMode || !paymentData.amount) {
            alert('Please fill in all required fields');
            return;
        }
        setIsSubmitting(true);
        try {
            const token = localStorage.getItem('authToken');
            if (!token) throw new Error('No authentication token found. Please log in again.');

            const currentFeeStatus = [...(selectedStudent.monthlyFeeStatus || [])];
            const newFeeEntry = {
                month: paymentData.month,
                paid: true,
                dueDate: new Date().toISOString(),
                paidOn: new Date().toISOString(),
                paymentMode: paymentData.paymentMode,
                amount: parseFloat(paymentData.amount)
            };

            const existingIndex = currentFeeStatus.findIndex(s => s.month === paymentData.month);
            if (existingIndex >= 0) {
                currentFeeStatus[existingIndex] = newFeeEntry;
            } else {
                currentFeeStatus.push(newFeeEntry);
            }

            const response = await fetch('/api/auth/monthly-fees', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    studentId: selectedStudent._id,
                    monthlyFeeStatus: currentFeeStatus,
                    lastFeePaidDate: new Date().toISOString()
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to update payment');
            }

            setStudents(prev => prev.map(s =>
                s._id === selectedStudent._id
                    ? { ...s, monthlyFeeStatus: currentFeeStatus, lastFeePaidDate: new Date().toISOString() }
                    : s
            ));

            setShowPaymentModal(false);
            setSelectedStudent(null);
            setPaymentData({ paymentMode: '', amount: '', month: '' });
            alert('Payment updated successfully!');
        } catch (err) {
            alert('Error updating payment: ' + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const openPaymentModal = (student) => {
        setSelectedStudent(student);
        const feeInfo = calculateFeeStatus(student, selectedYear);
        const monthToSet = (feeInfo.status === 'past-overdue' && feeInfo.unpaidMonths?.length > 0)
            ? feeInfo.unpaidMonths[0]
            : new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

        setPaymentData({ paymentMode: '', amount: '', month: monthToSet });
        setShowPaymentModal(true);
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Invalid Date';
        return date.toLocaleDateString('en-GB');
    };

    // ── Stats (scoped to selected year) ──
    const stats = useMemo(() => {
        const all = filteredStudents;
        return {
            total: students.length,
            paid: all.filter(s => calculateFeeStatus(s, selectedYear).status === 'paid').length,
            dueToday: all.filter(s => calculateFeeStatus(s, selectedYear).status === 'due-today').length,
            overdue: all.filter(s => calculateFeeStatus(s, selectedYear).status === 'overdue').length,
            pastOverdue: all.filter(s => calculateFeeStatus(s, selectedYear).status === 'past-overdue').length,
        };
    }, [filteredStudents, selectedYear, students.length]);

    // ── Status Badge ──
    const StatusBadge = ({ feeInfo }) => {
        const Icon = feeInfo.statusIcon;
        const labelMap = {
            'paid': 'Paid',
            'due-today': 'Due Today',
            'overdue': 'Overdue',
            'past-overdue': 'Past Overdue',
            'due': 'Due',
            'not-applicable': 'N/A'
        };
        return (
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium text-white ${feeInfo.statusColor}`}>
                <Icon size={12} />
                {labelMap[feeInfo.status] ?? 'Due'}
            </span>
        );
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 text-white p-6 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
            </div>
        );
    }

    if (error) {
        return (
            <Layout darkMode={darkMode} toggleDarkMode={toggleDarkMode}>
                <div className="min-h-screen bg-gray-900 text-white p-6 flex items-center justify-center">
                    <div className="text-red-400 text-center">
                        <AlertCircle size={48} className="mx-auto mb-4" />
                        <p>Error: {error}</p>
                        <button onClick={fetchStudents} className="mt-4 px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700">
                            Retry
                        </button>
                    </div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout darkMode={darkMode} toggleDarkMode={toggleDarkMode}>
            <div className="min-h-screen bg-gray-900 text-white">

                {/* ── Header ── */}
                <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
                    <div className="flex items-center justify-between flex-wrap gap-4">

                        {/* Left: title */}
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-orange-600 rounded-lg">
                                <IndianRupee size={24} className="text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-semibold">Monthly Fees</h1>
                                <p className="text-gray-400 text-sm">View and manage fee collection details</p>
                            </div>
                        </div>

                        {/* Right: academic year dropdown + date */}
                        <div className="flex items-center gap-4 flex-wrap">

                            {/* Academic Year Dropdown */}
                            <div id="year-dropdown-wrapper" className="relative">
                                <button
                                    onClick={() => setShowYearDropdown(prev => !prev)}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold transition-colors shadow"
                                >
                                    <Calendar size={16} />
                                    AY {selectedYear}
                                    <ChevronDown
                                        size={16}
                                        className={`transition-transform duration-200 ${showYearDropdown ? 'rotate-180' : ''}`}
                                    />
                                </button>

                                {showYearDropdown && (
                                    <div className="absolute right-0 mt-2 w-44 bg-gray-700 border border-gray-600 rounded-lg shadow-xl z-50 overflow-hidden">
                                        {academicYearOptions.map(year => (
                                            <button
                                                key={year}
                                                onClick={() => {
                                                    setSelectedYear(year);
                                                    setShowYearDropdown(false);
                                                    setFilterStatus('All');
                                                }}
                                                className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between
                                                    ${selectedYear === year
                                                        ? 'bg-blue-600 text-white font-semibold'
                                                        : 'text-gray-200 hover:bg-gray-600'
                                                    }`}
                                            >
                                                AY {year}
                                                {selectedYear === year && <Check size={14} />}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Date */}
                            <span className="text-sm text-gray-400">
                                {new Date().toLocaleDateString('en-GB', {
                                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                                })}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="p-6">

                    {/* ── Stats Cards ── */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                        {[
                            { label: 'Total Students', value: stats.total, color: 'bg-blue-600', Icon: IndianRupee },
                            { label: 'Paid This Year', value: stats.paid, color: 'bg-green-600', Icon: Check },
                            { label: 'Due Today', value: stats.dueToday, color: 'bg-amber-500', Icon: Clock },
                            { label: 'Overdue', value: stats.overdue, color: 'bg-red-500', Icon: AlertCircle },
                            { label: 'Past Overdue', value: stats.pastOverdue, color: 'bg-red-700', Icon: AlertCircle },
                        ].map(({ label, value, color, Icon }) => (
                            <div key={label} className="bg-gray-800 rounded-lg p-4">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 ${color} rounded-lg`}>
                                        <Icon size={18} className="text-white" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold">{value}</p>
                                        <p className="text-gray-400 text-xs">{label}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* ── Academic year info banner ── */}
                    <div className="mb-4 px-4 py-2.5 bg-blue-900/40 border border-blue-700/50 rounded-lg text-sm text-blue-300 flex items-center gap-2">
                        <Calendar size={15} />
                        Showing fee data for Academic Year <strong className="text-white">{selectedYear}</strong>
                        &nbsp;(June {selectedYear.split('-')[0]} – May 20{selectedYear.split('-')[1]})
                    </div>

                    {/* ── Search and Filters ── */}
                    <div className="bg-gray-800 rounded-lg p-4 mb-6">
                        <div className="flex flex-col gap-4">
                            <div className="relative">
                                <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search students, parents, or grade..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                                />
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:flex md:flex-wrap gap-2">
                                {['All', 'Paid', 'Due Today', 'Overdue', 'Past Overdue', 'Due'].map(filter => (
                                    <button
                                        key={filter}
                                        onClick={() => setFilterStatus(filter)}
                                        className={`px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap
                                            ${filterStatus === filter
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

                    {/* ── Students Table ── */}
                    <div className="bg-gray-800 rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-700 border-b border-gray-600">
                                    <tr>
                                        {['Student', 'Grade', 'Parent', 'Contact', 'Due Date', 'Status', 'Admission Date', 'Actions'].map(h => (
                                            <th key={h} className="text-left p-4 font-medium text-gray-300">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentStudents.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="p-8 text-center text-gray-400">
                                                No students found for the selected filters.
                                            </td>
                                        </tr>
                                    ) : currentStudents.map(student => {
                                        const feeInfo = calculateFeeStatus(student, selectedYear);
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
                                                        <span className="text-sm">
                                                            {feeInfo.unpaidMonths?.length > 0
                                                                ? `${feeInfo.unpaidMonths.length} month${feeInfo.unpaidMonths.length > 1 ? 's' : ''} unpaid`
                                                                : formatDate(feeInfo.dueDate)
                                                            }
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <StatusBadge feeInfo={feeInfo} />
                                                </td>
                                                <td className="p-4 text-gray-300">
                                                    {formatDate(student.admissionDate)}
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex items-center gap-2">
                                                        {feeInfo.unpaidMonths?.length > 0 && (
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
                                        onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                                        disabled={currentPage === 1}
                                        className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm"
                                    >
                                        Previous
                                    </button>
                                    <span className="px-3 py-1 bg-blue-600 rounded-lg text-sm font-medium">
                                        {currentPage} of {totalPages}
                                    </span>
                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
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

                {/* ── Payment Modal ── */}
                {showPaymentModal && selectedStudent && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                        <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold">Receive Fee Payment</h3>
                                <button onClick={() => setShowPaymentModal(false)} className="text-gray-400 hover:text-white">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="mb-4 p-3 bg-gray-700 rounded-lg">
                                <p className="text-sm text-gray-300">Student: <span className="font-medium text-white">{selectedStudent.name}</span></p>
                                <p className="text-sm text-gray-300">Grade: <span className="font-medium text-white">{selectedStudent.grade}</span></p>
                                <p className="text-sm text-gray-300">Academic Year: <span className="font-medium text-white">{selectedYear}</span></p>
                                {(() => {
                                    const feeInfo = calculateFeeStatus(selectedStudent, selectedYear);
                                    return feeInfo.unpaidMonths?.length > 1 && (
                                        <p className="text-sm text-red-300 mt-1">
                                            <span className="font-medium">{feeInfo.unpaidMonths.length} months unpaid in this year</span>
                                        </p>
                                    );
                                })()}
                            </div>

                            <div className="space-y-4">
                                {/* Month selector */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Month *</label>
                                    {(() => {
                                        const feeInfo = calculateFeeStatus(selectedStudent, selectedYear);
                                        return feeInfo?.unpaidMonths?.length > 1 ? (
                                            <select
                                                value={paymentData.month}
                                                onChange={(e) => setPaymentData({ ...paymentData, month: e.target.value })}
                                                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                                            >
                                                {feeInfo.unpaidMonths.map((month, idx) => (
                                                    <option key={month} value={month}>
                                                        {month}{idx < feeInfo.unpaidMonths.length - 1 ? ' (Past Due)' : ' (Current)'}
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            <input
                                                type="text"
                                                value={paymentData.month}
                                                readOnly
                                                className="w-full px-3 py-2 bg-gray-600 border border-gray-600 rounded-lg text-gray-300 cursor-not-allowed"
                                            />
                                        );
                                    })()}
                                </div>

                                {/* Payment mode */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Payment Mode *</label>
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

                                {/* Amount */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Amount *</label>
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
                                        disabled={isSubmitting}
                                        className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors 
                                            ${isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
                                    >
                                        {isSubmitting ? 'Processing...' : 'Receive Payment'}
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
