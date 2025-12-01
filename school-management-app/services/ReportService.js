// services/ReportService.js
const mongoose = require('mongoose');
const Student = require('../models/student');
const Fee = require('../models/feeInvoice');
const Result = require('../models/result');
const Teacher = require('../models/teacher');
const StudentAttendance = require('../models/studentAttendance'); // ← Must import
const School = require('../models/school');
const APIError = require('../utils/apiError');

// Allow populate even if field not in schema (fixes StrictPopulateError)
mongoose.set('strictPopulate', false);

class ReportService {
  static async verifySchoolAccess(user, providedSchoolId = null) {
    const { schoolId, role } = user;
    const targetSchoolId = providedSchoolId || schoolId;
    if (!targetSchoolId) throw new APIError('School ID is required', 401);

    const school = await School.findById(targetSchoolId);
    if (!school) throw new APIError('School not found', 404);
    if (!['admin'].includes(role)) throw new APIError('Insufficient permissions', 403);
    if (user.schoolId.toString() !== targetSchoolId.toString()) throw new APIError('School mismatch', 403);
    if (!school.status) throw new APIError('School inactive', 403);

    return targetSchoolId;
  }

  static async generateCustomReport(user, config) {
    const { schoolId, reportType, filters = {}, columns = [] } = config;
    const verifiedSchoolId = await this.verifySchoolAccess(user, schoolId);

    const allowedTypes = ['student', 'fee-defaulters', 'academic-performance', 'attendance-summary', 'teacher-performance'];
    if (!allowedTypes.includes(reportType)) throw new APIError(`Invalid report type: ${reportType}`, 400);

    const allowedColumns = this.getAllowedColumns(reportType);
    const validColumns = columns.filter(col => allowedColumns.includes(col));
    if (validColumns.length === 0) throw new APIError('No valid columns selected', 400);

    const safeFilters = this.sanitizeFilters(filters, reportType);
    const limit = 1000;

    switch (reportType) {
      case 'student':
        return await this.generateStudentReport(verifiedSchoolId, safeFilters, validColumns, limit);
      case 'fee-defaulters':
        return await this.generateFeeDefaultersReport(verifiedSchoolId, safeFilters, validColumns, limit);
      case 'academic-performance':
        return await this.generateAcademicReport(verifiedSchoolId, safeFilters, validColumns, limit);
      case 'attendance-summary':
        return await this.generateAttendanceReport(verifiedSchoolId, safeFilters, validColumns, limit);
      case 'teacher-performance':
        return await this.generateTeacherReport(verifiedSchoolId, safeFilters, validColumns, limit);
      default:
        throw new APIError('Report type not implemented', 400);
    }
  }

  static getAllowedColumns(type) {
    const map = {
      student: ['name', 'rollNo', 'admissionNo', 'fatherName', 'motherName', 'fatherPhone', 'motherPhone', 'className', 'gender', 'status'],
      'fee-defaulters': ['name', 'rollNo', 'admissionNo', 'className', 'totalDue', 'totalPaid', 'feeStatus'],
      'academic-performance': ['studentName', 'rollNo', 'admissionNo', 'className', 'subjectName', 'marksObtained', 'totalMarks', 'percentage', 'grade'],
      'attendance-summary': ['studentName', 'fatherName', 'motherName', 'fatherPhone', 'motherPhone', 'rollNo', 'admissionNo', 'className', 'date', 'status', 'remarks'],
      'teacher-performance': ['name', 'designation', 'subjects', 'phone', 'email', 'status', 'leaveBalance']
    };
    return map[type] || [];
  }

  static sanitizeFilters(filters, type) {
    const allowed = {
      student: ['classId', 'status', 'gender', 'academicYearId'],
      'fee-defaulters': ['classId', 'academicYearId'],
      'academic-performance': ['classId', 'examId', 'subjectId', 'academicYearId'],
      'attendance-summary': ['classId', 'dateFrom', 'dateTo', 'academicYearId'],
      'teacher-performance': ['status', 'designation']
    };

    const safe = {};
    const list = allowed[type] || [];

    Object.keys(filters).forEach(key => {
      if (list.includes(key)) {
        if (key.includes('Id') && filters[key]) {
          safe[key] = new mongoose.Types.ObjectId(filters[key]);
        } else if (key.includes('date') || key.includes('Date')) {
          safe[key] = new Date(filters[key]);
        } else {
          safe[key] = filters[key];
        }
      }
    });
    return safe;
  }

  // STUDENT REPORT - With Parent Name, Mobile & Class Name
  static async generateStudentReport(schoolId, filters, columns, limit) {
    const students = await Student.find({
      schoolId: new mongoose.Types.ObjectId(schoolId),
      ...filters
    })
      .populate('classId', 'name')
      .select('name rollNo admissionNo parents classId gender status')
      .limit(limit)
      .lean();

    return students.map(s => ({
      name: s.name || 'N/A',
      rollNo: s.rollNo || 'N/A',
      admissionNo: s.admissionNo,
      fatherName: s.parents?.fatherName || '-',
      motherName: s.parents?.motherName || '-',
      fatherPhone: s.parents?.fatherPhone || '-',
      motherPhone: s.parents?.motherPhone || '-',
      className: s.classId?.name || 'N/A',
      gender: s.gender || 'N/A',
      status: s.status ? 'Active' : 'Inactive'
    }));
  }

