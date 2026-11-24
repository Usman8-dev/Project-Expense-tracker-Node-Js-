const ExpenseModel = require("../Models/ExpenseModel");
const FolderModel = require("../Models/FolderModel");
const ExcelJS = require("exceljs");

// Asia/Karachi (Pakistan) is UTC+5 with NO daylight saving time.
const PK_UTC_OFFSET = "+05:00";
// Already-qualified ISO strings contain "Z" or an explicit offset like +05:00 / -0500.
const HAS_TIMEZONE = /[zZ]|[+-]\d{2}:?\d{2}$/;

/**
 * Parses a date value coming from the client as Pakistan local time.
 *
 * MongoDB stores BSON Date (a UTC instant). The frontend sends naive values like
 * "2024-06-15" or "2024-06-15T18:30" which JavaScript would otherwise read as
 * UTC, shifting them 5 hours behind Pakistan time (and sometimes onto the wrong
 * day near midnight). This helper treats such naive values as Asia/Karachi
 * wall-clock time and returns the exact UTC Date that should be stored.
 *
 * Values that already include a timezone/offset ("2024-06-15T18:30:00.000Z",
 * "2024-06-15T18:30+05:00", ...) are absolute instants and are passed through
 * as-is. Invalid input returns `undefined`.
 */
const parsePakistanDate = (value) => {
  if (value == null || value === "") return undefined;
  if (value instanceof Date) return isNaN(value) ? undefined : value;
  if (typeof value === "number") {
    const d = new Date(value);
    return isNaN(d) ? undefined : d;
  }

  const str = String(value).trim();
  if (!str) return undefined;

  // Already an absolute instant (contains Z or an explicit offset) → use as-is.
  if (HAS_TIMEZONE.test(str)) {
    const d = new Date(str);
    return isNaN(d) ? undefined : d;
  }

  // Normalize optional space separator ("2024-06-15 18:30") to "T".
  let normalized = str.replace(/\s+/, "T");
  // Date-only "YYYY-MM-DD" → midnight Pakistan time.
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) normalized += "T00:00:00";

  const d = new Date(`${normalized}${PK_UTC_OFFSET}`);
  return isNaN(d) ? undefined : d;
};

