// controllers/reportsController.js
const ReportService = require('../../services/ReportService');
const APIError = require('../../utils/apiError');
const { Parser } = require('json2csv');
const Student = require('../../models/student');
const School = require('../../models/school');
const Teacher = require('../../models/teacher');

// 1. CUSTOM REPORT GENERATOR (MAIN FEATURE)
exports.generateCustomReport = async (req, res, next) => {
  try {
    const { reportType, filters, columns, reportName } = req.body;
    const user = req.user;

    // Validate required fields
    if (!reportType || !columns || !Array.isArray(columns)) {
      throw new APIError('reportType and columns are required', 400);
    }

    // Ensure user and schoolId are present
    if (!user || !user.schoolId) {
      throw new APIError('User or school ID is missing', 401);
    }

    // Generate report
    const reportData = await ReportService.generateCustomReport(user, {
      schoolId: user.schoolId,
      reportType,
      filters: filters || {},
      columns
    });

    res.status(200).json({
      success: true,
      message: 'Custom report generated',
      data: {
        name: reportName || `${reportType} Report`,
        type: reportType,
        columns,
        records: reportData,
        totalRecords: reportData.length,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Custom report error:', error);
    next(error);
  }
};
// 2. UDISE GOVERNMENT REPORTS (QUICK TEMPLATES)
exports.generateUDISEReport = async (req, res, next) => {
  try {
    const { template } = req.params;
    const user = req.user; // ← Pass full user, not just schoolId!

    if (!['enrollment', 'teachers', 'infrastructure'].includes(template)) {
      throw new APIError('Invalid UDISE template', 400);
    }

    const reportData = await ReportService.generateUDISEReport(template, user);

    res.status(200).json({
      success: true,
      message: `UDISE ${template} report generated successfully`,
      data: {
        template,
        name: `UDISE ${template.charAt(0).toUpperCase() + template.slice(1)} Report`,
        records: reportData,
        totalRecords: Array.isArray(reportData) ? reportData.length : 1,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('UDISE Report Error:', error);
    next(error);
  }
};

// 3. REPORT EXPORT (CSV for MVP)
exports.exportReport = async (req, res, next) => {
  try {
    const { format } = req.params; // 'csv' for now
    const { reportData, columns, reportName } = req.body;
    const { schoolId } = req.user;

    if (!reportData || !Array.isArray(reportData)) {
      throw new APIError('Report data is required for export', 400);
    }

    if (format === 'csv') {
      // Generate CSV using json2csv
      const csvFields = columns || Object.keys(reportData[0] || {});
      const csv = new Parser({ fields: csvFields }).parse(reportData);

      // Set headers for download
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${reportName || 'report'}-${Date.now()}.csv"`);

      return res.status(200).send(csv);
    }

    throw new APIError(`Export format ${format} not supported`, 400);
  } catch (error) {
    console.error('Export error:', error);
    next(error);
  }
};

// 4. GET SAMPLE REPORT DATA (for testing)
exports.getSampleReports = async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    
    res.json({
      success: true,
      data: {
        availableReports: [
          { type: 'student', name: 'Student Master List', description: 'All students with basic info' },
          { type: 'fee-defaulters', name: 'Fee Defaulters', description: 'Students with pending fees' },
          { type: 'academic-performance', name: 'Class Performance', description: 'Subject-wise marks' },
          { type: 'attendance-summary', name: 'Monthly Attendance', description: 'Teacher/Student attendance' }
        ],
        udiseTemplates: [
          { template: 'enrollment', name: 'Student Enrollment', description: 'UDISE Student Data' },
          { template: 'teachers', name: 'Teacher Qualifications', description: 'UDISE Teacher Data' }
        ]
      }
    });
  } catch (error) {
    next(error);
  }
};


// Add this method
exports.getUDISECompliance = async (req, res, next) => {
  try {
    const user = req.user;
    const schoolId = user.schoolId;

    if (!schoolId) {
      throw new APIError('User not associated with a school', 400);
    }

    // 1. APAAR Completion
    const [totalStudents, studentsWithApaar, school, teacherCount] = await Promise.all([
      Student.countDocuments({ schoolId }),
      Student.countDocuments({ schoolId, apaarStatus: 'generated' }),
      School.findById(schoolId).select('name latitude longitude'),
      Teacher.countDocuments({ schoolId })
    ]);

    const apaarPercent = totalStudents > 0 ? Math.round((studentsWithApaar / totalStudents) * 100) : 0;
    const hasGIS = school.latitude && school.longitude;

    const items = [
      {
        label: 'APAAR ID Completion',
        completed: studentsWithApaar,
        total: totalStudents,
        percent: apaarPercent,
        status: apaarPercent >= 90 ? 'success' : apaarPercent >= 60 ? 'warning' : 'danger'
      },
      {
        label: 'GIS Coordinates Captured',
        completed: hasGIS ? 1 : 0,
        total: 1,
        percent: hasGIS ? 100 : 0,
        status: hasGIS ? 'success' : 'danger'
      },
      {
        label: 'Teacher Records',
        completed: teacherCount > 0 ? 1 : 0,
        total: 1,
        percent: teacherCount > 0 ? 100 : 0,
        status: teacherCount > 0 ? 'success' : 'warning'
      }
    ];

    const overallPercent = Math.round(items.reduce((sum, i) => sum + i.percent, 0) / items.length);

    res.json({
      success: true,
      data: {
        schoolName: school.name,
        overallReadiness: overallPercent,
        daysLeft: Math.ceil((new Date('2026-03-31') - new Date()) / (1000 * 60 * 60 * 24)),
        items
      }
    });
  } catch (error) {
    next(error);
  }
};