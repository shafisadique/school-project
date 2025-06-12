// const PDFDocument = require('pdfkit');
// const fs = require('fs');
// const student = require('../../models/student');

// exports.generateClassReceipts = async (req, res) => {
//   try {
//     const { schoolId, className, session, month } = req.body;
    
//     // 1. Get all students in class
//     const students = await student.find({ 
//       schoolId, 
//       className,
//       currentSession: session 
//     }).populate('feeInvoices');

//     // 2. Create PDF receipts
//     const receipts = [];
//     const tempDir = './temp_receipts';
    
//     if (!fs.existsSync(tempDir)){
//       fs.mkdirSync(tempDir);
//     }

//     for (const student of students) {
//       const doc = new PDFDocument();
//       const filePath = `${tempDir}/${student.admissionNo}_receipt.pdf`;
      
//       // Generate PDF content
//       doc.pipe(fs.createWriteStream(filePath));
      
//       // Add school header
//       doc.fontSize(18).text('Rainbow Public School', { align: 'center' });
//       doc.fontSize(12).text('Karbala Chowk, Jhalpo, Jhumri Telaiya, Koderma, Jharkhand', { align: 'center' });
      
//       // Student details
//       doc.moveDown();
//       doc.fontSize(14).text(`Name: ${student.name}`);
//       doc.text(`Admission No: ${student.admissionNo}`);
//       doc.text(`Class: ${student.className}`);
//       doc.text(`Month: ${month}`);

//       // Fee table
//       const feeTable = {
//         headers: ['Description', 'Amount (Rs.)'],
//         rows: student.feeInvoices[0].invoiceDetails.map(item => [
//           item.description,
//           item.amount
//         ])
//       };

//       // Draw table
//       doc.moveDown();
//       doc.table(feeTable, {
//         prepareHeader: () => doc.font('Helvetica-Bold'),
//         padding: 5
//       });

//       doc.end();
//       receipts.push(filePath);
//     }

//     // 3. Zip all receipts and send
//     const zip = new AdmZip();
//     receipts.forEach(file => zip.addLocalFile(file));
//     const zipPath = `${tempDir}/receipts.zip`;
//     zip.writeZip(zipPath);

//     // 4. Send zip file
//     res.download(zipPath, () => {
//       // Cleanup temp files
//       fs.rmSync(tempDir, { recursive: true });
//     });

//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };