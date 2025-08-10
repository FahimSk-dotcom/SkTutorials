import { MongoClient, ObjectId } from 'mongodb';
import { v2 as cloudinary } from 'cloudinary';
import formidable from 'formidable';
import fs from 'fs';

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Disable Next.js default body parser for file uploads
export const config = {
    api: {
        bodyParser: false,
    },
};

// MongoDB connection with caching
let cachedClient = null;

async function connectToDatabase() {
    if (cachedClient) return cachedClient;

    if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI environment variable is not defined');
    }

    const client = new MongoClient(process.env.MONGODB_URI, {
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000,
        maxPoolSize: 10,
    });

    await client.connect();
    await client.db('admin').command({ ping: 1 });
    cachedClient = client;
    return client;
}

// Upload image to Cloudinary
async function uploadToCloudinary(filePath) {
    try {
        const result = await cloudinary.uploader.upload(filePath, {
            folder: 'students',
            resource_type: 'auto',
            transformation: [
                { width: 500, height: 500, crop: 'limit' },
                { quality: 'auto' }
            ]
        });
        return result.secure_url;
    } catch (error) {
        throw new Error(`Failed to upload image: ${error.message}`);
    }
}

// Parse form data
async function parseFormData(req) {
    const form = formidable({
        uploadDir: '/tmp',
        keepExtensions: true,
        maxFileSize: 10 * 1024 * 1024,
        maxFiles: 1,
    });

    try {
        const [fields, files] = await form.parse(req);
        return { fields, files };
    } catch (error) {
        throw new Error(`Failed to parse form data: ${error.message}`);
    }
}

// Clean up temporary files
function cleanupTempFile(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch {}
}

// Validate student data
function validateStudentData(data, isUpdate = false) {
    const requiredFields = [
        'class', 'studentName', 'birthdate', 'schoolName', 
        'parentName', 'contactNumber', 'address'
    ];

    const errors = [];

    for (const field of requiredFields) {
        if (!data[field] || data[field].trim() === '') {
            errors.push(`${field} is required`);
        }
    }

    if (data.parentEmail && data.parentEmail.trim() !== '') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(data.parentEmail)) {
            errors.push('Invalid email format');
        }
    }

    if (data.contactNumber && !/^\+?[\d\s-()]+$/.test(data.contactNumber)) {
        errors.push('Invalid contact number format');
    }

    return errors;
}

