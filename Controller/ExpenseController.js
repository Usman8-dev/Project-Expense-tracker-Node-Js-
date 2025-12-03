const ExpenseModel = require("../Models/ExpenseModel")


const CreateExpense = async (req, res) => {
    try {
        let { title, description, amount } = req.body;
        let exp = await ExpenseModel.create({
            title,
            description,
            amount,
        })
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
        let { title, description, amount } = req.body;
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
        }, {
            new: true,
        }
        )
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
        let allExp = await ExpenseModel.find();
        return res.status(201).json({
            success: true,
            message: "All Expenses",
            All_Expenses: allExp,
        });

    } catch (err) {
        res.send.status(401).json({
            err: message,
        })
    }
}

module.exports = { CreateExpense, UpdateExpense, AllExpense }