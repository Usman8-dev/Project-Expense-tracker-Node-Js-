const ExpenseModel = require("../Models/ExpenseModel")


const CreateExpense = async (req, res) => {
    try {
        let { title, description, amount, category_id, type} = req.body;
        let exp = await ExpenseModel.create({
            title,
            description,
            amount,
            createdBy: req.user.id,
            category_id,
            type,
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
        let { title, description, amount,category_id, type } = req.body;
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

module.exports = { CreateExpense, UpdateExpense, AllExpense, SearchExpense, DeleteExpense }