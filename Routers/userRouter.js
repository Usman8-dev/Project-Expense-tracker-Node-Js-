const express = require('express');

const router = express.Router();

router.get('/', function(req, res){
    res.send('Hello, I am working');
});
router.post('/register', RegisterUser);


module.exports = router;