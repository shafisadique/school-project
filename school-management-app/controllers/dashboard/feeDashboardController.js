// controllers/dashboard/feeDashboardController.js

const mongoose = require('mongoose');
const moment = require('moment-timezone');
const FeeInvoice = require('../../models/feeInvoice');
const Student = require('../../models/student');
const Class = require('../../models/class');
const APIError = require('../../utils/apiError');
const fsSync = require('fs');
const path = require('path');   
const PDFDocument = require('pdfkit-table');
const AdmZip = require('adm-zip');

  // getAllFeeDashboard — SIRF BASE FEE KA TOTAL (CORRECT WAY)
  const getAllFeeDashboard = async (user) => {
    try {
      const { schoolId, activeAcademicYear: academicYearId } = user;

      const result = await FeeInvoice.aggregate([
        {
          $match: {
            schoolId: new mongoose.Types.ObjectId(schoolId),
            academicYear: new mongoose.Types.ObjectId(academicYearId)
          }
        },
        {
          $group: {
            _id: null,
            // Sirf original base fee + current charges
            totalBaseAmount: { $sum: '$baseAmount' },
            totalCurrentCharges: { $sum: '$currentCharges' },
            totalPaid: { $sum: '$paidAmount' },
            // Latest remainingDue (last invoice ka remainingDue)
            latestRemainingDue: { $last: '$remainingDue' }
          }
        }
      ]);

      const stats = result[0] || { totalBaseAmount: 0, totalCurrentCharges: 0, totalPaid: 0, latestRemainingDue: 0 };

      const overallDue = stats.latestRemainingDue; // Ya (totalBaseAmount + totalCurrentCharges - totalPaid)

      return {
        overallDue,
        overallPaid: stats.totalPaid,
        totalAmount: stats.totalBaseAmount + stats.totalCurrentCharges,
        collectionRate: stats.totalBaseAmount > 0
          ? ((stats.totalPaid / (stats.totalBaseAmount + stats.totalCurrentCharges)) * 100).toFixed(2)
          : '0.00'
      };

    } catch (error) {
      throw error;
    }
  };

// DYNAMIC: Filter wala data — Table, Chart, Defaulters ke liye
const getFeeDashboard = async (req, res, next) => {
  try {
    const { schoolId, activeAcademicYear: defaultAcademicYearId } = req.user;
    const { month, classId, academicYearId = defaultAcademicYearId } = req.query;

    if (!mongoose.Types.ObjectId.isValid(schoolId) || !mongoose.Types.ObjectId.isValid(academicYearId)) {
      throw new APIError('Invalid school ID or academic year ID', 400);
    }

    const today = moment.tz('Asia/Kolkata');
    const currentMonth = today.format('YYYY-MM');
    const selectedMonth = month || currentMonth;

    // BASE MATCH FOR FILTERED DATA
    const baseMatch = {
      schoolId: new mongoose.Types.ObjectId(schoolId),
      academicYear: new mongoose.Types.ObjectId(academicYearId),
      month: selectedMonth
    };

    if (classId && mongoose.Types.ObjectId.isValid(classId)) {
      baseMatch.classId = new mongoose.Types.ObjectId(classId);
    }

    // 1. FILTERED SUMMARY (month + class)
    const summaryAgg = await FeeInvoice.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: null,
          totalRemainingDue: { $sum: '$remainingDue' },
          totalPaid: { $sum: '$paidAmount' },
          totalAmount: { $sum: '$totalAmount' },
          overdueCount: { $sum: { $cond: [{ $eq: ['$status', 'Overdue'] }, 1, 0] } },
          invoiceCount: { $sum: 1 }
        }
      }
    ]);

    const summary = summaryAgg[0] || { totalRemainingDue: 0, totalPaid: 0, totalAmount: 0, overdueCount: 0, invoiceCount: 0 };
    summary.collectionRate = summary.totalAmount > 0
      ? ((summary.totalPaid / summary.totalAmount) * 100).toFixed(2)
      : '0.00';

    // 2. CLASS BREAKDOWN
    let breakdownByClass = [];
    if (classId && mongoose.Types.ObjectId.isValid(classId)) {
      const classDoc = await Class.findById(classId);
      const agg = await FeeInvoice.aggregate([
        { $match: { ...baseMatch, classId: new mongoose.Types.ObjectId(classId) } },
        { $group: { _id: null, totalRemainingDue: { $sum: '$remainingDue' }, totalPaid: { $sum: '$paidAmount' }, totalAmount: { $sum: '$totalAmount' } } }
      ]);
      const data = agg[0] || { totalRemainingDue: 0, totalPaid: 0, totalAmount: 0 };
      data.collectionRate = data.totalAmount > 0 ? ((data.totalPaid / data.totalAmount) * 100).toFixed(2) : 0;
      breakdownByClass = [{ classId, className: classDoc?.name || 'Unknown', ...data }];
    } else {
      breakdownByClass = await FeeInvoice.aggregate([
        { $match: baseMatch },
        { $lookup: { from: 'classes', localField: 'classId', foreignField: '_id', as: 'classInfo' } },
        { $unwind: '$classInfo' },
        {
          $group: {
            _id: '$classId',
            className: { $first: '$classInfo.name' },
            totalRemainingDue: { $sum: '$remainingDue' },
            totalPaid: { $sum: '$paidAmount' },
            totalAmount: { $sum: '$totalAmount' }
          }
        },
        {
          $project: {
            classId: '$_id',
            _id: 0,
            className: 1,
            totalRemainingDue: 1,
            totalPaid: 1,
            totalAmount: 1,
            collectionRate: {
              $cond: [{ $gt: ['$totalAmount', 0] }, { $round: [{ $multiply: [{ $divide: ['$totalPaid', '$totalAmount'] }, 100] }, 2] }, 0]
            }
          }
        },
        { $sort: { className: 1 } }
      ]);
    }

    // 3. PAYMENT METHODS + TOP DEFAULTERS + MONTHLY TREND → Tumhara code already perfect

    const paymentMethods = await FeeInvoice.aggregate([
      { $match: baseMatch },
      { $unwind: { path: '$paymentHistory', preserveNullAndEmptyArrays: true } },
      { $group: { _id: '$paymentHistory.paymentMethod', totalAmount: { $sum: '$paymentHistory.amount' } } },
      { $project: { _id: 0, method: '$_id', totalAmount: 1 } },
      { $sort: { totalAmount: -1 } }
    ]);

    const defaulterMatch = { ...baseMatch, remainingDue: { $gt: 0 } };
    const topDefaulters = await FeeInvoice.aggregate([
      { $match: defaulterMatch },
      { $lookup: { from: 'students', localField: 'studentId', foreignField: '_id', as: 'student' } },
      { $unwind: '$student' },
      { $lookup: { from: 'classes', localField: 'student.classId', foreignField: '_id', as: 'class' } },
      { $unwind: { path: '$class', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          studentName: '$student.name',
          admissionNo: '$student.admissionNo',
          className: { $ifNull: ['$class.name', 'Unknown'] },
          remainingDue: 1
        }
      },
      { $sort: { remainingDue: -1 } },
      { $limit: 50 }
    ]);

    const totalDefaultersCount = await FeeInvoice.countDocuments(defaulterMatch);

    const sixMonthsAgo = moment.tz('Asia/Kolkata').subtract(6, 'months').startOf('month').format('YYYY-MM');
    const monthlyTrend = await FeeInvoice.aggregate([
      {
        $match: {
          schoolId: new mongoose.Types.ObjectId(schoolId),
          academicYear: new mongoose.Types.ObjectId(academicYearId),
          month: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: '$month',
          totalPaid: { $sum: '$paidAmount' },
          totalRemainingDue: { $sum: '$remainingDue' }
        }
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, month: '$_id', totalPaid: 1, totalRemainingDue: 1 } }
    ]);

    // YE LINE SABSE IMPORTANT — FIXED + FILTERED DATA EK SAATH
    const overallYearlyStats = await getAllFeeDashboard(req.user);

    res.json({
      summary,                    // ← Filtered (month/class)
      breakdownByClass,
      paymentMethods,
      topDefaulters,
      totalDefaultersCount,
      monthlyTrend,
      overallYearlyStats,         // ← FIXED: Pura saal ka (top cards ke liye)
      filters: {
        selectedMonth,
        selectedClassId: classId || null,
        selectedAcademicYearId: academicYearId
      }
    });

  } catch (error) {
    console.error('Error in getFeeDashboard:', error);
    next(error);
  }
};

