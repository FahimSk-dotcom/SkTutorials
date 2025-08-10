import { MongoClient, ObjectId } from 'mongodb';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// MongoDB connection
let cachedClient = null;

async function connectToDatabase() {
    if (cachedClient) {
        return cachedClient;
    }

    try {
        const client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
        cachedClient = client;
        return client;
    } catch (error) {
        console.error('MongoDB connection error:', error);
        throw error;
    }
}

// Delete image from Cloudinary
async function deleteFromCloudinary(imageUrl) {
    try {
        if (!imageUrl) return;
        
        // Extract public ID from Cloudinary URL
        const publicId = imageUrl.split('/').pop().split('.')[0];
        const fullPublicId = `students/${publicId}`;
        
        await cloudinary.uploader.destroy(fullPublicId);
    } catch (error) {
        console.error('Cloudinary delete error:', error);
        // Don't throw error, just log it
    }
}

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'DELETE') {
        return res.status(405).json({
            success: false,
            error: 'Method not allowed'
        });
    }

    try {
        // Extract student ID from URL or request body
        const studentId = req.query.id || req.body?.studentId;

        if (!studentId || !ObjectId.isValid(studentId)) {
            return res.status(400).json({
                success: false,
                error: 'Valid student ID is required'
            });
        }

        // Connect to MongoDB
        const client = await connectToDatabase();
        const db = client.db('sk-tutorial');
        const collection = db.collection('studentsData');

        // Get student data before deletion (to delete photo from Cloudinary)
        const student = await collection.findOne({ _id: new ObjectId(studentId) });
        
        if (!student) {
            return res.status(404).json({
                success: false,
                error: 'Student not found'
            });
        }

        // Delete student from database
        const result = await collection.deleteOne({ _id: new ObjectId(studentId) });

        if (result.deletedCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Student not found'
            });
        }

        // Delete photo from Cloudinary if exists
        if (student.photoUrl) {
            await deleteFromCloudinary(student.photoUrl);
        }

        res.status(200).json({
            success: true,
            message: 'Student deleted successfully',
            deletedStudent: {
                id: studentId,
                name: student.studentName,
                class: student.class
            }
        });

    } catch (error) {
        console.error('DELETE Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete student',
            details: error.message
        });
    }
}