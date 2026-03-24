const express = require("express");
require("dotenv").config();
const cors = require("cors");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const helmet = require("helmet");

const authRoutes = require("./routes/auth.route");
const categoryRoutes = require("./routes/category.route");
const productRoutes = require("./routes/product.route");
const cartRoutes = require("./routes/cart.route");
const addressRoutes = require('./routes/address.routes'); // Import address routes
const orderRoutes = require('./routes/order.routes'); // Import order routes
const adminOrderRoutes = require('./routes/admin/orders.routes');
const contactRoutes = require('./routes/admin/contact.routes'); // Import contact routes

const app = express();

app.use(helmet());
app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));

const allowedOrigins = [
  'http://localhost:5173', // For your local development
  'https://indulgence-frontend.vercel.app/' // Your live Vercel URL
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('CORS policy: This origin is not allowed'));
    }
  },
  credentials: true // Crucial if you use cookies or login sessions
}));

// app.use(
//   cors({
//     origin: process.env.CLIENT_URL,
//     credentials: true,
//   })
// );

app.use("/api/auth", authRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
// Use address routes
app.use('/api/addresses', addressRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin/orders', adminOrderRoutes);
app.use('/api/contact', contactRoutes);

module.exports = app;
