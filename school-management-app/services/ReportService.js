const mongoose = require('mongoose');
const Student = require('../models/student');
const Fee = require('../models/feeInvoice');
const Result = require('../models/result');
const Teacher = require('../models/teacher');
const TeacherAttendance = require('../models/teacherAttendance');
const AcademicYear = require('../models/academicyear');
const School = require('../models/school');
const APIError = require('../utils/apiError');

// SECURE Report Service with Multi-Layer Protection
class ReportService {
  // HELPER: Verify user has access to school
  static async verifySchoolAccess(user, providedSchoolId = null) {
    const { schoolId, role } = user;
    const targetSchoolId = providedSchoolId || schoolId;
    if (!targetSchoolId) throw new APIError('School ID is required', 401);
    
    const school = await School.findById(targetSchoolId);
    if (!school) throw new APIError('School not found', 404);
    
    const allowedRoles = ['admin'];
    if (!allowedRoles.includes(role)) throw new APIError('Insufficient permissions', 403);
    console.log('testing purpose', school)
    if (user.schoolId.toString() !== targetSchoolId.toString()) throw new APIError('School mismatch', 403);
    if (!school.status) throw new APIError('School inactive', 403);

    console.log(`✅ Security: ${role} verified for school ${targetSchoolId}`);
    return targetSchoolId;
  }

  // 1. SECURE CUSTOM REPORT GENERATOR
  static async generateCustomReport(user, config) {
    const { schoolId, reportType, filters = {}, columns } = config;

    const verifiedSchoolId = await this.verifySchoolAccess(user, schoolId);
    const allowedReportTypes = ['student', 'fee-defaulters', 'academic-performance', 'attendance-summary', 'teacher-performance'];
    if (!allowedReportTypes.includes(reportType)) throw new APIError(`Invalid report type ${reportType}`, 400);

    const allowedColumns = this.getAllowedColumns(reportType);
    const sanitizedColumns = columns.filter(col => allowedColumns.includes(col));
    if (sanitizedColumns.length === 0) throw new APIError('No valid columns', 400);

    const sanitizedFilters = this.sanitizeFilters(filters, reportType);
    const maxRecords = 1000; // Default limit

    let data = [];
    switch (reportType) {
      case 'student':
        data = await Student.find({ schoolId: new mongoose.Types.ObjectId(verifiedSchoolId), ...sanitizedFilters })
          .select(sanitizedColumns.join(' '))
          .limit(maxRecords);
        break;
      case 'fee-defaulters':
        data = await this.generateFeeDefaultersReport(verifiedSchoolId, sanitizedFilters, sanitizedColumns, maxRecords);
        break;
      case 'academic-performance':
        data = await this.generateAcademicReport(verifiedSchoolId, sanitizedFilters, sanitizedColumns, maxRecords);
        break;
      case 'attendance-summary':
        data = await this.generateAttendanceReport(verifiedSchoolId, sanitizedFilters, sanitizedColumns, maxRecords);
        break;
      case 'teacher-performance':
        data = await this.generateTeacherReport(verifiedSchoolId, sanitizedFilters, sanitizedColumns, maxRecords);
        break;
      default:
        throw new APIError('Invalid report type', 400);
    }

    return data;
  }

  // SECURITY HELPERS
  static getAllowedColumns(reportType) {
    const columnWhitelist = {
      student: ['name', 'rollNo', 'gender', 'category', 'enrollmentDate', 'status', 'admissionNo', 'address', 'phone'],
      'fee-defaulters': ['name', 'rollNo', 'classId', 'totalDue', 'totalPaid', 'feeStatus', 'lastPaymentDate'],
      'academic-performance': ['studentName', 'rollNo', 'subjectName', 'marksObtained', 'totalMarks', 'percentage', 'grade', 'position'],
      'attendance-summary': ['teacherName', 'date', 'status', 'subject', 'remarks'],
      'teacher-performance': ['name', 'designation', 'subjects', 'phone', 'email', 'experience', 'status', 'leaveBalance']
    };
    return columnWhitelist[reportType] || ['name', 'rollNo'];
  }

  static sanitizeFilters(filters, reportType) {
    const safeFilters = {};
    const allowedFilters = {
      student: ['classId', 'status', 'gender', 'category', 'academicYearId'],
      'fee-defaulters': ['classId', 'academicYearId', 'minimumDue'],
      'academic-performance': ['classId', 'subjectId', 'examType', 'minimumMarks'],
      'attendance-summary': ['dateFrom', 'dateTo', 'status', 'teacherId'],
      'teacher-performance': ['designation', 'status', 'subjects']
    };
    const filterWhitelist = allowedFilters[reportType] || ['classId', 'status'];

    Object.keys(filters).forEach(key => {
      if (filterWhitelist.includes(key)) {
        if (key.includes('date') && filters[key]) safeFilters[key] = new Date(filters[key]);
        else if (key.includes('Id') && filters[key]) safeFilters[key] = new mongoose.Types.ObjectId(filters[key]);
        else safeFilters[key] = filters[key];
      }
    });
    return safeFilters;
  }

