const mongoose = require('mongoose');

const UserModel = mongoose.Schema({
    name: String,
    age: Number,
    email: String,
    password: String,
    // expense: [
    //     {
    //         type: mongoose.Schema.Types.ObjectId,
    //         ref: expenses,
    //     }
    // ]
})

module.exports = mongoose.model('user', UserModel);