const generateClassReceipts = async (req, res) => {
  try {
    const { schoolId, className, month, academicYearId } = req.body;

    if (!schoolId || !month || !academicYearId) {
      return res.status(400).json({
        success: false,
        message: 'schoolId, month and academicYearId are required'
      });
    }

    const matchQuery = {
      schoolId: new mongoose.Types.ObjectId(schoolId),
      academicYear: new mongoose.Types.ObjectId(academicYearId),
      month,
      remainingDue: { $gt: 0 }
    };

    if (className) matchQuery.className = className;

    const invoices = await FeeInvoice.find(matchQuery)
      .populate('studentId', 'name admissionNo className')
      .populate('schoolId', 'name');

    if (!invoices.length) {
      return res.status(404).json({
        success: false,
        message: 'No defaulter invoices found'
      });
    }

    // YE AB 100% KAAM KAREGA — fsSync se
    const tempDir = path.join(__dirname, '../../temp_receipts');
    if (!fsSync.existsSync(tempDir)) {
      fsSync.mkdirSync(tempDir, { recursive: true });
    }

    const pdfPaths = [];

    for (const inv of invoices) {
      const student = inv.studentId;
      if (!student) continue;

      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const fileName = `${student.admissionNo || 'unknown'}_${inv.month}_due.pdf`;
      const filePath = path.join(tempDir, fileName);

      doc.pipe(fsSync.createWriteStream(filePath));

      // Beautiful Receipt
      doc.fontSize(22).text('FEE DUE RECEIPT', { align: 'center' });
      doc.moveDown(2);
      doc.fontSize(14);
      doc.text(`Student: ${student.name}`);
      doc.text(`Admission No: ${student.admissionNo}`);
      doc.text(`Class: ${student.className || inv.className}`);
      doc.text(`Month: ${inv.month}`);
      doc.moveDown();
      doc.fontSize(18).fillColor('#e74c3c')
         .text(`DUE: ₹${inv.remainingDue.toLocaleString()}`, { align: 'center' });
      doc.moveDown(3);
      doc.fontSize(11).fillColor('#7f8c8d')
         .text('Please clear the dues at the earliest.', { align: 'center' });

      doc.end();
      pdfPaths.push(filePath);
    }

    // ZIP banao
    const zip = new AdmZip();
    pdfPaths.forEach(p => zip.addLocalFile(p));
    const zipPath = path.join(tempDir, `Defaulter_Receipts_${Date.now()}.zip`);
    zip.writeZip(zipPath);

    // Download bhejo
    res.download(zipPath, `Defaulter_Receipts_${moment().format('DD-MM-YYYY')}.zip`, () => {
      setTimeout(() => {
        pdfPaths.forEach(f => fsSync.unlinkSync(f));
        fsSync.unlinkSync(zipPath);
      }, 5000);
    });

  } catch (error) {
    console.error('generateClassReceipts error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getFeeDashboard, getAllFeeDashboard, generateClassReceipts };