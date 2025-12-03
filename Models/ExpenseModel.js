const mongoose = require('mongoose');

const ExpenseModel = mongoose.Schema({
    title: String,
    description: String,
    amount: Number,
})

module.exports = mongoose.model('expense', ExpenseModel);