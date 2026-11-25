
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const UserModel = require('../Models/UserModel');
const generateToken = require('../utils/generateToken');
const sendEmail = require('../utils/sendEmail');

// The frontend stores this object in localStorage - never include the hash or reset tokens.
const publicUser = (user) => {
    const plain = typeof user.toObject === 'function' ? user.toObject() : { ...user };
    delete plain.password;
    delete plain.resetPasswordToken;
    delete plain.resetPasswordExpires;
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

const ForgotPassword = async (req, res) => {
    try {
        const email = String(req.body.email || '').trim();
        const user = await UserModel.findOne({ email });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "No account found with this email address",
            });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

        user.resetPasswordToken = hashedToken;
        user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        await user.save();

        const defaultClientUrl = (process.env.CLIENT_URL || 'http://localhost:5173')
            .split(',')[0]
            .trim()
            .replace(/\/+$/, '');
        const requestOrigin = req.headers.origin ? req.headers.origin.replace(/\/+$/, '') : '';
        const clientBaseUrl = requestOrigin || defaultClientUrl;
        const resetUrl = `${clientBaseUrl}/reset-password/${resetToken}`;

        const html = `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #0f172a; color: #e2e8f0; border-radius: 16px; padding: 32px; border: 1px solid #1e293b;">
                <div style="margin-bottom: 24px;">
                    <span style="display: inline-block; background: linear-gradient(135deg, #10b981, #14b8a6); color: #ffffff; font-weight: 700; padding: 8px 14px; border-radius: 10px; font-size: 14px;">Expense Flow</span>
                </div>
                <h2 style="color: #ffffff; margin: 0 0 12px; font-size: 22px;">Reset Your Password</h2>
                <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
                    Hi ${user.name || 'there'},<br/><br/>
                    We received a request to reset the password for your Expense Flow account. Click the button below to choose a new password. This link will expire in <strong>15 minutes</strong>.
                </p>
                <div style="text-align: center; margin: 28px 0;">
                    <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(90deg, #10b981, #06b6d4); color: #ffffff; text-decoration: none; font-weight: 600; padding: 14px 28px; border-radius: 12px; font-size: 15px;">
                        Reset Password
                    </a>
                </div>
                <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin: 20px 0 0;">
                    If you did not request a password reset, you can safely ignore this email.<br/>
                    Or copy and paste this link into your browser:<br/>
                    <a href="${resetUrl}" style="color: #10b981; word-break: break-all;">${resetUrl}</a>
                </p>
            </div>
        `;

        try {
            await sendEmail({
                to: user.email,
                subject: "Reset Your Expense Flow Password",
                text: `Reset your password using this link (expires in 15 minutes): ${resetUrl}`,
                html,
            });
        } catch (mailErr) {
            user.resetPasswordToken = undefined;
            user.resetPasswordExpires = undefined;
            await user.save();
            return res.status(500).json({
                success: false,
                message: "Failed to send reset email. Please try again later.",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Password reset link has been sent to your email",
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

const VerifyResetToken = async (req, res) => {
    try {
        const hashedToken = crypto
            .createHash('sha256')
            .update(String(req.params.token || ''))
            .digest('hex');

        const user = await UserModel.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: Date.now() },
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: "Password reset link is invalid or has expired",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Reset token is valid",
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

const ResetPassword = async (req, res) => {
    try {
        const { password } = req.body;
        const hashedToken = crypto
            .createHash('sha256')
            .update(String(req.params.token || ''))
            .digest('hex');

        const user = await UserModel.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: Date.now() },
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: "Password reset link is invalid or has expired",
            });
        }

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        user.password = hash;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        return res.status(200).json({
            success: true,
            message: "Password reset successfully! You can now sign in.",
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

module.exports = {
    RegisterUser,
    LoginUser,
    LogoutUser,
    ForgotPassword,
    VerifyResetToken,
    ResetPassword,
};