const recalculateAllTotals = async (userId) => {
  const allRecords = await ExpenseModel.find({ createdBy: userId }).sort({
    date: 1,
    _id: 1,
  });

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
    let { title, description, amount, category_id, type, date, folder } = req.body;
    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid amount" });
    }

    // Interpret the client date as Pakistan local time before storing it (UTC).
    const parsedDate = parsePakistanDate(date);
    if (date && !parsedDate) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid date format" });
    }

    // Create the record (no cumulative calculations — recalculateAllTotals handles it)
    const exp = await ExpenseModel.create({
      title,
      description,
      amount: parsedAmount,
      createdBy: req.user.id,
      category_id,
      type,
      date: parsedDate || new Date(),
      folder: folder || null,
    });

    // Recalculate all running totals from scratch
    await recalculateAllTotals(req.user.id);

    const updatedExp = await ExpenseModel.findById(exp._id).populate(
      "category_id",
    );

    return res.status(201).json({
      success: true,
      message: "Expense Created Successfully!",
      expense: updatedExp,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const UpdateExpense = async (req, res) => {
  try {
    const { title, description, amount, category_id, type, date, folder } = req.body;

    let oldRecord = await ExpenseModel.findById(req.params.id);
    if (!oldRecord || oldRecord.createdBy.toString() !== req.user.id) {
      return res.status(404).json({
        success: false,
        message: "Expense not found!",
      });
    }

    // Interpret the client date as Pakistan local time before storing it (UTC).
    // When `date` is omitted this stays undefined → mongoose keeps the old value.
    const parsedDate = parsePakistanDate(date);
    if (date && !parsedDate) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format",
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
        // date: Date.now(),
        date: parsedDate,
        ...(folder !== undefined && { folder }),
      },
      { new: true },
    );

    // Recalculate all running totals from scratch
    await recalculateAllTotals(req.user.id);

    await updatedRecord.populate("category_id");

    return res.status(200).json({
      success: true,
      message: "Expense Updated Successfully",
      updated_expense: updatedRecord,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

const GetExpenseById = async (req, res) => {
  try {
    const expense = await ExpenseModel.findById(req.params.id).populate(
      "category_id",
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
    const query = { createdBy: req.user.id };
    const { month, year, folder } = req.query;

    const monthNames = [
      "january", "february", "march", "april", "may", "june",
      "july", "august", "september", "october", "november", "december"
    ];

    if (folder) {
      const parts = folder.trim().split(/\s+/);
      if (parts.length >= 2) {
        const mIdx = monthNames.indexOf(parts[0].toLowerCase());
        const yNum = parseInt(parts[1], 10);
        if (mIdx !== -1 && !isNaN(yNum)) {
          const startDate = new Date(Date.UTC(yNum, mIdx, 1, 0, 0, 0));
          const endDate = new Date(Date.UTC(yNum, mIdx + 1, 0, 23, 59, 59, 999));
          query.$or = [
            { date: { $gte: startDate, $lte: endDate } },
            { folder: folder.trim() }
          ];
        } else {
          query.folder = folder.trim();
        }
      } else {
        query.folder = folder.trim();
      }
    } else if (month && year) {
      const mIdx = typeof month === "number" ? month - 1 : monthNames.indexOf(String(month).toLowerCase());
      const yNum = parseInt(year, 10);
      if (mIdx !== -1 && !isNaN(yNum)) {
        const startDate = new Date(Date.UTC(yNum, mIdx, 1, 0, 0, 0));
        const endDate = new Date(Date.UTC(yNum, mIdx + 1, 0, 23, 59, 59, 999));
        query.date = { $gte: startDate, $lte: endDate };
      }
    }

    let allExp = await ExpenseModel.find(query)
      .populate("category_id", "name")
      .sort({ date: -1 });

    let total_income = 0;
    let total_expense = 0;
    allExp.forEach((e) => {
      if (e.type === "Income") total_income += Number(e.amount) || 0;
      else if (e.type === "Expense") total_expense += Number(e.amount) || 0;
    });

    return res.status(200).json({
      success: true,
      message: "All Expenses",
      All_Expenses: allExp,
      summary: {
        total_income,
        total_expense,
        total_balance: total_income - total_expense,
        count: allExp.length,
      },
    });
  } catch (err) {
    // 500, not 401: a transient database error must not log the user out,
    // and the service worker only caches 200 responses.
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/**
 * Aggregates all user expenses by Month & Year folders,
 * combines them with custom-created folders from FolderModel,
 * and returns summary stats for each folder, plus the active current month summary.
 */
const GetMonthlyFolders = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Fetch all expenses for this user
    const expenses = await ExpenseModel.find({ createdBy: userId })
      .populate("category_id", "name")
      .sort({ date: -1 });

    // 2. Fetch ONLY custom user-created folders (no auto-generated or mock folders)
    const customFolders = await FolderModel.find({ createdBy: userId }).sort({
      createdAt: -1,
    });

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    let totalIncomeAll = 0;
    let totalExpenseAll = 0;

    for (const exp of expenses) {
      const amt = Number(exp.amount) || 0;
      if (exp.type === "Income") totalIncomeAll += amt;
      else if (exp.type === "Expense") totalExpenseAll += amt;
    }

    // Build folder summaries strictly for user-created custom folders
    const monthlyFolders = customFolders.map((cf) => {
      const folderTitle = (cf.name || "").trim();
      const targetLower = folderTitle.toLowerCase();

      const matchingExpenses = expenses.filter((exp) => {
        if (exp.folder && exp.folder.trim().toLowerCase() === targetLower) {
          return true;
        }
        if (exp.date) {
          const d = new Date(exp.date);
          if (!isNaN(d.getTime())) {
            const mName = monthNames[d.getMonth()].toLowerCase();
            const yStr = String(d.getFullYear());
            if (`${mName} ${yStr}` === targetLower) {
              return true;
            }
          }
        }
        return false;
      });

      let totalIncome = 0;
      let totalExpense = 0;

      for (const exp of matchingExpenses) {
        const amt = Number(exp.amount) || 0;
        if (exp.type === "Income") totalIncome += amt;
        else if (exp.type === "Expense") totalExpense += amt;
      }

      return {
        id: cf._id.toString(),
        _id: cf._id,
        name: folderTitle,
        month: cf.month || "",
        year: cf.year || "",
        theme: cf.theme || "cyan",
        count: matchingExpenses.length,
        totalIncome,
        totalExpense,
        balance: totalIncome - totalExpense,
        transactions: matchingExpenses,
        isCustom: true,
      };
    });

    // Current active folder determination: first custom folder or current calendar month fallback
    const activeFolder = monthlyFolders[0] || null;

    const now = new Date();
    const curMonthIndex = now.getMonth();
    const curYear = now.getFullYear();
    const currentMonthKey = `${monthNames[curMonthIndex]} ${curYear}`;

    let currentMonthIncome = 0;
    let currentMonthExpense = 0;
    let currentMonthCount = 0;

    if (activeFolder) {
      currentMonthIncome = activeFolder.totalIncome;
      currentMonthExpense = activeFolder.totalExpense;
      currentMonthCount = activeFolder.count;
    } else {
      expenses.forEach((exp) => {
        const d = exp.date ? new Date(exp.date) : null;
        if (d && !isNaN(d.getTime()) && d.getMonth() === curMonthIndex && d.getFullYear() === curYear) {
          const amt = Number(exp.amount) || 0;
          if (exp.type === "Income") currentMonthIncome += amt;
          else if (exp.type === "Expense") currentMonthExpense += amt;
          currentMonthCount++;
        }
      });
    }

    const currentMonthSummary = {
      name: activeFolder ? activeFolder.name : currentMonthKey,
      income: currentMonthIncome,
      expense: currentMonthExpense,
      balance: currentMonthIncome - currentMonthExpense,
      transactionCount: currentMonthCount,
    };

    const overallSummary = {
      total_income: totalIncomeAll,
      total_expense: totalExpenseAll,
      total_balance: totalIncomeAll - totalExpenseAll,
      total_transactions: expenses.length,
    };

    return res.status(200).json({
      success: true,
      monthlyFolders,
      currentMonthSummary,
      overallSummary,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/**
 * Custom Folder CRUD Operations
 */
const CreateFolder = async (req, res) => {
  try {
    const { name, month, year, theme } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Folder name is required",
      });
    }

    const folderTitle = name.trim();

    // Check if folder already exists for this user
    let existing = await FolderModel.findOne({
      createdBy: req.user.id,
      name: folderTitle,
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "A folder with this name already exists",
      });
    }

    const newFolder = await FolderModel.create({
      name: folderTitle,
      month: month || null,
      year: year || null,
      theme: theme || "cyan",
      createdBy: req.user.id,
    });

    return res.status(201).json({
      success: true,
      message: "Folder created successfully",
      folder: newFolder,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

const AllFolders = async (req, res) => {
  try {
    const folders = await FolderModel.find({ createdBy: req.user.id }).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      folders,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// Edit existing folder
const EditFolder = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, theme } = req.body;

    if (!name && !theme) {
      return res.status(400).json({
        success: false,
        message: "Provide name or theme to update",
      });
    }

    const folder = await FolderModel.findOne({
      _id: id,
      createdBy: req.user.id,
    });
    if (!folder) {
      return res.status(404).json({
        success: false,
        message: "Folder not found",
      });
    }

    const oldName = folder.name;
    const newName = name ? name.trim() : oldName;

    // Guard against duplicate folder names for this user
    if (newName !== oldName) {
      const duplicate = await FolderModel.findOne({
        createdBy: req.user.id,
        name: newName,
        _id: { $ne: id },
      });
      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: "A folder with this name already exists",
        });
      }
    }

    folder.name = newName;
    if (theme) folder.theme = theme;
    await folder.save();

    // Keep transactions pointing at the renamed folder
    if (newName !== oldName) {
      await ExpenseModel.updateMany(
        { createdBy: req.user.id, folder: oldName },
        { $set: { folder: newName } }
      );
    }

    return res.status(200).json({
      success: true,
      message: "Folder updated",
      folder,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const DeleteFolder = async (req, res) => {
  try {
    const folder = await FolderModel.findOne({ _id: req.params.id, createdBy: req.user.id });
    if (!folder) {
      return res.status(404).json({ success: false, message: 'Folder not found' });
    }

    // Mirror the frontend grouping: a transaction belongs to this folder when
    // it references the folder by name, or its date falls in the folder's month
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    const nameParts = (folder.name || '').trim().split(/\s+/);
    const monthIndex = monthNames.findIndex(
      (m) => m.toLowerCase() === (nameParts[0] || '').toLowerCase()
    );
    const year = nameParts[1] || folder.year;

    const conditions = [{ folder: folder.name }];
    if (monthIndex >= 0 && /^\d{4}$/.test(String(year || ''))) {
      conditions.push({
        date: {
          $gte: new Date(Number(year), monthIndex, 1),
          $lt: new Date(Number(year), monthIndex + 1, 1),
        },
      });
    }

    const hasExpenses = await ExpenseModel.exists({
      createdBy: req.user.id,
      $or: conditions,
    });

    if (hasExpenses) {
      return res.status(400).json({
        success: false,
        message: 'This folder has transactions. Please delete its transactions first, then delete the folder.',
      });
    }

    await FolderModel.deleteOne({ _id: folder._id });
    return res.status(200).json({ success: true, message: 'Folder deleted successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const SearchExpense = async (req, res) => {
  try {
    let findTitle = await ExpenseModel.find({
      createdBy: req.user.id,
      title: {
        $regex: new RegExp(req.params.title, "i"),
      },
    });

    if (!findTitle) {
      return res.status(401).json({
        success: false,
        message: "Title not found!!",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Expense Founded",
      Expense: findTitle,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

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

    return res.status(200).json({
      success: true,
      message: "Deleted Successfully",
      Expense: deleteExp,
    });
  } catch (err) {
    // res.send() answers 200, so the client (and the offline outbox) would
    // report a delete that never happened.
    res.status(500).json({ success: false, message: err.message });
  }
};

// Excel report
// const exportExpensesToExcel = async (req, res) => {
//   try {
//     const userId = req.user?.id;
//     if (!userId) return res.status(401).json({ message: 'Unauthorized' });

//     const { startDate, endDate } = req.body;
//     if (!startDate || !endDate) {
//       return res.status(400).json({
//         success: false,
//         message: 'startDate and endDate are required',
//         example: { startDate: "2025-12-01", endDate: "2025-12-30" }
//       });
//     }

//     const start = startOfDay(new Date(startDate));
//     const end = endOfDay(new Date(endDate));

//     if (isNaN(start) || isNaN(end) || start > end) {
//       return res.status(400).json({ message: 'Invalid date range' });
//     }

//     const expenses = await ExpenseModel.find({
//       createdBy: userId,
//       date: { $gte: start, $lte: end }
//     })
//       .populate('category_id', 'name')
//       .sort({ date: -1 });

//     if (expenses.length === 0) {
//       return res.status(404).json({ message: 'No transactions found' });
//     }

//     const workbook = new ExcelJS.Workbook();
//     const ws = workbook.addWorksheet('Finance Report', {
//       pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true },
//     });

//     // === TITLE ===
//     ws.mergeCells('A1:G1');
//     const titleCell = ws.getCell('A1');
//     titleCell.value = 'Personal Finance Report';
//     titleCell.font = { name: 'Segoe UI', size: 22, bold: true, color: { argb: 'FFFFFFFF' } };
//     titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
//     titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2c3e50' } };

//     // === PERIOD ===
//     ws.mergeCells('A2:G2');
//     const periodCell = ws.getCell('A2');
//     periodCell.value = `${start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} – ${end.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
//     periodCell.font = { size: 14, italic: true, color: { argb: 'FF34495e' } };
//     periodCell.alignment = { horizontal: 'center' };

//     ws.addRow([]);

//     // === TABLE STARTS AT ROW 4 ===
//     const tableStartRow = 4;

//     // === FIXED HEADERS ===
//     const headers = ['Date', 'Title', 'Description', 'Category', 'Type', 'Amount'];
//     const headerRow = ws.addRow(headers);
//     headerRow.height = 35;

//     for (let i = 1; i <= 6; i++) {
//       const cell = headerRow.getCell(i);
//       cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
//       cell.fill = {
//         type: 'pattern',
//         pattern: 'solid',
//         fgColor: { argb: 'FF3498db' }
//       };
//       cell.alignment = { vertical: 'middle', horizontal: 'center' };
//       cell.border = {
//         top: { style: 'thin' },
//         left: { style: 'thin' },
//         bottom: { style: 'thin' },
//         right: { style: 'thin' }
//       };
//     }

//     ws.columns = [
//       { width: 15 }, { width: 24 }, { width: 36 }, { width: 18 }, { width: 12 }, { width: 18 }
//     ];

//     let totalIncome = 0;
//     let totalExpense = 0;

//     expenses.forEach(exp => {
//       const row = ws.addRow([
//         exp.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
//         exp.title || '-',
//         exp.description || '-',
//         exp.category_id?.name || '',
//         exp.type,
//         exp.amount
//       ]);

//       const amountCell = row.getCell(6);
//       amountCell.numFmt = '"Rs. "#,##0.00';
//       amountCell.font = { bold: true, color: { argb: 'FF2c3e50' } };
//       amountCell.alignment = { horizontal: 'right' };

//       const typeCell = row.getCell(5);
//       if (exp.type === 'Income') {
//         typeCell.font = { color: { argb: 'FF27ae60' }, bold: true };
//         totalIncome += exp.amount;
//       } else {
//         typeCell.font = { color: { argb: 'FF8e44ad' }, bold: true };
//         totalExpense += exp.amount;
//       }

//       row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: row.number % 2 === 0 ? 'FFF8F9FA' : 'FFFFFFFF' } };
//       row.eachCell(cell => {
//         cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
//       });
//     });

//     // === SUMMARY BOX ===
//     const lastRow = ws.rowCount;
//     const summaryStart = lastRow + 3;

//     ws.mergeCells(`C${summaryStart}:D${summaryStart}`);
//     ws.getCell(`C${summaryStart}`).value = 'Total Income';
//     ws.getCell(`C${summaryStart}`).font = { bold: true, size: 15, color: { argb: 'FFFFFFFF' } };
//     ws.getCell(`C${summaryStart}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF27ae60' } };
//     ws.getCell(`C${summaryStart}`).alignment = { horizontal: 'center' };

//     ws.mergeCells(`E${summaryStart}:F${summaryStart}`);
//     ws.getCell(`E${summaryStart}`).value = totalIncome;
//     ws.getCell(`E${summaryStart}`).numFmt = '"Rs. "#,##0.00';
//     ws.getCell(`E${summaryStart}`).font = { bold: true, size: 15, color: { argb: 'FFFFFFFF' } };
//     ws.getCell(`E${summaryStart}`).alignment = { horizontal: 'right' };
//     ws.getCell(`E${summaryStart}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF27ae60' } };

//     ws.mergeCells(`C${summaryStart + 2}:D${summaryStart + 2}`);
//     ws.getCell(`C${summaryStart + 2}`).value = 'Total Expense';
//     ws.getCell(`C${summaryStart + 2}`).font = { bold: true, size: 15, color: { argb: 'FFFFFFFF' } };
//     ws.getCell(`C${summaryStart + 2}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF9b59b6' } };

//     ws.mergeCells(`E${summaryStart + 2}:F${summaryStart + 2}`);
//     ws.getCell(`E${summaryStart + 2}`).value = totalExpense;
//     ws.getCell(`E${summaryStart + 2}`).numFmt = '"Rs. "#,##0.00';
//     ws.getCell(`E${summaryStart + 2}`).font = { bold: true, size: 15, color: { argb: 'FFFFFFFF' } };
//     ws.getCell(`E${summaryStart + 2}`).alignment = { horizontal: 'right' };
//     ws.getCell(`E${summaryStart + 2}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF9b59b6' } };

//     const balance = totalIncome - totalExpense;
//     ws.mergeCells(`C${summaryStart + 4}:D${summaryStart + 4}`);
//     ws.getCell(`C${summaryStart + 4}`).value = 'Balance';
//     ws.getCell(`C${summaryStart + 4}`).font = { bold: true, size: 18, color: { argb: 'FFFFFFFF' } };
//     ws.getCell(`C${summaryStart + 4}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16a085' } };

//     ws.mergeCells(`E${summaryStart + 4}:F${summaryStart + 4}`);
//     ws.getCell(`E${summaryStart + 4}`).value = balance;
//     ws.getCell(`E${summaryStart + 4}`).numFmt = '"Rs. "#,##0.00';
//     ws.getCell(`E${summaryStart + 4}`).font = { bold: true, size: 20, color: { argb: 'FFFFFFFF' } };
//     ws.getCell(`E${summaryStart + 4}`).alignment = { horizontal: 'right' };
//     ws.getCell(`E${summaryStart + 4}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16a085' } };

//     const fileName = `Finance_Report_${startDate}_to_${endDate}.xlsx`;
//     res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
//     res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

//     await workbook.xlsx.write(res);
//     res.status(200).end();

//   } catch (error) {
//     console.error('Export Error:', error);
//     res.status(500).json({ message: 'Failed to generate report' });
//   }
// };

const exportExpensesToExcel = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { startDate, endDate } = req.body;
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "startDate and endDate are required",
        example: { startDate: "2025-12-01", endDate: "2025-12-30" },
      });
    }

    // Interpret the range as Pakistan local time (UTC+5, no DST) so the report
    // matches the exact Pakistan days the user selects.
    const start = parsePakistanDate(startDate);
    const rawEnd = parsePakistanDate(endDate);
    const end = rawEnd
      ? new Date(rawEnd.getTime() + 24 * 60 * 60 * 1000 - 1) // last ms of the Pakistan end day
      : undefined;

    if (isNaN(start) || isNaN(end) || start > end) {
      return res.status(400).json({ message: "Invalid date range" });
    }

    const expenses = await ExpenseModel.find({
      createdBy: userId,
      date: { $gte: start, $lte: end },
    })
      .populate("category_id", "name")
      .sort({ date: -1 });

    if (expenses.length === 0) {
      return res.status(404).json({ message: "No transactions found" });
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "ExpenseFlow";
    workbook.created = new Date();

    const ws = workbook.addWorksheet("Finance Report", {
      pageSetup: {
        paperSize: 9,
        orientation: "landscape",
        fitToPage: true,
        horizontalCentered: true,
      },
      views: [{ showGridLines: false }],
    });

    // Columns: A = margin, B-G = content, H = margin
    ws.columns = [
      { width: 3 }, // A margin
      { width: 16 }, // B Date
      { width: 22 }, // C Title
      { width: 14 }, // D Type          ← moved here
      { width: 32 }, // E Description
      { width: 18 }, // F Category
      { width: 18 }, // G Amount
      { width: 3 }, // H margin
    ];

    // === TITLE ===
    ws.mergeCells("B2:G2");
    const titleCell = ws.getCell("B2");
    titleCell.value = "Personal Finance Report";
    titleCell.font = {
      name: "Segoe UI",
      size: 22,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    titleCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0f172a" },
    };
    ws.getRow(2).height = 40;

    // === PERIOD ===
    ws.mergeCells("B3:G3");
    const periodCell = ws.getCell("B3");
    periodCell.value = `${start.toLocaleDateString("en-IN", { timeZone: "Asia/Karachi", day: "numeric", month: "short", year: "numeric" })} – ${end.toLocaleDateString("en-IN", { timeZone: "Asia/Karachi", day: "numeric", month: "short", year: "numeric" })}   |   ${expenses.length} Transactions`;
    periodCell.font = { size: 12, italic: true, color: { argb: "FF64748b" } };
    periodCell.alignment = { horizontal: "center" };
    ws.getRow(3).height = 22;

    ws.addRow([]);

    // === SUMMARY CARDS (3 boxes side by side) ===
    let totalIncome = 0;
    let totalExpense = 0;

    expenses.forEach((exp) => {
      if (exp.type === "Income") totalIncome += exp.amount;
      else totalExpense += exp.amount;
    });
    const balance = totalIncome - totalExpense;

    const cardRow = 5;
    ws.mergeCells(`B${cardRow}:C${cardRow}`);
    ws.getCell(`B${cardRow}`).value = "TOTAL INCOME";
    ws.getCell(`B${cardRow}`).font = {
      size: 10,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    ws.getCell(`B${cardRow}`).alignment = { horizontal: "center" };
    ws.getCell(`B${cardRow}`).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF10b981" },
    };

    ws.mergeCells(`D${cardRow}:E${cardRow}`);
    ws.getCell(`D${cardRow}`).value = "TOTAL EXPENSE";
    ws.getCell(`D${cardRow}`).font = {
      size: 10,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    ws.getCell(`D${cardRow}`).alignment = { horizontal: "center" };
    ws.getCell(`D${cardRow}`).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFef4444" },
    };

    ws.mergeCells(`F${cardRow}:G${cardRow}`);
    ws.getCell(`F${cardRow}`).value = "NET BALANCE";
    ws.getCell(`F${cardRow}`).font = {
      size: 10,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    ws.getCell(`F${cardRow}`).alignment = { horizontal: "center" };
    ws.getCell(`F${cardRow}`).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF06b6d4" },
    };
    ws.getRow(cardRow).height = 20;

    const valRow = cardRow + 1;
    ws.mergeCells(`B${valRow}:C${valRow}`);
    ws.getCell(`B${valRow}`).value = totalIncome;
    ws.getCell(`B${valRow}`).numFmt = '"Rs. "#,##0.00';
    ws.getCell(`B${valRow}`).font = {
      size: 16,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    ws.getCell(`B${valRow}`).alignment = { horizontal: "center" };
    ws.getCell(`B${valRow}`).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF10b981" },
    };

    ws.mergeCells(`D${valRow}:E${valRow}`);
    ws.getCell(`D${valRow}`).value = totalExpense;
    ws.getCell(`D${valRow}`).numFmt = '"Rs. "#,##0.00';
    ws.getCell(`D${valRow}`).font = {
      size: 16,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    ws.getCell(`D${valRow}`).alignment = { horizontal: "center" };
    ws.getCell(`D${valRow}`).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFef4444" },
    };

    ws.mergeCells(`F${valRow}:G${valRow}`);
    ws.getCell(`F${valRow}`).value = balance;
    ws.getCell(`F${valRow}`).numFmt = '"Rs. "#,##0.00';
    ws.getCell(`F${valRow}`).font = {
      size: 16,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    ws.getCell(`F${valRow}`).alignment = { horizontal: "center" };
    ws.getCell(`F${valRow}`).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF06b6d4" },
    };
    ws.getRow(valRow).height = 32;

    ws.addRow([]);
    ws.addRow([]);

    // === CATEGORY BREAKDOWN (right side box) ===
    // Calculate category totals
    const categoryTotals = {};
    expenses.forEach((exp) => {
      const catName = exp.category_id?.name || "Uncategorized";
      if (!categoryTotals[catName])
        categoryTotals[catName] = { income: 0, expense: 0 };
      if (exp.type === "Income") {
        categoryTotals[catName].income += exp.amount;
      } else {
        categoryTotals[catName].expense += exp.amount;
      }
    });

    const sortedCategories = Object.entries(categoryTotals).sort(
      (a, b) => b[1].expense + b[1].income - (a[1].expense + a[1].income),
    );

    // Set column widths for the side panel (I, J, K, L)
    ws.getColumn("I").width = 3; // margin
    ws.getColumn("J").width = 20; // Category name
    ws.getColumn("K").width = 16; // Amount
    ws.getColumn("L").width = 20; // Visual bar

    // Header banner for side panel — aligned with title row (row 2)
    ws.mergeCells("J2:L2");
    const sideTitle = ws.getCell("J2");
    sideTitle.value = "📊 Category Breakdown";
    sideTitle.font = {
      name: "Segoe UI",
      size: 14,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    sideTitle.alignment = { horizontal: "center", vertical: "middle" };
    sideTitle.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0f172a" },
    };

    // Table header — aligned with the summary cards row (row 5)
    ws.mergeCells("J5:L5");
    const sideSub = ws.getCell("J5");
    sideSub.value = "Expense share by category";
    sideSub.font = { size: 10, italic: true, color: { argb: "FF64748b" } };
    sideSub.alignment = { horizontal: "center" };

    const sideHeaderRowNum = 7;
    const sideHeaderRow = ws.getRow(sideHeaderRowNum);
    ["Category", "Amount", "Share"].forEach((h, i) => {
      const cell = sideHeaderRow.getCell(10 + i); // J=10, K=11, L=12
      cell.value = h;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF334155" },
      };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });
    sideHeaderRow.height = 24;

    let sideRowNum = sideHeaderRowNum + 1;
    sortedCategories.forEach(([name, totals], idx) => {
      const row = ws.getRow(sideRowNum);
      const catExpense = totals.expense;
      const sharePercent = totalExpense > 0 ? catExpense / totalExpense : 0;

      row.getCell(10).value = name;
      row.getCell(10).font = { size: 11 };

      row.getCell(11).value = catExpense;
      row.getCell(11).numFmt = '"Rs. "#,##0';
      row.getCell(11).font = { bold: true, color: { argb: "FFef4444" } };
      row.getCell(11).alignment = { horizontal: "right" };

      row.getCell(12).value = sharePercent;
      row.getCell(12).numFmt = "0.0%";
      row.getCell(12).font = { size: 10, color: { argb: "FF64748b" } };
      row.getCell(12).alignment = { horizontal: "center" };

      const bg = idx % 2 === 0 ? "FFF8FAFC" : "FFFFFFFF";
      [10, 11, 12].forEach((c) => {
        row.getCell(c).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: bg },
        };
        row.getCell(c).border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } },
        };
      });
      row.height = 20;
      sideRowNum += 1;
    });

    // Total Expense footer for side panel
    ws.mergeCells(`J${sideRowNum}:K${sideRowNum}`);
    ws.getCell(`J${sideRowNum}`).value = "Total Expense";
    ws.getCell(`J${sideRowNum}`).font = {
      bold: true,
      size: 11,
      color: { argb: "FFFFFFFF" },
    };
    ws.getCell(`J${sideRowNum}`).alignment = {
      horizontal: "right",
      vertical: "middle",
    };
    ws.getCell(`J${sideRowNum}`).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0f172a" },
    };

    ws.getCell(`L${sideRowNum}`).value = totalExpense;
    ws.getCell(`L${sideRowNum}`).numFmt = '"Rs. "#,##0.00';
    ws.getCell(`L${sideRowNum}`).font = {
      bold: true,
      size: 11,
      color: { argb: "FFFFFFFF" },
    };
    ws.getCell(`L${sideRowNum}`).alignment = {
      horizontal: "right",
      vertical: "middle",
    };
    ws.getCell(`L${sideRowNum}`).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0f172a" },
    };
    ws.getRow(sideRowNum).height = 24;

    // === TABLE HEADER ===
    const headerRowNum = valRow + 3;
    const headers = [
      "Date",
      "Title",
      "Type",
      "Description",
      "Category",
      "Amount",
    ]; // ← reordered
    const headerRow = ws.getRow(headerRowNum);
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(2 + i); // starts at column B
      cell.value = h;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF334155" },
      };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });
    headerRow.height = 30;

    // === TABLE ROWS ===
    let currentRow = headerRowNum + 1;
    expenses.forEach((exp, idx) => {
      const row = ws.getRow(currentRow);
      row.getCell(2).value = exp.date.toLocaleDateString("en-IN", {
        timeZone: "Asia/Karachi",
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      row.getCell(3).value = exp.title || "-";
      row.getCell(4).value = exp.type; // ← Type now in column D
      row.getCell(5).value = exp.description || "-"; // ← Description moved to E
      row.getCell(6).value = exp.category_id?.name || "Uncategorized"; // ← Category moved to F
      row.getCell(7).value = exp.amount; // ← Amount stays in G
      row.getCell(7).numFmt = '"Rs. "#,##0.00';
      row.getCell(7).alignment = { horizontal: "right" };
      row.getCell(7).font = { bold: true, color: { argb: "FF0f172a" } };

      row.getCell(4).alignment = { horizontal: "center" }; // ← Type styling now on column D
      if (exp.type === "Income") {
        row.getCell(4).font = { color: { argb: "FF10b981" }, bold: true };
      } else {
        row.getCell(4).font = { color: { argb: "FFef4444" }, bold: true };
      }

      const bg = idx % 2 === 0 ? "FFF8FAFC" : "FFFFFFFF";
      for (let c = 2; c <= 7; c++) {
        row.getCell(c).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: bg },
        };
        row.getCell(c).border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } },
        };
      }
      row.height = 20;
      currentRow += 1;
    });

    // === TOTALS ROW (right under table) ===
    const totalsRow = ws.getRow(currentRow + 1);
    ws.mergeCells(`B${currentRow + 1}:F${currentRow + 1}`);
    totalsRow.getCell(2).value = "Net Balance";
    totalsRow.getCell(2).font = {
      bold: true,
      size: 13,
      color: { argb: "FFFFFFFF" },
    };
    totalsRow.getCell(2).alignment = {
      horizontal: "right",
      vertical: "middle",
    };
    totalsRow.getCell(2).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0f172a" },
    };

    totalsRow.getCell(7).value = balance;
    totalsRow.getCell(7).numFmt = '"Rs. "#,##0.00';
    totalsRow.getCell(7).font = {
      bold: true,
      size: 14,
      color: { argb: "FFFFFFFF" },
    };
    totalsRow.getCell(7).alignment = {
      horizontal: "right",
      vertical: "middle",
    };
    totalsRow.getCell(7).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0f172a" },
    };
    totalsRow.height = 28;

    const fileName = `Finance_Report_${startDate}_to_${endDate}.xlsx`;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    await workbook.xlsx.write(res);
    res.status(200).end();
  } catch (error) {
    console.error("Export Error:", error);
    res.status(500).json({ message: "Failed to generate report" });
  }
};
module.exports = {
  CreateExpense,
  UpdateExpense,
  GetExpenseById,
  AllExpense,
  SearchExpense,
  DeleteExpense,
  exportExpensesToExcel,
  GetMonthlyFolders,
  CreateFolder,
  AllFolders,
  EditFolder,
  DeleteFolder,
};
