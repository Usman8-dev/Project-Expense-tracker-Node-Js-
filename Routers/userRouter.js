const express = require('express');
const router = express.Router();
const {
    RegisterUser,
    LoginUser,
    LogoutUser,
    ForgotPassword,
    VerifyResetToken,
    ResetPassword,
} = require('../Controller/AuthController');

const {
    loginValidator,
    RegisterValidator,
    forgotPasswordValidator,
    resetPasswordValidator,
} = require('../Validators/authValidator');
const { validate } = require('../Middlewares/validate');

router.get('/', function (req, res) {
    res.send('Hello, I am working');
});
router.post('/register', RegisterValidator, validate, RegisterUser);
router.post('/login', loginValidator, validate, LoginUser);
router.post('/logout', LogoutUser);
router.post('/forgot-password', forgotPasswordValidator, validate, ForgotPassword);
router.get('/reset-password/:token', VerifyResetToken);
router.post('/reset-password/:token', resetPasswordValidator, validate, ResetPassword);

module.exports = router;