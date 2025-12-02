const express = require('express');
const router = express.Router();
const {RegisterUser, LoginUser} = require('../Controller/AuthController');

router.get('/', function(req, res){
    res.send('Hello, I am working');
});
router.post('/register', RegisterUser);
router.post('/login', LoginUser);



module.exports = router;