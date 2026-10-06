const express = require('express');
const router = express.Router();
const {IsLoginUser} = require('../Middlewares/IsLoginUser')

const {CreateCategory, UpdateCategory, AllCategory, DeleteCategory, GetCategoryById} = require('../Controller/CategoryController');
const { idempotency } = require('../Middlewares/idempotency');


router.post('/create',IsLoginUser , idempotency, CreateCategory);
router.put('/update/:id',IsLoginUser , idempotency, UpdateCategory);
router.get('/AllCategory',IsLoginUser , AllCategory);
router.delete('/delete/:id',IsLoginUser , idempotency, DeleteCategory);
router.get('/GetCategoryById/:id', IsLoginUser , GetCategoryById);
module.exports = router;