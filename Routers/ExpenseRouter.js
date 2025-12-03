const express = require('express');
const router = express.Router();

const {CreateExpense, UpdateExpense}  = require('../Controller/ExpenseController');

router.get('/', function(req, res){
    res.send('Expense tracker is running')
})
router.post('/create', CreateExpense);
router.post('/update/:id', UpdateExpense);

module.exports = router;