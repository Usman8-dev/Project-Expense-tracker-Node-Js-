const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const UserModel = require('../Models/UserModel');

const IsLoginUser = async (req, res, next) => {
    if (!req.cookies.token) {
        return res.status(401).json({
            success: false,
            message: 'Please Try Again.'
        });
    } else {
        try {
            var decoded = jwt.verify(req.cookies.token, process.env.JWT_KEY);
            let user = await UserModel.findOne({ email: decoded.email }).select('-password');

            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'User not found.'
                });
            }
            req.user = user;
            next();
        } catch (err) {
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired token. Please login again.'
            });
        }
    }
}

module.exports = { IsLoginUser };