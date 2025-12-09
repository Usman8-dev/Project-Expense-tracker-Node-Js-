const ExpenseModel = require("../Models/ExpenseModel")
const ExcelJS = require('exceljs');
// const { startOfDay, endOfDay } = require('date-fns'); // Optional, but cleaner
const { startOfDay, endOfDay } = require('date-fns');

const CreateExpense = async (req, res) => {
    try {
        let { title, description, amount, category_id, type } = req.body;

        // 1️⃣ Get last saved balance
        const lastRecord = await ExpenseModel.find().sort({ date: -1 }).limit(1);
        let lastBalance = lastRecord[0]?.total_balance || 0;

        // 2️⃣ Determine income / expense value
        let income = 0;
        let expense = 0;

        if (type === "Income") {
            income = amount;
            expense = 0;
        } else if (type === "Expense") {
            expense = amount;
            income = 0;
        }

        // 3️⃣ Calculate new total balance
        const total_balance = type === "Income"
            ? lastBalance + amount
            : lastBalance - amount;


        let exp = await ExpenseModel.create({
            title,
            description,
            amount,
            createdBy: req.user.id,
            category_id,
            type,
            income,
            expense,
            total_balance,
        })

        await exp.save();
        await exp.populate("category_id");
        return res.status(201).json({
            success: true,
            message: "Expense Created Successfully!",
            expense: exp,
        });
    } catch (err) {
        res.send(err.message);
    }
}

const UpdateExpense = async (req, res) => {
    try {
        let { title, description, amount, category_id, type } = req.body;
        let findExp = await ExpenseModel.findById(req.params.id);
        if (!findExp) {
            return res.status(404).json({
                success: false,
                message: "Expense not found!"
            });
        }

        let editExp = await ExpenseModel.findOneAndUpdate(
            {
                _id: req.params.id,
            }, {
            title,
            description,
            amount,
            category_id,
            type,
        }, {
            new: true,
        }
        )
        await editExp.populate("category_id");
        return res.status(404).json({
            success: true,
            message: "Expense Updated Successfully",
            Update_Expense: editExp,
        });
    } catch (err) {
        res.send(err.message);
    }
}

const AllExpense = async (req, res) => {
    try {
        let allExp = await ExpenseModel.find({ createdBy: req.user.id }).sort({ date: -1 });
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
        // let findTitle = await ExpenseModel.findOne({title: req.params.title});
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
        // res.send(err.message);
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

        ws.addRow([]); // Spacer

        // === TABLE STARTS AT ROW 4 ===
        const tableStartRow = 4;

        // === FIXED HEADERS - NO OVERFLOW ===
        const headers = ['Date', 'Title', 'Description', 'Category', 'Type', 'Amount'];
        const headerRow = ws.addRow(headers);
        headerRow.height = 35;

        // Apply style only to the 6 real columns (A to F)
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

        // Column widths (prevents stretching)
        ws.columns = [
            { width: 15 }, { width: 24 }, { width: 36 }, { width: 18 }, { width: 12 }, { width: 18 }
        ];

        let totalIncome = 0;
        let totalExpense = 0;

        expenses.forEach(exp => {
            const row = ws.addRow([
                exp.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }), // 20-Dec-2025
                exp.title || '-',
                exp.description || '-',
                exp.category_id?.name || '', // BLANK if no category
                exp.type,
                exp.amount
            ]);

            // Amount formatting
            const amountCell = row.getCell(6);
            amountCell.numFmt = '"Rs. "#,##0.00';
            amountCell.font = { bold: true, color: { argb: 'FF2c3e50' } };
            amountCell.alignment = { horizontal: 'right' };

            // Type coloring
            const typeCell = row.getCell(5);
            if (exp.type === 'Income') {
                typeCell.font = { color: { argb: 'FF27ae60' }, bold: true };
                totalIncome += exp.amount;
            } else {
                typeCell.font = { color: { argb: 'FF8e44ad' }, bold: true };
                totalExpense += exp.amount;
            }

            // Zebra + borders
            row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: row.number % 2 === 0 ? 'FFF8F9FA' : 'FFFFFFFF' } };
            row.eachCell(cell => {
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            });
        });

        // === BEAUTIFUL CENTERED SUMMARY BOX ===
        const lastRow = ws.rowCount;
        const summaryStart = lastRow + 3;

        // Total Income
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

        // Total Expense
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

        // Balance
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

        // === FILE DOWNLOAD ===
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
module.exports = { CreateExpense, UpdateExpense, AllExpense, SearchExpense, DeleteExpense, exportExpensesToExcel }