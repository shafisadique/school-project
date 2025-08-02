const generateInvoices = async (schoolId, classId, className, month, academicYearId, feeStructure, isBulk, studentId) => {
  const invoices = [];
  const students = isBulk
    ? await Student.find({ schoolId, classId, academicYear: academicYearId })
    : [await Student.findById(studentId)];

  for (const student of students) {
    const invoice = new FeeInvoice({
      studentId: student._id,
      schoolId,
      classId,
      className,
      month,
      academicYear: academicYearId,
      invoiceDetails: feeStructure.length > 0 ? feeStructure : { tuition: 1000 }, // Example default
      totalAmount: feeStructure.reduce((sum, fee) => sum + (fee.amount || 0), 0) || 1000,
      paidAmount: 0,
      remainingDue: feeStructure.reduce((sum, fee) => sum + (fee.amount || 0), 0) || 1000,
      status: 'Pending',
      dueDate: new Date()
    });
    await invoice.save();
    invoices.push(invoice);
  }
  return invoices;
};