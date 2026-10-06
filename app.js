const express = require('express');
const cors = require("cors");
const app = express();
const dotenv = require('dotenv').config();
const cookieParser = require('cookie-parser');
// model 
const UserModel = require('./Models/UserModel');
const ExpenseModel = require('./Models/ExpenseModel');
const categoryModel = require('./Models/CategoryModel');

// database 
const db = require('./Config/connection-mongoose');
// router 
const userRouter = require('./Routers/userRouter');
const ExpenseRouter = require('./Routers/ExpenseRouter');
const CategoryRouter = require('./Routers/CategoryRouter');

// Render terminates TLS in front of us (needed for secure cookies / req.secure)
app.set('trust proxy', 1);

// The PWA runs on a different origin than this API, so every request is
// cross-origin. CLIENT_URL may hold several origins (comma separated); when
// it is unset we reflect the caller's origin instead of blocking it.
// `X-Client-Op-Id` must be in allowedHeaders - that is the idempotency key
// the offline outbox sends with every write.
const allowedOrigins = (process.env.CLIENT_URL || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

app.use(cors({
    origin: allowedOrigins.length ? allowedOrigins : true,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Client-Op-Id'],
    maxAge: 86400,
}));
app.use(express.json());                    
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Lightweight health-check endpoint for external keep-alive pings (Render free tier)
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

app.use('/user', userRouter);
app.use('/expense', ExpenseRouter);
app.use('/category', CategoryRouter);


// app.listen(3000, ()=>{
//     console.log('server is running');  
// });
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));