  // FEE DEFAULTERS
  static async generateFeeDefaultersReport(schoolId, filters, columns, limit) {
    const fees = await Fee.find({
      schoolId: new mongoose.Types.ObjectId(schoolId),
      remainingDue: { $gt: 0 },
      status: { $in: ['Pending', 'Partial', 'Overdue'] }
    })
      .populate({
        path: 'studentId',
        select: 'name rollNo admissionNo classId',
        populate: { path: 'classId', select: 'name' }
      })
      .limit(limit)
      .lean();

    return fees.map(f => ({
      name: f.studentId?.name || 'Unknown',
      rollNo: f.studentId?.rollNo || 'N/A',
      admissionNo: f.studentId?.admissionNo || 'N/A',
      className: f.studentId?.classId?.name || 'N/A',
      totalDue: f.remainingDue || 0,
      totalPaid: f.paidAmount || 0,
      feeStatus: f.status || 'Unknown'
    }));
  }

  // ACADEMIC PERFORMANCE - With Class Name
  static async generateAcademicReport(schoolId, filters, columns, limit) {
    const results = await Result.aggregate([
      { $match: { schoolId: new mongoose.Types.ObjectId(schoolId), ...filters } },
      {
        $lookup: {
          from: 'students',
          localField: 'studentId',
          foreignField: '_id',
          as: 'student'
        }
      },
      { $unwind: '$student' },
      {
        $lookup: {
          from: 'classes',
          localField: 'student.classId',
          foreignField: '_id',
          as: 'class'
        }
      },
      { $unwind: { path: '$class', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'subjects',
          localField: 'subjectId',
          foreignField: '_id',
          as: 'subject'
        }
      },
      { $unwind: { path: '$subject', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          studentName: '$student.name',
          rollNo: '$student.rollNo',
          admissionNo: '$student.admissionNo',
          className: '$class.name',
          subjectName: '$subject.name',
          marksObtained: '$marksObtained',
          totalMarks: '$totalMaxMarks',
          percentage: {
            $cond: {
              if: { $gt: ['$totalMaxMarks', 0] },
              then: { $round: [{ $multiply: [{ $divide: ['$marksObtained', '$totalMaxMarks'] }, 100] }, 2] },
              else: 0
            }
          }
        }
      },
      { $limit: limit }
    ]);

    return results.map(r => ({
      ...r,
      grade: this.calculateGrade(r.marksObtained || 0, r.totalMarks || 1)
    }));
  }

  // ATTENDANCE REPORT - With Parent Info & Class Name
  static async generateAttendanceReport(schoolId, filters, columns, limit) {
    const records = await StudentAttendance.find({
      schoolId: new mongoose.Types.ObjectId(schoolId),
      ...filters
    })
      .populate({
        path: 'student', // ← Change to 'studentId' if your field is studentId
        select: 'name rollNo admissionNo parents',
      })
      .populate('classId', 'name')
      .limit(limit)
      .lean();

    return records.map(r => ({
      studentName: r.student?.name || 'Unknown',
      fatherName: r.student?.parents?.fatherName || '-',
      motherName: r.student?.parents?.motherName || '-',
      fatherPhone: r.student?.parents?.fatherPhone || '-',
      motherPhone: r.student?.parents?.motherPhone || '-',
      rollNo: r.student?.rollNo || 'N/A',
      admissionNo: r.student?.admissionNo || 'N/A',
      className: r.classId?.name || 'Unknown Class',
      date: new Date(r.date).toLocaleDateString('en-IN'),
      status: r.status || 'Unknown',
      remarks: r.remarks || '-'
    }));
  }

  // TEACHER REPORT - Fixed .map() error
  static async generateTeacherReport(schoolId, filters, columns, limit) {
    const teachers = await Teacher.find({
      schoolId: new mongoose.Types.ObjectId(schoolId),
      ...filters
    })
      .select('name designation subjects phone email status leaveBalance')
      .limit(limit)
      .lean(); // ← Returns array directly

    return teachers.map(t => ({
      name: t.name || 'N/A',
      designation: t.designation || 'N/A',
      subjects: Array.isArray(t.subjects) ? t.subjects.join(', ') : 'N/A',
      phone: t.phone || 'N/A',
      email: t.email || 'N/A',
      status: t.status ? 'Active' : 'Inactive',
      leaveBalance: t.leaveBalance ?? 'N/A'
    }));
  }

  static calculateGrade(obtained, total) {
    if (!total) return 'N/A';
    const per = (obtained / total) * 100;
    if (per >= 90) return 'A+';
    if (per >= 80) return 'A';
    if (per >= 70) return 'B+';
    if (per >= 60) return 'B';
    if (per >= 50) return 'C';
    if (per >= 40) return 'D';
    return 'F';
  }
}

module.exports = ReportService;