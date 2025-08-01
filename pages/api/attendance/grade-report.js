// pages/api/attendance/grade-report.js
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

async function connectToDatabase() {
  try {
    await client.connect();
    return client.db(process.env.DB_NAME || 'sk-tutorial');
  } catch (error) {
    console.error('Database connection failed:', error);
    throw error;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const db = await connectToDatabase();
    const attendanceCollection = db.collection('students-attendance');

    // Get year and month from query parameters or use current date as default
    const { month, year } = req.query;
    
    const reportYear = year ? parseInt(year) : new Date().getFullYear();
    const reportMonth = month || new Date().toLocaleString('default', { month: 'long' });

    // Validate month name
    const validMonths = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    if (!validMonths.includes(reportMonth)) {
      return res.status(400).json({ 
        message: 'Invalid month. Please provide a valid month name (e.g., January, February, etc.)' 
      });
    }

    // MongoDB Aggregation Pipeline
    const pipeline = [
      {
        $match: {
          year: reportYear,
          [`months.${reportMonth}`]: { $exists: true, $ne: [] }
        }
      },
      {
        $addFields: {
          currentMonthData: `$months.${reportMonth}`
        }
      },
      {
        $unwind: "$currentMonthData"
      },
      {
        $group: {
          _id: {
            studentId: "$studentId",
            studentName: "$studentName",
            studentGrade: "$studentGrade"
          },
          totalDays: { $sum: 1 },
          presentDays: {
            $sum: {
              $cond: [{ $eq: ["$currentMonthData.status", "present"] }, 1, 0]
            }
          },
          absentDays: {
            $sum: {
              $cond: [{ $eq: ["$currentMonthData.status", "absent"] }, 1, 0]
            }
          },
          lateDays: {
            $sum: {
              $cond: [{ $eq: ["$currentMonthData.status", "late"] }, 1, 0]
            }
          }
        }
      },
      {
        $addFields: {
          attendanceRate: {
            $multiply: [
              { $divide: ["$presentDays", "$totalDays"] },
              100
            ]
          }
        }
      },
      {
        $sort: { "_id.studentGrade": 1, "_id.studentName": 1 }
      }
    ];

    const studentData = await attendanceCollection.aggregate(pipeline).toArray();

    if (!studentData || studentData.length === 0) {
      return res.status(200).json({
        gradeStats: [],
        studentDetails: [],
        insights: {
          highestAttendance: { grade: 'N/A', rate: 0 },
          lowestAttendance: { grade: 'N/A', rate: 0 },
          mostAbsent: { grade: 'N/A', count: 0 },
          mostLate: { grade: 'N/A', count: 0 }
        },
        metadata: {
          totalStudents: 0,
          totalGrades: 0,
          reportMonth: reportMonth,
          reportYear: reportYear,
          generatedAt: new Date().toISOString()
        }
      });
    }

    // Process student details for table
    const studentDetails = studentData.map(student => ({
      studentName: student._id.studentName,
      grade: student._id.studentGrade,
      totalDays: student.totalDays,
      present: student.presentDays,
      absent: student.absentDays,
      late: student.lateDays,
      attendanceRate: parseFloat(student.attendanceRate.toFixed(1))
    }));

    // Calculate grade-wise statistics
    const gradeStatsMap = new Map();

    studentData.forEach(student => {
      const grade = student._id.studentGrade;
      
      if (!gradeStatsMap.has(grade)) {
        gradeStatsMap.set(grade, {
          grade,
          totalStudents: 0,
          totalDays: 0,
          totalPresent: 0,
          totalAbsent: 0,
          totalLate: 0
        });
      }

      const gradeData = gradeStatsMap.get(grade);
      gradeData.totalStudents += 1;
      gradeData.totalDays += student.totalDays;
      gradeData.totalPresent += student.presentDays;
      gradeData.totalAbsent += student.absentDays;
      gradeData.totalLate += student.lateDays;
    });

    // Convert to array and calculate percentages
    const gradeStats = Array.from(gradeStatsMap.values()).map(grade => {
      const totalPossibleDays = grade.totalStudents * (grade.totalDays / grade.totalStudents);
      
      return {
        grade: grade.grade,
        present: parseFloat(((grade.totalPresent / totalPossibleDays) * 100).toFixed(1)),
        absent: parseFloat(((grade.totalAbsent / totalPossibleDays) * 100).toFixed(1)),
        late: parseFloat(((grade.totalLate / totalPossibleDays) * 100).toFixed(1)),
        totalStudents: grade.totalStudents,
        attendanceRate: parseFloat(((grade.totalPresent / totalPossibleDays) * 100).toFixed(1))
      };
    });

    // Sort grades naturally (1st, 2nd, 3rd, etc.)
    gradeStats.sort((a, b) => {
      const gradeA = parseInt(a.grade.replace(/\D/g, ''));
      const gradeB = parseInt(b.grade.replace(/\D/g, ''));
      return gradeA - gradeB;
    });

    // Calculate insights
    const insights = calculateInsights(gradeStats);

    const response = {
      gradeStats,
      studentDetails,
      insights,
      metadata: {
        totalStudents: studentDetails.length,
        totalGrades: gradeStats.length,
        reportMonth: reportMonth,
        reportYear: reportYear,
        generatedAt: new Date().toISOString()
      }
    };

    res.status(200).json(response);

  } catch (error) {
    console.error('Error generating grade report:', error);
    res.status(500).json({ 
      message: 'Internal server error', 
      error: error.message 
    });
  }
}

