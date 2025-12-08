const express = require('express');
const app = express();
const dotenv = require('dotenv').config();
const cookieParser = require('cookie-parser');
// model 
const UserModel = require('./Models/UserModel');
const ExpenseModel = require('./Models/ExpenseModel');

// database 
const db = require('./Config/connection-mongoose');
// router 
const userRouter = require('./Routers/userRouter');
const ExpenseRouter = require('./Routers/ExpenseRouter');

app.use(express.json());                    
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/user', userRouter);
app.use('/expense', ExpenseRouter);


app.listen(3000, ()=>{
    console.log('server is running');  
});