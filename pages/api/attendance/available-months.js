// pages/api/attendance/available-months.js
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
    
    const { year } = req.query;
    const reportYear = year ? parseInt(year) : new Date().getFullYear();

    // Get all available months with attendance data
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
      }
    ];

    const availableMonthsResult = await attendanceCollection.aggregate(pipeline).toArray();
    const months = availableMonthsResult.map(month => month._id);

    // Sort months in chronological order
    const monthOrder = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const sortedMonths = months.sort((a, b) => {
      return monthOrder.indexOf(a) - monthOrder.indexOf(b);
    });

    // Get available years
    const yearsResult = await attendanceCollection.distinct('year');
    const availableYears = yearsResult.sort((a, b) => b - a); // Sort descending (newest first)

    res.status(200).json({
      availableMonths: sortedMonths,
      availableYears: availableYears,
      currentYear: reportYear,
      currentMonth: new Date().toLocaleString('default', { month: 'long' })
    });

  } catch (error) {
    console.error('Error getting available months:', error);
    res.status(500).json({ 
      message: 'Internal server error', 
      error: error.message 
    });
  }
}