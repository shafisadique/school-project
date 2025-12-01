// controllers/reportsController.js
const ReportService = require('../../services/ReportService');
const APIError = require('../../utils/apiError');
const { Parser } = require('json2csv');
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