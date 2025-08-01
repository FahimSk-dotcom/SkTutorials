// utils/generateAttendancePDF.js
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';

export const generateAttendanceReportPDF = async (reportData) => {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  let yPosition = 20;

  // Helper function to add page break if needed
  const checkPageBreak = (neededHeight) => {
    if (yPosition + neededHeight > pageHeight - 20) {
      pdf.addPage();
      yPosition = 20;
    }
  };

  // Title Section
  pdf.setFontSize(24);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(31, 41, 55); // gray-800
  pdf.text('Grade-wise Attendance Report', 20, yPosition);
  
  yPosition += 8;
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(75, 85, 99); // gray-600
  pdf.text('Comprehensive attendance analysis by grade level', 20, yPosition);
  
  // Report metadata
  yPosition += 8;
  pdf.setFontSize(10);
  pdf.setTextColor(107, 114, 128); // gray-500
  const reportDate = new Date().toLocaleDateString();
  const reportTime = new Date().toLocaleTimeString();
  pdf.text(`Generated on: ${reportDate} at ${reportTime}`, 20, yPosition);
  
  if (reportData.metadata) {
    yPosition += 4;
    pdf.text(`Report Period: ${reportData.metadata.reportMonth} ${reportData.metadata.reportYear}`, 20, yPosition);
    yPosition += 4;
    pdf.text(`Total Students: ${reportData.metadata.totalStudents} | Total Grades: ${reportData.metadata.totalGrades}`, 20, yPosition);
  }

  yPosition += 15;

  // Insights Section (Cards)
  if (reportData?.insights) {
    checkPageBreak(45);
    
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(31, 41, 55);
    pdf.text('Key Insights', 20, yPosition);
    yPosition += 10;

    // Create insight cards in a 2x2 grid
    const cardWidth = (pageWidth - 50) / 2;
    const cardHeight = 25;
    const cardSpacing = 5;

    // Best Attendance Card
    pdf.setFillColor(220, 252, 231); // green-50
    pdf.setDrawColor(187, 247, 208); // green-200
    pdf.rect(20, yPosition, cardWidth, cardHeight, 'FD');
    
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(22, 163, 74); // green-600
    pdf.text('Best Attendance', 25, yPosition + 6);
    
    pdf.setFontSize(18);
    pdf.text(`${reportData.insights.highestAttendance?.rate || 0}%`, 25, yPosition + 12);
    
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Grade ${reportData.insights.highestAttendance?.grade || 'N/A'} leads with highest attendance`, 25, yPosition + 18);

    // Needs Attention Card
    pdf.setFillColor(254, 242, 242); // red-50
    pdf.setDrawColor(252, 165, 165); // red-200
    pdf.rect(30 + cardWidth, yPosition, cardWidth, cardHeight, 'FD');
    
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(220, 38, 38); // red-600
    pdf.text('Needs Attention', 35 + cardWidth, yPosition + 6);
    
    pdf.setFontSize(18);
    pdf.text(`${reportData.insights.lowestAttendance?.rate || 0}%`, 35 + cardWidth, yPosition + 12);
    
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Grade ${reportData.insights.lowestAttendance?.grade || 'N/A'} has lowest attendance`, 35 + cardWidth, yPosition + 18);

    yPosition += cardHeight + cardSpacing;

    // Most Absences Card
    pdf.setFillColor(255, 247, 237); // orange-50
    pdf.setDrawColor(253, 186, 116); // orange-200
    pdf.rect(20, yPosition, cardWidth, cardHeight, 'FD');
    
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(234, 88, 12); // orange-600
    pdf.text('Most Absences', 25, yPosition + 6);
    
    pdf.setFontSize(18);
    pdf.text(`${reportData.insights.mostAbsent?.count || 0}%`, 25, yPosition + 12);
    
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Grade ${reportData.insights.mostAbsent?.grade || 'N/A'} has highest absence rate`, 25, yPosition + 18);

    // Most Late Arrivals Card
    pdf.setFillColor(254, 249, 195); // yellow-50
    pdf.setDrawColor(253, 224, 71); // yellow-200
    pdf.rect(30 + cardWidth, yPosition, cardWidth, cardHeight, 'FD');
    
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(217, 119, 6); // yellow-600
    pdf.text('Most Late Arrivals', 35 + cardWidth, yPosition + 6);
    
    pdf.setFontSize(18);
    pdf.text(`${reportData.insights.mostLate?.count || 0}%`, 35 + cardWidth, yPosition + 12);
    
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Grade ${reportData.insights.mostLate?.grade || 'N/A'} has most late arrivals`, 35 + cardWidth, yPosition + 18);

    yPosition += cardHeight + 15;
  }

  // Grade Statistics Table
  if (reportData?.gradeStats && reportData.gradeStats.length > 0) {
    checkPageBreak(60);
    
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(31, 41, 55);
    pdf.text('Grade-wise Statistics', 20, yPosition);
    yPosition += 10;

    const gradeTableColumns = [
      'Grade',
      'Total Students',
      'Present %',
      'Absent %',
      'Late %',
      'Attendance Rate'
    ];

    const gradeTableRows = reportData.gradeStats.map(grade => [
      grade.grade,
      grade.totalStudents.toString(),
      `${grade.present}%`,
      `${grade.absent}%`,
      `${grade.late}%`,
      `${grade.attendanceRate}%`
    ]);

    pdf.autoTable({
      head: [gradeTableColumns],
      body: gradeTableRows,
      startY: yPosition,
      theme: 'striped',
      headStyles: {
        fillColor: [249, 250, 251], // gray-50
        textColor: [75, 85, 99], // gray-600
        fontStyle: 'bold',
        fontSize: 10
      },
      bodyStyles: {
        fontSize: 9,
        textColor: [31, 41, 55] // gray-800
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251] // gray-50
      },
      margin: { left: 20, right: 20 },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 30 },
        2: { cellWidth: 25, textColor: [22, 163, 74] }, // green-600
        3: { cellWidth: 25, textColor: [220, 38, 38] }, // red-600
        4: { cellWidth: 25, textColor: [217, 119, 6] }, // yellow-600
        5: { cellWidth: 35, fontStyle: 'bold' }
      }
    });

    yPosition = pdf.lastAutoTable.finalY + 15;
  }

  // Student Details Table
  if (reportData?.studentDetails && reportData.studentDetails.length > 0) {
    checkPageBreak(60);
    
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(31, 41, 55);
    pdf.text('Student Attendance Details', 20, yPosition);
    yPosition += 10;

    const studentTableColumns = [
      'Student Name',
      'Grade',
      'Total Days',
      'Present',
      'Absent',
      'Late',
      'Attendance %'
    ];

    const studentTableRows = reportData.studentDetails.map(student => [
      student.studentName,
      student.grade,
      student.totalDays.toString(),
      student.present.toString(),
      student.absent.toString(),
      student.late.toString(),
      `${student.attendanceRate?.toFixed(1) || 0}%`
    ]);

    pdf.autoTable({
      head: [studentTableColumns],
      body: studentTableRows,
      startY: yPosition,
      theme: 'striped',
      headStyles: {
        fillColor: [249, 250, 251], // gray-50
        textColor: [75, 85, 99], // gray-600
        fontStyle: 'bold',
        fontSize: 10
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [31, 41, 55] // gray-800
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251] // gray-50
      },
      margin: { left: 20, right: 20 },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 25, halign: 'center' },
        3: { cellWidth: 20, halign: 'center', textColor: [22, 163, 74] }, // green-600
        4: { cellWidth: 20, halign: 'center', textColor: [220, 38, 38] }, // red-600
        5: { cellWidth: 20, halign: 'center', textColor: [217, 119, 6] }, // yellow-600
        6: { cellWidth: 25, halign: 'center', fontStyle: 'bold' }
      },
      didParseCell: function(data) {
        // Color code attendance percentage
        if (data.column.index === 6 && data.section === 'body') {
          const percentage = parseFloat(data.cell.text[0]);
          if (percentage >= 90) {
            data.cell.styles.textColor = [22, 163, 74]; // green-600
          } else if (percentage >= 75) {
            data.cell.styles.textColor = [217, 119, 6]; // yellow-600
          } else {
            data.cell.styles.textColor = [220, 38, 38]; // red-600
          }
        }
      }
    });
  }

  // Footer
  const totalPages = pdf.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(107, 114, 128); // gray-500
    pdf.text(
      `Page ${i} of ${totalPages} | Generated by Tutorial Center Admin System`,
      20,
      pageHeight - 10
    );
    pdf.text(
      `Report Date: ${new Date().toLocaleDateString()}`,
      pageWidth - 60,
      pageHeight - 10
    );
  }

  return pdf;
};

// Function to download PDF
export const downloadAttendanceReportPDF = async (reportData, filename = 'grade-attendance-report.pdf') => {
  try {
    const pdf = await generateAttendanceReportPDF(reportData);
    pdf.save(filename);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF report');
  }
};

// Function to get PDF as blob for sharing
export const getAttendanceReportPDFBlob = async (reportData) => {
  try {
    const pdf = await generateAttendanceReportPDF(reportData);
    return pdf.output('blob');
  } catch (error) {
    console.error('Error generating PDF blob:', error);
    throw new Error('Failed to generate PDF report');
  }
};