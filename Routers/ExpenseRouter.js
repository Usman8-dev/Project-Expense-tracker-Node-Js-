const express = require('express');
const router = express.Router();
const { IsLoginUser } = require('../Middlewares/IsLoginUser');

const {
  CreateExpense,
  UpdateExpense,
  AllExpense,
  SearchExpense,
  DeleteExpense,
  exportExpensesToExcel,
  GetExpenseById,
  GetMonthlyFolders,
  CreateFolder,
  AllFolders,
  EditFolder,
  DeleteFolder,
} = require('../Controller/ExpenseController');

const { create_AND_upadte_Validation } = require('../Validators/authValidator');
const { validate } = require('../Middlewares/validate');
const { idempotency } = require('../Middlewares/idempotency');

router.get('/', function (req, res) {
    res.send('Expense tracker is running')
})
router.post('/create', IsLoginUser, create_AND_upadte_Validation, validate, idempotency, CreateExpense);
router.put('/update/:id', IsLoginUser, create_AND_upadte_Validation, validate, idempotency, UpdateExpense);
router.get('/AllExpense', IsLoginUser, AllExpense);
router.get('/monthly-folders', IsLoginUser, GetMonthlyFolders);
router.get('/GetExpenseById/:id', IsLoginUser, GetExpenseById);
router.get('/SearchExpense/:title', IsLoginUser, SearchExpense);
router.delete('/delete/:id', IsLoginUser, idempotency, DeleteExpense);

// Monthly Folder routes
router.post('/folder/create', IsLoginUser, idempotency, CreateFolder);
router.get('/folder/all', IsLoginUser, AllFolders);
router.put('/folder/update/:id', IsLoginUser, idempotency, EditFolder);
router.delete('/folder/delete/:id', IsLoginUser, idempotency, DeleteFolder);

router.post('/export',IsLoginUser ,exportExpensesToExcel);

module.exports = router;