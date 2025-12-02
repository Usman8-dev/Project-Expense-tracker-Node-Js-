
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const UserModel = require('../Models/UserModel');

const RegisterUser = async (req, res) => {

    try {
        let { name, age, email, password } = req.body;

        // if use check
        let finduser = await UserModel.findOne({ email: email });
        if (finduser) {
            return res.status(401).send('Your Account Already Register. Please login!!!');
        } else {

            bcrypt.genSalt(10, function (err, salt) {
                bcrypt.hash(password, salt, async (err, hash) => {
                    if (err) {
                        return res.send(err.message);
                    }
                    else {
                        let user = await userModel.create({
                            Name,
                            email,
                            password: hash,
                        })

                        let token = generateToken(user);
                        res.cookie('token', token);

                        // res.send(user);
                        return res.status(201).json({
                            success: true,
                            message: "Registration successful",
                            user: user,
                            token
                        });

                    }

                });
            });
        }
    }
    catch (err) {
        res.send(err.message);
    }
}