const mongoose = require('mongoose')

const CategoryModel = mongoose.Schema({
    name: String,
    date: {
        type: Date,
        default: Date.now,
    },
    createdBy: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'user',
            }
        ]
})

module.exports = mongoose.model('category', CategoryModel);