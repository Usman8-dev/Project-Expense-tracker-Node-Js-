const jwt = require('jsonwebtoken');
const UserModel = require('../Models/UserModel');

const IsLoginUser = async (req, res, next) => {
    try {
        let token;

        // Check Authorization header first (Bearer token)
        if (req.headers.authorization) {
            token = req.headers.authorization.split(' ')[1]; // Extract "token" from "Bearer token"
        }
        // Fall back to cookies if no Authorization header
        else if (req.cookies.token) {
            token = req.cookies.token;
        }

        // If no token found in either location
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Please login again. No token provided.'
            });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_KEY);
        
        // Find user
        const user = await UserModel.findOne({ email: decoded.email }).select('-password');

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found.'
            });
        }

        req.user = user;
        next();
    } catch (err) {
        console.error('Auth error:', err.message);
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired token. Please login again.'
        });
    }
};

module.exports = { IsLoginUser };