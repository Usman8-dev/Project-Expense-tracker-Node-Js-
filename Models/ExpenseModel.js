const mongoose = require('mongoose');

const ExpenseModel = mongoose.Schema({
    title: String,
    description: String,
    amount: Number,
    date: {
        type: Date,
        default: Date.now
    },
    createdBy:
    {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
    }
    ,
    category_id:
    {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'category',
    },
    type: {
        type: String,
        enum: ['Expense', 'Income'], 
    }
})

module.exports = mongoose.model('expense', ExpenseModel);