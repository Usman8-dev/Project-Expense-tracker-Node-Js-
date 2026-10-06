
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const UserModel = require('../Models/UserModel');
const generateToken = require('../utils/generateToken');

// The frontend stores this object in localStorage - never include the hash.
const publicUser = (user) => {
    const plain = typeof user.toObject === 'function' ? user.toObject() : { ...user };
    delete plain.password;
    return plain;
};

const RegisterUser = async (req, res) => {

    try {
        let { name, age, email, password } = req.body;

        // if use check
        let finduser = await UserModel.findOne({ email: email });
        if (finduser) {
            return res.status(201).json({
                success: false,
                message: "Your Account Already Register. Please login!!!",
            });
        } else {

            bcrypt.genSalt(10, function (err, salt) {
                bcrypt.hash(password, salt, async (err, hash) => {
                    if (err) {
                        return res.status(500).json({ success: false, message: err.message });
                    }
                    else {
                        let user = await UserModel.create({
                            name,
                            age,
                            email,
                            password: hash,
                        })

                        let token = generateToken(user);
                        res.cookie('token', token);

                        return res.status(201).json({
                            success: true,
                            message: "Registration successful",
                            user: publicUser(user),
                            token: token,
                        });

                    }

                });
            });
        }
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
const LoginUser = async (req, res) => {
    try {
        let { email, password } = req.body;

        let finduserLogin = await UserModel.findOne({ email: email });
        if (!finduserLogin) {
            return res.status(401).json({
                success: false,
                message: "Email or Password is Invalid",
            });
        } else {
            bcrypt.compare(password, finduserLogin.password, function (err, result) {
                if (result) {
                    let token = generateToken(finduserLogin);
                    res.cookie('token', token);

                    return res.status(201).json({
                        success: true,
                        message: "Login successfully",
                        user: publicUser(finduserLogin),
                        token: token,
                    });
                } else {
                    return res.status(401).json({
                        success: false,
                        message: "Email or Password is Invalid",
                    });
                }
            });
        }
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

const LogoutUser = async (req, res) => {
    res.clearCookie('token', { path: '/' });
    return res.status(200).json({
        success: true,
        message: "Logout Successfully",
    });

}
module.exports = { RegisterUser, LoginUser, LogoutUser }