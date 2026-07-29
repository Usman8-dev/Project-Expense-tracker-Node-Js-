const ExpenseModel = require("../Models/ExpenseModel")
const ExcelJS = require('exceljs');
const { startOfDay, endOfDay } = require('date-fns');

const recalculateAllTotals = async (userId) => {
  const allRecords = await ExpenseModel.find({ createdBy: userId }).sort({ date: 1, _id: 1 });

  let runningIncome = 0;
  let runningExpense = 0;

  for (const record of allRecords) {
    const income = record.type === "Income" ? Number(record.amount) : 0;
    const expense = record.type === "Expense" ? Number(record.amount) : 0;

    runningIncome += income;
    runningExpense += expense;

    await ExpenseModel.findByIdAndUpdate(record._id, {
      income,
      expense,
      total_income: runningIncome,
      total_expense: runningExpense,
      total_balance: runningIncome - runningExpense,
    });
  }
};

const CreateExpense = async (req, res) => {
  try {
    let { title, description, amount, category_id, type } = req.body;
    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount)) {
      return res.status(400).json({ success: false, message: "Invalid amount" });
    }

    // Create the record (no cumulative calculations — recalculateAllTotals handles it)
    const exp = await ExpenseModel.create({
      title,
      description,
      amount: parsedAmount,
      createdBy: req.user.id,
      category_id,
      type,
    });

    // Recalculate all running totals from scratch
    await recalculateAllTotals(req.user.id);

    const updatedExp = await ExpenseModel.findById(exp._id).populate("category_id");

    return res.status(201).json({
      success: true,
      message: "Expense Created Successfully!",
      expense: updatedExp
    });

  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const UpdateExpense = async (req, res) => {
  try {
    const { title, description, amount, category_id, type } = req.body;

    let oldRecord = await ExpenseModel.findById(req.params.id);
    if (!oldRecord || oldRecord.createdBy.toString() !== req.user.id) {
      return res.status(404).json({
        success: false,
        message: "Expense not found!"
      });
    }

    // Update the record's own fields
    let updatedRecord = await ExpenseModel.findOneAndUpdate(
      { _id: req.params.id },
      {
        title,
        description,
        amount: Number(amount),
        category_id,
        type,
      },
      { new: true }
    );

    // Recalculate all running totals from scratch
    await recalculateAllTotals(req.user.id);

    await updatedRecord.populate("category_id");

    return res.status(200).json({
      success: true,
      message: "Expense Updated Successfully",
      updated_expense: updatedRecord
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

const GetExpenseById = async (req, res) => {
  try {
    const expense = await ExpenseModel.findById(req.params.id).populate(
      "category_id"
    );

    if (!expense || expense.createdBy.toString() !== req.user.id) {
      return res.status(404).json({
        success: false,
        message: "Expense not found!",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Expense fetched successfully",
      expense,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

const AllExpense = async (req, res) => {
  try {
    let allExp = await ExpenseModel.find({ createdBy: req.user.id })
    .populate("category_id", "name") 
    .sort({ date: -1 });

    return res.status(201).json({
      success: true,
      message: "All Expenses",
      All_Expenses: allExp,
    });

  } catch (err) {
    return res.status(401).json({
      err: err.message,
    })
  }
}

const SearchExpense = async (req, res) => {
  try {
    let findTitle = await ExpenseModel.find({
      createdBy: req.user.id,
      title: {
        $regex: new RegExp(req.params.title, "i")
      }
    });

    if (!findTitle) {
      return res.status(401).json({
        success: false,
        message: 'Title not found!!',
      })
    }

    return res.status(201).json({
      success: true,
      message: "Expense Founded",
      Expense: findTitle,
    });
  } catch (err) {
    return res.status(201).json({
      success: false,
      message: err.message,
    });
  }
}

const DeleteExpense = async (req, res) => {
  try {
    let deleteExp = await ExpenseModel.findByIdAndDelete(req.params.id);

    if (!deleteExp) {
      return res.status(201).json({
        success: true,
        message: "Not found!",
      });
    }

    // Recalculate all running totals after deletion
    if (deleteExp.createdBy) {
      await recalculateAllTotals(deleteExp.createdBy.toString());
    }

    return res.status(201).json({
      success: true,
      message: "Deleted Successfully",
      Expense: deleteExp,
    });
  } catch (err) {
    res.send(err.message);
  }
}

// Excel report 
const exportExpensesToExcel = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const { startDate, endDate } = req.body;
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'startDate and endDate are required',
        example: { startDate: "2025-12-01", endDate: "2025-12-30" }
      });
    }

    const start = startOfDay(new Date(startDate));
    const end = endOfDay(new Date(endDate));

    if (isNaN(start) || isNaN(end) || start > end) {
      return res.status(400).json({ message: 'Invalid date range' });
    }

    const expenses = await ExpenseModel.find({
      createdBy: userId,
      date: { $gte: start, $lte: end }
    })
      .populate('category_id', 'name')
      .sort({ date: -1 });

    if (expenses.length === 0) {
      return res.status(404).json({ message: 'No transactions found' });
    }

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Finance Report', {
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true },
    });

    // === TITLE ===
    ws.mergeCells('A1:G1');
    const titleCell = ws.getCell('A1');
    titleCell.value = 'Personal Finance Report';
    titleCell.font = { name: 'Segoe UI', size: 22, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2c3e50' } };

    // === PERIOD ===
    ws.mergeCells('A2:G2');
    const periodCell = ws.getCell('A2');
    periodCell.value = `${start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} – ${end.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    periodCell.font = { size: 14, italic: true, color: { argb: 'FF34495e' } };
    periodCell.alignment = { horizontal: 'center' };

    ws.addRow([]);

    // === TABLE STARTS AT ROW 4 ===
    const tableStartRow = 4;

    // === FIXED HEADERS ===
    const headers = ['Date', 'Title', 'Description', 'Category', 'Type', 'Amount'];
    const headerRow = ws.addRow(headers);
    headerRow.height = 35;

    for (let i = 1; i <= 6; i++) {
      const cell = headerRow.getCell(i);
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF3498db' }
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    }

    ws.columns = [
      { width: 15 }, { width: 24 }, { width: 36 }, { width: 18 }, { width: 12 }, { width: 18 }
    ];

    let totalIncome = 0;
    let totalExpense = 0;

    expenses.forEach(exp => {
      const row = ws.addRow([
        exp.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
        exp.title || '-',
        exp.description || '-',
        exp.category_id?.name || '',
        exp.type,
        exp.amount
      ]);

      const amountCell = row.getCell(6);
      amountCell.numFmt = '"Rs. "#,##0.00';
      amountCell.font = { bold: true, color: { argb: 'FF2c3e50' } };
      amountCell.alignment = { horizontal: 'right' };

      const typeCell = row.getCell(5);
      if (exp.type === 'Income') {
        typeCell.font = { color: { argb: 'FF27ae60' }, bold: true };
        totalIncome += exp.amount;
      } else {
        typeCell.font = { color: { argb: 'FF8e44ad' }, bold: true };
        totalExpense += exp.amount;
      }

      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: row.number % 2 === 0 ? 'FFF8F9FA' : 'FFFFFFFF' } };
      row.eachCell(cell => {
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });
    });

    // === SUMMARY BOX ===
    const lastRow = ws.rowCount;
    const summaryStart = lastRow + 3;

    ws.mergeCells(`C${summaryStart}:D${summaryStart}`);
    ws.getCell(`C${summaryStart}`).value = 'Total Income';
    ws.getCell(`C${summaryStart}`).font = { bold: true, size: 15, color: { argb: 'FFFFFFFF' } };
    ws.getCell(`C${summaryStart}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF27ae60' } };
    ws.getCell(`C${summaryStart}`).alignment = { horizontal: 'center' };

    ws.mergeCells(`E${summaryStart}:F${summaryStart}`);
    ws.getCell(`E${summaryStart}`).value = totalIncome;
    ws.getCell(`E${summaryStart}`).numFmt = '"Rs. "#,##0.00';
    ws.getCell(`E${summaryStart}`).font = { bold: true, size: 15, color: { argb: 'FFFFFFFF' } };
    ws.getCell(`E${summaryStart}`).alignment = { horizontal: 'right' };
    ws.getCell(`E${summaryStart}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF27ae60' } };

    ws.mergeCells(`C${summaryStart + 2}:D${summaryStart + 2}`);
    ws.getCell(`C${summaryStart + 2}`).value = 'Total Expense';
    ws.getCell(`C${summaryStart + 2}`).font = { bold: true, size: 15, color: { argb: 'FFFFFFFF' } };
    ws.getCell(`C${summaryStart + 2}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF9b59b6' } };

    ws.mergeCells(`E${summaryStart + 2}:F${summaryStart + 2}`);
    ws.getCell(`E${summaryStart + 2}`).value = totalExpense;
    ws.getCell(`E${summaryStart + 2}`).numFmt = '"Rs. "#,##0.00';
    ws.getCell(`E${summaryStart + 2}`).font = { bold: true, size: 15, color: { argb: 'FFFFFFFF' } };
    ws.getCell(`E${summaryStart + 2}`).alignment = { horizontal: 'right' };
    ws.getCell(`E${summaryStart + 2}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF9b59b6' } };

    const balance = totalIncome - totalExpense;
    ws.mergeCells(`C${summaryStart + 4}:D${summaryStart + 4}`);
    ws.getCell(`C${summaryStart + 4}`).value = 'Balance';
    ws.getCell(`C${summaryStart + 4}`).font = { bold: true, size: 18, color: { argb: 'FFFFFFFF' } };
    ws.getCell(`C${summaryStart + 4}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16a085' } };

    ws.mergeCells(`E${summaryStart + 4}:F${summaryStart + 4}`);
    ws.getCell(`E${summaryStart + 4}`).value = balance;
    ws.getCell(`E${summaryStart + 4}`).numFmt = '"Rs. "#,##0.00';
    ws.getCell(`E${summaryStart + 4}`).font = { bold: true, size: 20, color: { argb: 'FFFFFFFF' } };
    ws.getCell(`E${summaryStart + 4}`).alignment = { horizontal: 'right' };
    ws.getCell(`E${summaryStart + 4}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16a085' } };

    const fileName = `Finance_Report_${startDate}_to_${endDate}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    await workbook.xlsx.write(res);
    res.status(200).end();

  } catch (error) {
    console.error('Export Error:', error);
    res.status(500).json({ message: 'Failed to generate report' });
  }
};

module.exports = { CreateExpense, UpdateExpense,GetExpenseById, AllExpense, SearchExpense, DeleteExpense, exportExpensesToExcel }