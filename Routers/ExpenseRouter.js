const express = require('express');
const router = express.Router();

const {CreateExpense, UpdateExpense, AllExpense, SearchExpense, DeleteExpense}  = require('../Controller/ExpenseController');

router.get('/', function(req, res){
    res.send('Expense tracker is running')
})
router.post('/create', CreateExpense);
router.put('/update/:id', UpdateExpense);
router.get('/AllExpense', AllExpense);
router.get('/SearchExpense/:title', SearchExpense);
router.delete('/delete/:id', DeleteExpense);

module.exports = router;