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
            // `category` is the key the frontend reads; `expense` is kept so
            // older clients keep working.
            category,
            expense: category,
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
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
        return res.status(200).json({
            success: true,
            message: "Category Updated Successfully",
            category: editCategory,
            Update_Expense: editCategory,
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

const AllCategory = async (req, res) => {
    try {
        let allCategory = await CategoryModel.find({ createdBy: req.user.id }).sort({ date: -1 });
        // 200 (not 201): the service worker only caches successful GET
        // responses, so 201 would leave the categories unavailable offline.
        return res.status(200).json({
            success: true,
            message: "All Categories",
            All_Categories: allCategory,
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

const GetCategoryById = async (req, res) => {
  try {
    const category = await CategoryModel.findById(req.params.id);

    if (!category || category.createdBy.toString() !== req.user.id) {
      return res.status(404).json({
        success: false,
        message: "Category not found!",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Category fetched successfully",
      category,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

const DeleteCategory = async (req, res) => {
    try {
        let deleteCategory = await CategoryModel.findByIdAndDelete(req.params.id);

        if (!deleteCategory) {
            return res.status(201).json({
                success: true,
                message: "Not found!",
            });
        }
        return res.status(200).json({
            success: true,
            message: "Deleted Successfully",
            category: deleteCategory,
            Expense: deleteCategory,
        });
    } catch (err) {
        // Must be an error status: res.send() returns 200, which would make
        // the offline outbox drop a delete that never happened.
        res.status(500).json({ success: false, message: err.message });
    }
}

module.exports = { CreateCategory, UpdateCategory, AllCategory, DeleteCategory, GetCategoryById }