const express = require('express');
const app = express();
const dotenv = require('dotenv').config();

// model 
const UserModel = require('./Models/UserModel');

// database 
const db = require('./Config/connection-mongoose');

// router 
const userRouter = require('./Routers/userRouter');

app.use(express.json());                    
app.use(express.urlencoded({ extended: true }));
// app.use(cookieParser());

app.use('/user', userRouter);


app.listen(3000, ()=>{
    console.log('server is running');
    
});