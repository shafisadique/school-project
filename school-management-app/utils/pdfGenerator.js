const PDFDocument = require('pdfkit');
const fs = require('fs');

exports.generateTimetablePDF = (timetableData, filePath) => {
  const doc = new PDFDocument();
  doc.pipe(fs.createWriteStream(filePath));

  doc.fontSize(20).text('School Timetable', { align: 'center' });

  timetableData.forEach((entry, index) => {
    doc.fontSize(12).text(`${index + 1}. ${entry.className} - ${entry.subject.name} (${entry.teacher.name})`, { align: 'left' });
  });

  doc.end();
};
