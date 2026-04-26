# 🚀 NextGen Finance Backend

A scalable **Node.js (Express) backend** for financial management, featuring **MongoDB-based APIs** and a **CSV-powered analytics engine** for generating financial insights.

---

## ✨ Features

### 🔹 Core Backend (MongoDB)

* 🔐 JWT Authentication (login/register)
* 💰 Transaction & Budget Management
* 🔄 Transfer Simulation
* 🛡️ Security Middleware (Helmet, Rate Limiting, CORS)

---

### 🔹 CSV Analytics Engine (New)

* 📤 **Upload CSV Data**
  `POST /api/upload`
  Upload financial transactions and store per user (JSON-based)

* 🧠 **Financial Analysis**
  `GET /api/analysis/:userId`
  Generates:

  * Total income & expenses
  * Category-wise breakdown
  * Overspending detection
  * Smart insights

* 🔮 **Prediction Engine**

  * Simple next-month expense estimation based on past data

---

## 🧱 Project Structure

```
/data/users        # Stored user transaction JSON files
/uploads           # Temporary CSV uploads

/src
  /routes          # API routes
  /services        # Parser, analyzer, predictor logic
  /utils           # File helpers
  /config          # DB & logger

server.js
---

## ⚙️ Setup

```bash
npm install
```

Create a `.env` file:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key
FRONTEND_URL=http://localhost:8080
```

Run the server:

```bash
npm run dev
```

---

## 📊 CSV Format

Your CSV must follow:

```
amount,type,category
5000,income,salary
200,expense,food
1000,expense,rent
```

---

## 🧪 API Testing

### 1️⃣ Upload CSV

```bash
curl -F "userId=test123" -F "file=@transactions.csv" http://localhost:5000/api/upload
```

✅ Stores data in:

```
/data/users/test123.json
```

---

### 2️⃣ Get Analysis

```bash
curl http://localhost:5000/api/analysis/test123
```

---

### ✅ Sample Response

```json
{
  "success": true,
  "userId": "test123",
  "totalTransactions": 3,
  "analysis": {
    "income": 5000,
    "expense": 1200,
    "balance": 3800,
    "categoryBreakdown": {
      "salary": 5000,
      "food": 200,
      "rent": 1000
    },
    "insights": [
      "✅ You are saving money",
      "💸 High spending on rent"
    ]
  },
  "prediction": {
    "nextMonthEstimate": 36000
  }
}
```

---

## 🛠 Tech Stack

* **Backend:** Node.js, Express
* **Database:** MongoDB
* **File Upload:** Multer
* **CSV Parsing:** csv-parser
* **Auth:** JWT, bcrypt

---

## ⚠️ Notes

* CSV analysis is **file-based (JSON storage)** and runs alongside MongoDB features
* Designed for **prototype/demo scale**, not large-scale production yet
* For large datasets, consider streaming or database-based storage

---

## 🚀 Future Improvements

* 🔐 Full frontend authentication integration
* 📊 Dashboard (charts & analytics UI)
* 🤖 AI Chatbot financial assistant
* ⚡ Scalable data processing

---

## ⭐ Status

✔ Backend fully functional
✔ CSV analytics working
✔ Frontend & auth integration in completed.