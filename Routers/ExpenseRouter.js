const express = require('express');
const router = express.Router();

const {CreateExpense, UpdateExpense, AllExpense, SearchExpense}  = require('../Controller/ExpenseController');

router.get('/', function(req, res){
    res.send('Expense tracker is running')
})
router.post('/create', CreateExpense);
router.put('/update/:id', UpdateExpense);
router.get('/AllExpense', AllExpense);
router.get('/SearchExpense/:title', SearchExpense);

module.exports = router;