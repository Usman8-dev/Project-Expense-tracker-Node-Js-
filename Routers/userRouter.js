const express = require('express');
const router = express.Router();
const { RegisterUser, LoginUser, LogoutUser } = require('../Controller/AuthController');

const { loginValidator , RegisterValidator} = require('../Validators/authValidator');
const { validate } = require('../Middlewares/validate');

router.get('/', function (req, res) {
    res.send('Hello, I am working');
});
router.post('/register', RegisterValidator, validate, RegisterUser);
router.post('/login', loginValidator, validate, LoginUser);
router.post('/logout', LogoutUser);



module.exports = router;