const express = require('express');
const { body } = require('express-validator');
const login = require('../controllers/auth/login');
const registerTeacher = require('../controllers/auth/register/teacherRegister');
const registerStudent = require('../controllers/auth/register/studentRegister');
// const registerAdmin = require('../controllers/auth/register/adminRegister');
const registerSchool = require('../controllers/auth/register/schoolRegistration');
const validateRequest = require('../middleware/validateRequest');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// ✅ Login Route
router.post('/login', login);

// ✅ Register School (No Auth Required)
router.post('/register-school', registerSchool);


// ✅ Register Admin (Admin Only)
// router.post('/register/admin', authMiddleware, validateRequest([
//     body('name').notEmpty().withMessage('Name is required'),
//     body('username').notEmpty().withMessage('Username is required'),
//     body('email').isEmail().withMessage('Valid email is required'),
//     body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
// ]), registerAdmin);

// ✅ Register Teacher (Admin Only)
router.post('/register/teacher', authMiddleware, validateRequest([
    body('name').notEmpty().withMessage('Name is required'),
    body('username').notEmpty().withMessage('Username is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('schoolId').notEmpty().withMessage('School ID is required'),
    body('subjects').notEmpty().withMessage('Subjects are required'),
    body('classes').notEmpty().withMessage('Classes are required'),
]), registerTeacher);

// ✅ Register Student (Admin Only)
router.post('/register/student', authMiddleware, validateRequest([
    body('name').notEmpty().withMessage('Name is required'),
    body('username').notEmpty().withMessage('Username is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('schoolId').notEmpty().withMessage('School ID is required'),
    body('className').notEmpty().withMessage('Class name is required'),
    body('rollNumber').notEmpty().withMessage('Roll Number is required'),
]), registerStudent);

module.exports = router;
