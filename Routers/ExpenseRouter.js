const express = require('express');
const router = express.Router();
const { IsLoginUser } = require('../Middlewares/IsLoginUser');

const { CreateExpense, UpdateExpense, AllExpense, SearchExpense, DeleteExpense, exportExpensesToExcel } = require('../Controller/ExpenseController');

const { create_AND_upadte_Validation } = require('../Validators/authValidator');
const { validate } = require('../Middlewares/validate');

router.get('/', function (req, res) {
    res.send('Expense tracker is running')
})
router.post('/create', IsLoginUser, create_AND_upadte_Validation, validate, CreateExpense);
router.put('/update/:id', IsLoginUser, create_AND_upadte_Validation, validate, UpdateExpense);
router.get('/AllExpense', IsLoginUser, AllExpense);
router.get('/SearchExpense/:title', IsLoginUser, SearchExpense);
router.delete('/delete/:id', IsLoginUser, DeleteExpense);

router.post('/export',IsLoginUser ,exportExpensesToExcel);

module.exports = router;