// GET: Fetch all students
async function handleGet(req, res) {
    try {
        const client = await connectToDatabase();
        const db = client.db('sk-tutorial');
        const collection = db.collection('studentsData');

        const { search, class: classFilter, sortBy = 'createdAt', order = 'desc' } = req.query;

        let query = {};
        
        if (search) {
            query.$or = [
                { studentName: { $regex: search, $options: 'i' } },
                { parentName: { $regex: search, $options: 'i' } },
                { contactNumber: { $regex: search, $options: 'i' } },
                { parentEmail: { $regex: search, $options: 'i' } }
            ];
        }

        if (classFilter) {
            query.class = classFilter;
        }

        const sortOrder = order === 'asc' ? 1 : -1;
        const sort = { [sortBy]: sortOrder };

        const students = await collection
            .find(query)
            .sort(sort)
            .limit(100)
            .toArray();

        const studentsWithComputed = students.map((student, index) => {
            let age = null;
            if (student.birthdate) {
                try {
                    const birthDate = new Date(student.birthdate);
                    const today = new Date();
                    age = Math.floor((today - birthDate) / (365.25 * 24 * 60 * 60 * 1000));
                } catch {}
            }
            return {
                ...student,
                rollNumber: `SK${String(index + 1).padStart(3, '0')}`,
                age
            };
        });

        res.status(200).json({
            success: true,
            count: studentsWithComputed.length,
            data: studentsWithComputed
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch students',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
}

// POST: Create new student
async function handlePost(req, res) {
    let tempFilePath = null;

    try {
        const { fields, files } = await parseFormData(req);

        const studentData = {
            class: fields.class?.[0]?.trim() || '',
            studentName: fields.studentName?.[0]?.trim() || '',
            birthdate: fields.birthdate?.[0] || '',
            admissiondate: fields.admissiondate?.[0] || '',
            schoolName: fields.schoolName?.[0]?.trim() || '',
            parentName: fields.parentName?.[0]?.trim() || '',
            parentEmail: fields.parentEmail?.[0]?.trim() || '',
            contactNumber: fields.contactNumber?.[0]?.trim() || '',
            address: fields.address?.[0]?.trim() || '',
        };

        const validationErrors = validateStudentData(studentData);
        if (validationErrors.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: validationErrors
            });
        }

        let photoUrl = null;
        if (files.photo && files.photo[0] && files.photo[0].size > 0) {
            try {
                const photoFile = files.photo[0];
                tempFilePath = photoFile.filepath;
                photoUrl = await uploadToCloudinary(tempFilePath);
            } catch {
                photoUrl = null;
            } finally {
                if (tempFilePath) {
                    cleanupTempFile(tempFilePath);
                }
            }
        }

        studentData.photoUrl = photoUrl;

        const client = await connectToDatabase();
        const db = client.db('sk-tutorial');
        const collection = db.collection('studentsData');

        const existingStudent = await collection.findOne({
            studentName: { $regex: `^${studentData.studentName}$`, $options: 'i' },
            parentName: { $regex: `^${studentData.parentName}$`, $options: 'i' }
        });

        if (existingStudent) {
            return res.status(409).json({
                success: false,
                error: 'Student already exists with same name and parent'
            });
        }

        const result = await collection.insertOne({
            ...studentData,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        res.status(201).json({
            success: true,
            message: 'Student created successfully',
            data: {
                studentId: result.insertedId,
                ...studentData
            }
        });

    } catch (error) {
        if (tempFilePath) {
            cleanupTempFile(tempFilePath);
        }
        res.status(500).json({
            success: false,
            error: 'Failed to create student',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
}

// PUT: Update existing student
async function handlePut(req, res) {
    let tempFilePath = null;

    try {
        const { fields, files } = await parseFormData(req);

        const studentId = fields.studentId?.[0];
        if (!studentId || !ObjectId.isValid(studentId)) {
            return res.status(400).json({
                success: false,
                error: 'Valid student ID is required'
            });
        }

        const updateData = {
            class: fields.class?.[0]?.trim() || '',
            studentName: fields.studentName?.[0]?.trim() || '',
            birthdate: fields.birthdate?.[0] || '',
            admissiondate: fields.admissiondate?.[0] || '',
            schoolName: fields.schoolName?.[0]?.trim() || '',
            parentName: fields.parentName?.[0]?.trim() || '',
            parentEmail: fields.parentEmail?.[0]?.trim() || '',
            contactNumber: fields.contactNumber?.[0]?.trim() || '',
            address: fields.address?.[0]?.trim() || '',
        };

        const validationErrors = validateStudentData(updateData, true);
        if (validationErrors.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: validationErrors
            });
        }

        const client = await connectToDatabase();
        const db = client.db('sk-tutorial');
        const collection = db.collection('studentsData');

        const currentStudent = await collection.findOne({ _id: new ObjectId(studentId) });
        if (!currentStudent) {
            return res.status(404).json({
                success: false,
                error: 'Student not found'
            });
        }

        let photoUrl = currentStudent.photoUrl;
        if (files.photo && files.photo[0] && files.photo[0].size > 0) {
            try {
                const photoFile = files.photo[0];
                tempFilePath = photoFile.filepath;
                photoUrl = await uploadToCloudinary(tempFilePath);
            } catch (uploadError) {
                return res.status(500).json({
                    success: false,
                    error: 'Photo upload failed',
                    details: uploadError.message
                });
            } finally {
                if (tempFilePath) {
                    cleanupTempFile(tempFilePath);
                }
            }
        }

        updateData.photoUrl = photoUrl;

        const result = await collection.updateOne(
            { _id: new ObjectId(studentId) },
            { $set: { ...updateData, updatedAt: new Date() } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Student not found'
            });
        }

        const updatedStudent = await collection.findOne({ _id: new ObjectId(studentId) });

        res.status(200).json({
            success: true,
            message: 'Student updated successfully',
            data: updatedStudent
        });

    } catch (error) {
        if (tempFilePath) {
            cleanupTempFile(tempFilePath);
        }
        res.status(500).json({
            success: false,
            error: 'Failed to update student',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
}

// Main handler function
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        switch (req.method) {
            case 'GET':
                await handleGet(req, res);
                break;
            case 'POST':
                await handlePost(req, res);
                break;
            case 'PUT':
                await handlePut(req, res);
                break;
            default:
                res.status(405).json({
                    success: false,
                    error: `Method ${req.method} not allowed`
                });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
}
