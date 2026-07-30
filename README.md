# 💰 ExpenseFlow — Backend API

ExpenseFlow's backend is a RESTful API built with Node.js and Express, powering user authentication, expense/income transaction management, category management, and Excel report generation for the ExpenseFlow personal finance tracker.

![Node.js](https://img.shields.io/badge/Node.js-Runtime-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express.js-API-000000?logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Database-47A248?logo=mongodb&logoColor=white)
![JWT](https://img.shields.io/badge/JWT-Auth-000000?logo=jsonwebtokens&logoColor=white)

---

## ✨ Features

### Authentication & Security
- User registration with name, age, email, and password
- Passwords hashed using `bcrypt`
- JWT-based login (token returned in response + optional httpOnly cookie)
- Route protection via custom `IsLoginUser` middleware
- Request body validation via dedicated validator middleware

### Transactions (Expenses/Income)
- Create, read, update, and delete transactions
- Each transaction is linked to the authenticated user (`createdBy`) and a category (`category_id`)
- Automatically calculates and stores running `total_income`, `total_expense`, and `total_balance` per transaction
- Custom transaction date supported (defaults to current date if not provided)

### Categories
- Create, read, update, and delete custom categories
- Categories are scoped per user
- Populated into transaction responses (`category_id.name`) for easy frontend display

### Excel Report Generation
- Generates a styled `.xlsx` report for a given date range using `ExcelJS`
- Includes summary cards (Total Income, Total Expense, Net Balance), a category breakdown table, and a full transaction table — all on a single sheet
- Streams the file directly as a downloadable attachment

### Database
- MongoDB with Mongoose ODM
- Connection handled via a dedicated config module

---

## 🛠 Tech Stack

| Technology | Purpose |
|---|---|
| Node.js | Runtime environment |
| Express.js | Web framework / REST API routing |
| MongoDB + Mongoose | Database and ODM |
| jsonwebtoken (JWT) | Authentication tokens |
| bcrypt | Password hashing |
| ExcelJS | Excel (.xlsx) report generation |
| cors | Cross-origin request handling |
| cookie-parser | Cookie parsing |
| dotenv | Environment variable management |
| nodemon | Development auto-reload (dev dependency) |

---

## 📁 Project Structure

```
backend/
├── Config/
│   └── connection-mongoose.js     # MongoDB connection setup
├── Controller/
│   ├── AuthController.js          # Register, login, user logic
│   ├── CategoryController.js      # Category CRUD logic
│   └── ExpenseController.js       # Transaction CRUD + Excel export logic
├── Middlewares/
│   ├── IsLoginUser.js             # JWT verification / auth guard
│   └── validate.js                # Request body validation middleware
├── Models/
│   ├── CategoryModel.js           # Category schema
│   ├── ExpenseModel.js            # Transaction schema
│   └── UserModel.js               # User schema
├── node_modules/
├── Routers/
│   ├── CategoryRouter.js          # /category routes
│   ├── ExpenseRouter.js           # /expense routes
│   └── userRouter.js              # /user routes
├── utils/
│   └── generateToken.js           # JWT token generation helper
├── Validators/
│   └── authValidator.js           # Yup/Joi validation schemas for auth routes
├── .env                           # Environment variables (not committed)
├── .gitignore
├── app.js                         # App entry point
├── package-lock.json
└── package.json
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- MongoDB (local instance or MongoDB Atlas cloud cluster)
- npm or yarn

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/expense-tracker.git
cd expense-tracker/backend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the root of the `backend/` folder (see [Environment Variables](#-environment-variables) below).

### 4. Start the Server

```bash
# Production
npm start

# Development (auto-reload with nodemon)
nodemon app.js
```

The API will run on `http://localhost:3000` by default.

### 5. Connect the Frontend

Make sure your frontend's Axios base URL points to `http://localhost:3000`, and that CORS is configured to allow your frontend's origin (e.g., `http://localhost:5173`).

---


## 🔌 API Endpoints

### Auth Routes (`/user`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| POST | `/user/register` | Register a new user | ❌ |
| POST | `/user/login` | Login and receive JWT token | ❌ |

### Expense Routes (`/expense`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| GET | `/expense/AllExpense` | Get all expenses for logged-in user | ✅ |
| GET | `/expense/GetExpenseById/:id` | Get a single expense by ID | ✅ |
| POST | `/expense/create` | Create a new transaction | ✅ |
| PUT | `/expense/update/:id` | Update an existing transaction | ✅ |
| DELETE | `/expense/delete/:id` | Delete a transaction | ✅ |
| POST | `/expense/export` | Generate and download Excel report for a date range | ✅ |

**Request body for `/expense/export`:**
```json
{
  "startDate": "2025-12-01",
  "endDate": "2025-12-30"
}
```

### Category Routes (`/category`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| GET | `/category/AllCategory` | Get all categories for logged-in user | ✅ |
| GET | `/category/GetCategoryById/:id` | Get a single category by ID | ✅ |
| POST | `/category/create` | Create a new category | ✅ |
| PUT | `/category/update/:id` | Update an existing category | ✅ |
| DELETE | `/category/delete/:id` | Delete a category | ✅ |

> All protected routes require a valid JWT sent via the `Authorization: Bearer <token>` header. The `IsLoginUser` middleware also accepts the token from an httpOnly cookie as a fallback.

---

## 🗂 Data Models (Simplified)

### UserModel
| Field | Type | Notes |
|---|---|---|
| name | String | Required |
| age | Number | Required |
| email | String | Required, unique |
| password | String | Required, hashed with bcrypt |

### CategoryModel
| Field | Type | Notes |
|---|---|---|
| name | String | Required |
| createdBy | ObjectId (ref: User) | Owner of the category |
| date | Date | Auto-generated |

### ExpenseModel
| Field | Type | Notes |
|---|---|---|
| title | String | Required |
| description | String | Optional |
| amount | Number | Required |
| type | String | `"Income"` or `"Expense"` |
| category_id | ObjectId (ref: Category) | Populated with `name` on fetch |
| createdBy | ObjectId (ref: User) | Owner of the transaction |
| income / expense | Number | Auto-calculated based on `type` |
| total_income / total_expense / total_balance | Number | Running totals recalculated on each create/update |
| date | Date | User-selectable, defaults to current date |

---

## 🙌 Acknowledgements

Built with ❤️ using Node.js, Express, and MongoDB.