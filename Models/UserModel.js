const mongoose = require('mongoose');

const UserModel = mongoose.Schema({
    name: String,
    age: Number,
    email: String,
    password: String,
    resetPasswordToken: String,
    resetPasswordExpires: Date,
});

module.exports = mongoose.model('user', UserModel);