  // REPORT GENERATORS
  static async generateStudentReport(schoolId, filters, columns, maxRecords) {
    return await Student.find({ schoolId: new mongoose.Types.ObjectId(schoolId), ...filters })
      .select(columns.join(' '))
      .limit(maxRecords)
      .lean();
  }

static async generateFeeDefaultersReport(schoolId, filters, columns, maxRecords) {
  // Fetch fees with remaining due and relevant statuses
  const fees = await Fee.find({
    schoolId: new mongoose.Types.ObjectId(schoolId),
    status: { $in: ['Pending', 'Overdue', 'Partial'] },
    remainingDue: { $gt: 0 }
    // Uncomment below if you want only past-due fees
    // , dueDate: { $lt: new Date() }
  })
    .populate('studentId', 'name rollNo classId')
    .limit(maxRecords)
    .lean();

  console.log('Fetched fees:', fees.length, 'records'); // Debug log
  console.log('Sample fees:', fees.slice(0, 2)); // Log first 2 records for brevity

  // Build defaulters directly from fees
  const defaulters = fees.map(fee => {
    const { studentId, remainingDue, paidAmount, status, paymentHistory } = fee;
    if (!studentId) return null; // Skip if studentId is invalid

    return {
      name: studentId.name,
      rollNo: studentId.rollNo,
      classId: studentId.classId,
      totalDue: remainingDue,
      totalPaid: paidAmount,
      feeStatus: status,
      lastPaymentDate: paymentHistory[0]?.date || null,
      ...columns.reduce((obj, col) => {
        if (col in fee) obj[col] = fee[col];
        return obj;
      }, {})
    };
  }).filter(Boolean);

  console.log('Generated defaulters:', defaulters.length); // Debug log

  return defaulters;
}

  static async generateAcademicReport(schoolId, filters, columns, maxRecords) {
    if (!filters.classId) throw new APIError('Class ID required', 400);
    const results = await Result.find({ schoolId: new mongoose.Types.ObjectId(schoolId), ...filters })
      .populate('studentId', 'name rollNo')
      .populate('subjectId', 'name')
      .limit(maxRecords)
      .lean();

    return results.map(result => ({
      studentName: result.studentId.name,
      rollNo: result.studentId.rollNo,
      subjectName: result.subjectId.name,
      marksObtained: result.marksObtained,
      totalMarks: result.totalMarks,
      percentage: ((result.marksObtained / result.totalMarks) * 100).toFixed(2),
      grade: this.calculateGrade(result.marksObtained, result.totalMarks),
      ...columns.reduce((obj, col) => (obj[col] = result[col], obj), {})
    }));
  }

  static async generateAttendanceReport(schoolId, filters, columns, maxRecords) {
    return await TeacherAttendance.find({ schoolId: new mongoose.Types.ObjectId(schoolId), ...filters })
      .populate('teacherId', 'name designation')
      .limit(maxRecords)
      .lean()
      .map(record => ({
        teacherName: record.teacherId.name,
        designation: record.teacherId.designation,
        date: record.date.toISOString().split('T')[0],
        status: record.status,
        ...columns.reduce((obj, col) => (obj[col] = record[col], obj), {})
      }));
  }

  static async generateTeacherReport(schoolId, filters, columns, maxRecords) {
    return await Teacher.find({ schoolId: new mongoose.Types.ObjectId(schoolId), ...filters })
      .select(columns.join(' '))
      .limit(maxRecords)
      .lean()
      .map(teacher => ({
        name: teacher.name,
        designation: teacher.designation,
        subjects: Array.isArray(teacher.subjects) ? teacher.subjects.join(', ') : teacher.subjects,
        ...columns.reduce((obj, col) => (obj[col] = teacher[col], obj), {})
      }));
  }

  // SECURE UDISE REPORTS
  static async generateUDISEReport(template, user) {
    const verifiedSchoolId = await this.verifySchoolAccess(user);
    switch (template) {
      case 'enrollment':
        return await Student.aggregate([
          { $match: { schoolId: new mongoose.Types.ObjectId(verifiedSchoolId) } },
          { $group: { _id: { classId: '$classId', gender: '$gender', category: '$category' }, count: { $sum: 1 } } },
          { $project: { classId: '$_id.classId', gender: '$_id.gender', category: '$_id.category', count: 1, _id: 0 } }
        ]);
      case 'teachers':
        return await Teacher.find({ schoolId: new mongoose.Types.ObjectId(verifiedSchoolId) })
          .select('name designation qualification experience subjects phone email');
      case 'infrastructure':
        return await School.findOne({ _id: new mongoose.Types.ObjectId(verifiedSchoolId) })
          .select('classrooms labs playground library waterFacility electricity');
      default:
        throw new APIError(`Invalid UDISE template ${template}`, 400);
    }
  }

  static calculateGrade(marksObtained, totalMarks) {
    const percentage = (marksObtained / totalMarks) * 100;
    return percentage >= 90 ? 'A+' : percentage >= 80 ? 'A' : percentage >= 70 ? 'B+' : percentage >= 60 ? 'B' : percentage >= 50 ? 'C' : percentage >= 40 ? 'D' : 'F';
  }
}

module.exports = ReportService;