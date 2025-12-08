const CategoryModel = require("../Models/CategoryModel");

const CreateCategory = async (req, res) => {
    try {
        let { name } = req.body;
        if (!req.user || !req.user.id) {
            return res.status(401).json({ message: "Unauthorized: User not found in request" });
        }
        let category = await CategoryModel.create({
            name,
            createdBy: req.user.id,
        })
        await category.save();
        return res.status(201).json({
            success: true,
            message: "Category Created Successfully!",
            expense: category,
        });
    } catch (err) {
        res.send(err.message);
    }
}
const UpdateCategory = async (req, res) => {
    try {
        let { name } = req.body;
        let findCategory = await CategoryModel.findById(req.params.id);
        if (!findCategory) {
            return res.status(404).json({
                success: false,
                message: "Category not found!"
            });
        }

        let editCategory = await CategoryModel.findOneAndUpdate(
            {
                _id: req.params.id,
            }, {
            name
        }, {
            new: true,
        }
        )
        return res.status(404).json({
            success: true,
            message: "Category Updated Successfully",
            Update_Expense: editCategory,
        });
    } catch (err) {
        res.send(err.message);
    }
}

const AllCategory = async (req, res) => {
    try {
        let allCategory = await CategoryModel.find({ createdBy: req.user.id }).sort({ date: -1 });
        return res.status(201).json({
            success: true,
            message: "All Categories",
            All_Expenses: allCategory,
        });
    } catch (err) {
        res.send(err.message);
    }
}

const DeleteCategory = async (req, res) => {
    try {
        let deleteCategory = await CategoryModel.findByIdAndDelete(req.params.id);

        if (!deleteCategory) {
            return res.status(201).json({
                success: true,
                message: "Not found!",
            });
        }
        return res.status(201).json({
            success: true,
            message: "Deleted Successfully",
            Expense: deleteCategory,
        });
    } catch (err) {
        res.send(err.message);
    }
}

module.exports = { CreateCategory, UpdateCategory, AllCategory, DeleteCategory }