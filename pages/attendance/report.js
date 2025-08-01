import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users, Calendar, AlertCircle, ArrowUpDown, ArrowUp, ArrowDown, Download, Share, FileText } from 'lucide-react';
import Layout from '@/components/Layout';

const GradeAttendanceReportWithPDF = () => {
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState('grade');
  const [sortOrder, setSortOrder] = useState('asc');
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [availableMonths, setAvailableMonths] = useState([]);

  useEffect(() => {
    fetchAvailableMonths();
  }, []);

  useEffect(() => {
    if (selectedMonth) {
      fetchReportData();
    }
  }, [selectedMonth]);

  const fetchAvailableMonths = async () => {
    try {
      const response = await fetch('/api/attendance/available-months');
      if (response.ok) {
        const data = await response.json();
        setAvailableMonths(data.availableMonths);
        // Set current month as default
        setSelectedMonth(data.currentMonth);
      }
    } catch (err) {
      console.error('Error fetching available months:', err);
      // Fallback to current month
      setSelectedMonth(new Date().toLocaleString('default', { month: 'long' }));
    }
  };

  const fetchReportData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/attendance/grade-report?month=${selectedMonth}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setReportData(data);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching report data:', err);
    } finally {
      setLoading(false);
    }
  };

  // PDF Generation Functions
  // PDF Generation Functions - Fixed Version
  const generateAttendanceReportPDF = async (reportData) => {
    const jsPDF = (await import('jspdf')).default;
    const autoTable = (await import('jspdf-autotable')).default;

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    let yPosition = 20;

    const checkPageBreak = (neededHeight) => {
      if (yPosition + neededHeight > pageHeight - 20) {
        pdf.addPage();
        yPosition = 20;
      }
    };

    // === HEADER WITH LOGO (graduation cap) ===
    const logoPath = `${window.location.origin}/graduation-cap4.jpg`;
    const logoImg = new Image();
    logoImg.src = logoPath;

    const logoHeight = 20;
    const logoWidth = 20;

    await new Promise((resolve) => {
      logoImg.onload = () => {
        pdf.addImage(logoImg, 'PNG', 20, yPosition - 2, logoWidth, logoHeight);
        resolve();
      };
    });

    // Title - much closer to logo
    pdf.setFontSize(28);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(31, 41, 55);
    pdf.text('SK Tutorial', 38, yPosition + 12);
    // Subtitle
    yPosition += 18;
    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(31, 41, 55);
    pdf.text('Grade-wise Attendance Report', 20, yPosition);

    // Tagline
    yPosition += 8;
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'italic');
    pdf.setTextColor(90, 90, 90);
    pdf.text('Comprehensive attendance analysis by grade level', 20, yPosition);

    // Metadata
    yPosition += 8;
    pdf.setFontSize(10);
    pdf.setTextColor(120, 120, 120);
    const reportDate = new Date().toLocaleDateString();
    const reportTime = new Date().toLocaleTimeString();
    pdf.text(`Generated on: ${reportDate} at ${reportTime}`, 20, yPosition);

    if (reportData.metadata) {
      yPosition += 4;
      pdf.text(`Report Period: ${reportData.metadata.reportMonth} ${reportData.metadata.reportYear}`, 20, yPosition);
    }

    yPosition += 15;

    // === ICON PATHS (from public folder) ===
    const icons = {
      best: `${window.location.origin}/tick.png`,
      attention: `${window.location.origin}/cross.png`,
      absence: `${window.location.origin}/cross-2.png`,
      late: `${window.location.origin}/late.png`,
    };

    // === KEY INSIGHTS ===
    if (reportData?.insights) {
      checkPageBreak(50);
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(31, 41, 55);
      pdf.text('Key Insights', 20, yPosition);
      yPosition += 10;

      const cardWidth = (pageWidth - 50) / 2;
      const cardHeight = 28;
      const cardSpacing = 7;

      const drawCard = async (x, y, bgColor, borderColor, iconPath, title, value, desc, textColor) => {
        pdf.setFillColor(...bgColor);
        pdf.setDrawColor(...borderColor);
        pdf.roundedRect(x, y, cardWidth, cardHeight, 3, 3, 'FD');

        const iconImg = new Image();
        iconImg.src = iconPath;

        await new Promise((resolve) => {
          iconImg.onload = () => {
            pdf.addImage(iconImg, 'PNG', x + 3, y + 6, 6, 6); // Icon inside card
            resolve();
          };
        });

        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(...textColor);
        pdf.text(title, x + 12, y + 8);

        pdf.setFontSize(16);
        pdf.text(value, x + 12, y + 16);

        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.text(desc, x + 12, y + 22);
      };

      // Draw cards with icons
      await drawCard(20, yPosition, [220, 252, 231], [187, 247, 208], icons.best,
        'Best Attendance', `${reportData.insights.highestAttendance?.rate || 0}%`,
        `Grade ${reportData.insights.highestAttendance?.grade || 'N/A'} leads`, [22, 163, 74]);

      await drawCard(30 + cardWidth, yPosition, [254, 242, 242], [252, 165, 165], icons.attention,
        'Needs Attention', `${reportData.insights.lowestAttendance?.rate || 0}%`,
        `Grade ${reportData.insights.lowestAttendance?.grade || 'N/A'} lowest`, [220, 38, 38]);

      yPosition += cardHeight + cardSpacing;

      await drawCard(20, yPosition, [255, 247, 237], [253, 186, 116], icons.absence,
        'Most Absences', `${reportData.insights.mostAbsent?.count || 0}%`,
        `Grade ${reportData.insights.mostAbsent?.grade || 'N/A'} highest rate`, [234, 88, 12]);

      await drawCard(30 + cardWidth, yPosition, [254, 249, 195], [253, 224, 71], icons.late,
        'Most Late Arrivals', `${reportData.insights.mostLate?.count || 0}%`,
        `Grade ${reportData.insights.mostLate?.grade || 'N/A'} most late`, [217, 119, 6]);

      yPosition += cardHeight + 15;
    }

    // === GRADE-WISE STATISTICS TABLE ===
    if (reportData?.gradeStats && reportData.gradeStats.length > 0) {
      checkPageBreak(60);
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(31, 41, 55);
      pdf.text('Grade-wise Statistics', 20, yPosition);
      yPosition += 10;

      const gradeTableColumns = ['Grade', 'Students', 'Present %', 'Absent %', 'Late %', 'Rate'];
      const gradeTableRows = reportData.gradeStats.map(grade => [
        grade.grade,
        grade.totalStudents.toString(),
        `${grade.present}%`,
        `${grade.absent}%`,
        `${grade.late}%`,
        `${grade.attendanceRate}%`
      ]);

      autoTable(pdf, {
        head: [gradeTableColumns],
        body: gradeTableRows,
        startY: yPosition,
        theme: 'striped',
        headStyles: { fillColor: [240, 240, 240], textColor: [75, 85, 99], fontStyle: 'bold' },
        bodyStyles: { fontSize: 9, textColor: [31, 41, 55] },
        alternateRowStyles: { fillColor: [249, 250, 251] },
        margin: { left: 20, right: 20 }
      });

      yPosition = pdf.lastAutoTable.finalY + 15;
    }

    // === STUDENT DETAILS TABLE ===
    if (reportData?.studentDetails && reportData.studentDetails.length > 0) {
      checkPageBreak(60);
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(31, 41, 55);
      pdf.text('Student Attendance Details', 20, yPosition);
      yPosition += 10;

      const studentTableColumns = ['Student Name', 'Grade', 'Days', 'Present', 'Absent', 'Late', 'Rate'];
      const studentTableRows = reportData.studentDetails.map(student => [
        student.studentName,
        student.grade,
        student.totalDays.toString(),
        student.present.toString(),
        student.absent.toString(),
        student.late.toString(),
        `${student.attendanceRate?.toFixed(1) || 0}%`
      ]);

      autoTable(pdf, {
        head: [studentTableColumns],
        body: studentTableRows,
        startY: yPosition,
        theme: 'striped',
        headStyles: { fillColor: [240, 240, 240], textColor: [75, 85, 99], fontStyle: 'bold' },
        bodyStyles: { fontSize: 8, textColor: [31, 41, 55] },
        alternateRowStyles: { fillColor: [249, 250, 251] },
        margin: { left: 20, right: 20 },
        didParseCell: function (data) {
          if (data.column.index === 6 && data.section === 'body') {
            const percentage = parseFloat(data.cell.text[0]);
            if (percentage >= 90) data.cell.styles.textColor = [22, 163, 74];
            else if (percentage >= 75) data.cell.styles.textColor = [217, 119, 6];
            else data.cell.styles.textColor = [220, 38, 38];
          }
        }
      });
    }

    // === FOOTER ===
    // === FOOTER ===
    const signatureText = "Created by Fahim Sir [CEO & Co-founder]  |  SK Tutorial";
    const totalPages = pdf.internal.getNumberOfPages();

    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);

      // First line: Page number + system info (Left), Date (Right)
      pdf.setFontSize(8);
      pdf.setTextColor(107, 114, 128);
      pdf.text(`Page ${i} of ${totalPages} | SK Tutorial Admin System`, 20, pageHeight - 12);
      pdf.text(`${new Date().toLocaleDateString()}`, pageWidth - 40, pageHeight - 12);

      // Second line: Signature (Left, below first line)
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'italic');
      pdf.setTextColor(107, 114, 128);
      pdf.text(signatureText, 20, pageHeight - 6);
    }

    return pdf;
  };



  const downloadPDF = async () => {
    if (!reportData) return;

    try {
      setPdfGenerating(true);
      const pdf = await generateAttendanceReportPDF(reportData);
      const filename = `grade-attendance-report-${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(filename);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setPdfGenerating(false);
    }
  };

  const sharePDF = async () => {
    if (!reportData) return;

    try {
      setPdfGenerating(true);
      const pdf = await generateAttendanceReportPDF(reportData);
      const pdfBlob = pdf.output('blob');

      if (navigator.share && navigator.canShare({ files: [new File([pdfBlob], 'attendance-report.pdf', { type: 'application/pdf' })] })) {
        const file = new File([pdfBlob], 'grade-attendance-report.pdf', { type: 'application/pdf' });
        await navigator.share({
          title: 'Grade-wise Attendance Report',
          text: 'Please find the grade-wise attendance report attached.',
          files: [file]
        });
      } else {
        // Fallback to download
        const filename = `grade-attendance-report-${new Date().toISOString().split('T')[0]}.pdf`;
        pdf.save(filename);
      }
    } catch (error) {
      console.error('Error sharing PDF:', error);
      alert('Failed to share PDF. Please try again.');
    } finally {
      setPdfGenerating(false);
    }
  };

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const getSortedStudents = () => {
    if (!reportData?.studentDetails) return [];

    return [...reportData.studentDetails].sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];

      if (sortBy === 'grade') {
        aValue = parseInt(a.grade);
        bValue = parseInt(b.grade);
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  };

  const SortIcon = ({ column }) => {
    if (sortBy !== column) {
      return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
    }
    return sortOrder === 'asc' ?
      <ArrowUp className="w-4 h-4 text-blue-600" /> :
      <ArrowDown className="w-4 h-4 text-blue-600" />;
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-800">{`Grade: ${label}`}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {`${entry.name}: ${entry.value}%`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm p-8">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
              <div className="h-64 bg-gray-200 rounded mb-8"></div>
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-12 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm p-8">
            <div className="text-center">
              <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-800 mb-2">Error Loading Report</h2>
              <p className="text-gray-600 mb-4">{error}</p>
              <button
                onClick={fetchReportData}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm p-8">
            <div className="text-center">
              <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-800 mb-2">No Data Available</h2>
              <p className="text-gray-600">No attendance data found for the selected period.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const sortedStudents = getSortedStudents();

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 p-4 md:p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-800 mb-2">
                Grade-wise Attendance Report
              </h1>
              <p className="text-sm md:text-base text-gray-600">Comprehensive attendance analysis by grade level</p>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              {/* Month Selector */}
              <div className="w-full sm:w-auto">
                <label className="block text-xs font-medium text-gray-700 mb-1">Select Month</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full sm:w-44 px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 shadow-sm hover:border-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-all duration-200 appearance-none cursor-pointer"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                    backgroundPosition: 'right 0.5rem center',
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: '1.5em 1.5em',
                    paddingRight: '2.5rem'
                  }}
                >
                  {availableMonths.map(month => (
                    <option key={month} value={month} className="py-2 text-gray-700">
                      {month}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                <button
                  onClick={downloadPDF}
                  disabled={pdfGenerating}
                  className="flex-1 sm:flex-none bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {pdfGenerating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span className="hidden sm:inline">Generating...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span className="hidden sm:inline">Download</span>
                      <span className="sm:hidden">PDF</span>
                    </>
                  )}
                </button>
                <button
                  onClick={sharePDF}
                  disabled={pdfGenerating}
                  className="flex-1 sm:flex-none bg-purple-600 text-white px-3 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {pdfGenerating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span className="hidden sm:inline">Generating...</span>
                    </>
                  ) : (
                    <>
                      <Share className="w-4 h-4" />
                      <span className="hidden sm:inline">Share</span>
                    </>
                  )}
                </button>
                <button
                  onClick={fetchReportData}
                  className="flex-1 sm:flex-none bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <TrendingUp className="w-4 h-4" />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
              </div>
            </div>
          </div>

          {/* Chart Section */}
          {reportData?.gradeStats && reportData.gradeStats.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-6">Attendance Distribution by Grade</h2>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reportData.gradeStats} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="grade"
                      stroke="#666"
                      fontSize={12}
                    />
                    <YAxis
                      stroke="#666"
                      fontSize={12}
                      label={{ value: 'Percentage (%)', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar
                      dataKey="present"
                      stackId="a"
                      fill="#10b981"
                      name="Present"
                      radius={[0, 0, 0, 0]}
                    />
                    <Bar
                      dataKey="late"
                      stackId="a"
                      fill="#f59e0b"
                      name="Late"
                      radius={[0, 0, 0, 0]}
                    />
                    <Bar
                      dataKey="absent"
                      stackId="a"
                      fill="#ef4444"
                      name="Absent"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Student Details Table */}
          {reportData?.studentDetails && reportData.studentDetails.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-800">Student Attendance Details</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('studentName')}
                      >
                        <div className="flex items-center gap-2">
                          Student Name
                          <SortIcon column="studentName" />
                        </div>
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('grade')}
                      >
                        <div className="flex items-center gap-2">
                          Grade
                          <SortIcon column="grade" />
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Days
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Present
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Absent
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Late
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('attendanceRate')}
                      >
                        <div className="flex items-center gap-2">
                          Attendance %
                          <SortIcon column="attendanceRate" />
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sortedStudents.map((student, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{student.studentName}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {student.grade}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {student.totalDays}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                          {student.present}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">
                          {student.absent}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-yellow-600 font-medium">
                          {student.late}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="text-sm font-medium text-gray-900">
                              {student.attendanceRate?.toFixed(1) || 0}%
                            </div>
                            <div className="ml-2 w-16 bg-gray-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${(student.attendanceRate || 0) >= 90 ? 'bg-green-500' :
                                  (student.attendanceRate || 0) >= 75 ? 'bg-yellow-500' : 'bg-red-500'
                                  }`}
                                style={{ width: `${student.attendanceRate || 0}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Insights Section */}
          {reportData?.insights && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border border-green-200">
                <div className="flex items-center justify-between mb-2">
                  <TrendingUp className="w-8 h-8 text-green-600" />
                  <span className="text-2xl font-bold text-green-700">
                    {reportData.insights.highestAttendance?.rate || 0}%
                  </span>
                </div>
                <h3 className="font-semibold text-green-800 mb-1">Best Attendance</h3>
                <p className="text-green-600 text-sm">
                  Grade {reportData.insights.highestAttendance?.grade || 'N/A'} leads with highest attendance
                </p>
              </div>

              <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-6 border border-red-200">
                <div className="flex items-center justify-between mb-2">
                  <AlertCircle className="w-8 h-8 text-red-600" />
                  <span className="text-2xl font-bold text-red-700">
                    {reportData.insights.lowestAttendance?.rate || 0}%
                  </span>
                </div>
                <h3 className="font-semibold text-red-800 mb-1">Needs Attention</h3>
                <p className="text-red-600 text-sm">
                  Grade {reportData.insights.lowestAttendance?.grade || 'N/A'} has lowest attendance
                </p>
              </div>

              <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-6 border border-orange-200">
                <div className="flex items-center justify-between mb-2">
                  <Users className="w-8 h-8 text-orange-600" />
                  <span className="text-2xl font-bold text-orange-700">
                    {reportData.insights.mostAbsent?.count || 0}%
                  </span>
                </div>
                <h3 className="font-semibold text-orange-800 mb-1">Most Absences</h3>
                <p className="text-orange-600 text-sm">
                  Grade {reportData.insights.mostAbsent?.grade || 'N/A'} has highest absence rate
                </p>
              </div>

              <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-6 border border-yellow-200">
                <div className="flex items-center justify-between mb-2">
                  <Calendar className="w-8 h-8 text-yellow-600" />
                  <span className="text-2xl font-bold text-yellow-700">
                    {reportData.insights.mostLate?.count || 0}%
                  </span>
                </div>
                <h3 className="font-semibold text-yellow-800 mb-1">Most Late Arrivals</h3>
                <p className="text-yellow-600 text-sm">
                  Grade {reportData.insights.mostLate?.grade || 'N/A'} has most late arrivals
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default GradeAttendanceReportWithPDF;