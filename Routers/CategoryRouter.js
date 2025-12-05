const express = require('express');
const router = express.Router();
const {IsLoginUser} = require('../Middlewares/IsLoginUser')

const {CreateCategory, UpdateCategory} = require('../Controller/CategoryController');


router.post('/create',IsLoginUser , CreateCategory);
router.put('/update/:id',IsLoginUser , UpdateCategory);
// router.get('/AllCategory',IsLoginUser , AllCategory);
// router.delete('/delete/:id',IsLoginUser , DeleteCategory);
module.exports = router;