// Helper function to get available months with data
export async function getAvailableMonths(req, res) {
  try {
    const db = await connectToDatabase();
    const attendanceCollection = db.collection('students-attendance');
    
    const { year } = req.query;
    const reportYear = year ? parseInt(year) : new Date().getFullYear();

    const pipeline = [
      {
        $match: { year: reportYear }
      },
      {
        $project: {
          monthsWithData: {
            $objectToArray: "$months"
          }
        }
      },
      {
        $unwind: "$monthsWithData"
      },
      {
        $match: {
          "monthsWithData.v": { $ne: [], $exists: true }
        }
      },
      {
        $group: {
          _id: "$monthsWithData.k"
        }
      },
      {
        $sort: { "_id": 1 }
      }
    ];

    const availableMonths = await attendanceCollection.aggregate(pipeline).toArray();
    const months = availableMonths.map(month => month._id);

    return res.status(200).json({
      availableMonths: months,
      year: reportYear
    });

  } catch (error) {
    console.error('Error getting available months:', error);
    return res.status(500).json({ 
      message: 'Internal server error', 
      error: error.message 
    });
  }
}

function calculateInsights(gradeStats) {
  if (!gradeStats || gradeStats.length === 0) {
    return {
      highestAttendance: { grade: 'N/A', rate: 0 },
      lowestAttendance: { grade: 'N/A', rate: 0 },
      mostAbsent: { grade: 'N/A', count: 0 },
      mostLate: { grade: 'N/A', count: 0 }
    };
  }

  // Find highest attendance
  const highestAttendance = gradeStats.reduce((prev, current) => 
    (prev.attendanceRate > current.attendanceRate) ? prev : current
  );

  // Find lowest attendance
  const lowestAttendance = gradeStats.reduce((prev, current) => 
    (prev.attendanceRate < current.attendanceRate) ? prev : current
  );

  // Find most absent
  const mostAbsent = gradeStats.reduce((prev, current) => 
    (prev.absent > current.absent) ? prev : current
  );

  // Find most late
  const mostLate = gradeStats.reduce((prev, current) => 
    (prev.late > current.late) ? prev : current
  );

  return {
    highestAttendance: { 
      grade: highestAttendance.grade, 
      rate: highestAttendance.attendanceRate 
    },
    lowestAttendance: { 
      grade: lowestAttendance.grade, 
      rate: lowestAttendance.attendanceRate 
    },
    mostAbsent: { 
      grade: mostAbsent.grade, 
      count: mostAbsent.absent 
    },
    mostLate: { 
      grade: mostLate.grade, 
      count: mostLate.late 
    }
  };
}