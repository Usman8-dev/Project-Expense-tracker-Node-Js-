const jwt = require('jsonwebtoken');
const UserModel = require('../Models/UserModel');

/**
 * The frontend keeps the JWT in localStorage and sends it as
 * `Authorization: Bearer <token>`; browsers also forward the httpOnly
 * cookie when the API is called same-site. Accept either one.
 */
function extractToken(req) {
    const header = req.headers.authorization || req.headers.Authorization || '';
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
        const bearer = header.slice(7).trim();
        if (bearer && bearer !== 'undefined' && bearer !== 'null') return bearer;
    }
    if (req.cookies && req.cookies.token) return req.cookies.token;
    return null;
}

const IsLoginUser = async (req, res, next) => {
    const token = extractToken(req);

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required. Please login again.'
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_KEY);
        const user = await UserModel.findOne({ email: decoded.email }).select('-password');

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found.'
            });
        }

        req.user = user;
        req.token = token;
        next();
    } catch (err) {
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired token. Please login again.'
        });
    }
}

module.exports = { IsLoginUser, extractToken };
