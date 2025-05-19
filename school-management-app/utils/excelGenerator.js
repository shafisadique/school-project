const ExcelJS = require('exceljs');

exports.generateTimetableExcel = async (timetableData, filePath) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Timetable');

  sheet.columns = [
    { header: 'Class', key: 'className', width: 20 },
    { header: 'Subject', key: 'subject', width: 20 },
    { header: 'Teacher', key: 'teacher', width: 20 },
    { header: 'Day', key: 'day', width: 15 },
    { header: 'Time', key: 'time', width: 20 },
  ];

  timetableData.forEach(entry => {
    sheet.addRow({ className: entry.className, subject: entry.subject.name, teacher: entry.teacher.name, day: entry.day, time: `${entry.startTime} - ${entry.endTime}` });
  });

  await workbook.xlsx.writeFile(filePath);
};
