const express = require('express');
const router = express.Router();
const {IsLoginUser} = require('../Middlewares/IsLoginUser')

const {CreateCategory, UpdateCategory, AllCategory, DeleteCategory, GetCategoryById} = require('../Controller/CategoryController');


router.post('/create',IsLoginUser , CreateCategory);
router.put('/update/:id',IsLoginUser , UpdateCategory);
router.get('/AllCategory',IsLoginUser , AllCategory);
router.delete('/delete/:id',IsLoginUser , DeleteCategory);
router.get('/GetCategoryById/:id', IsLoginUser , GetCategoryById);
module.exports = router;