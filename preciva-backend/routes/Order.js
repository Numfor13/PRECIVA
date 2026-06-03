// routes/order.js
const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const Cart = require("../models/Cart");
const sendEmail = require("../utils/sendEmail");
const { verifyToken, isAdmin } = require("../middleware/auth");

// ✅ Place Order (from cart) → Status: Pending
router.post("/place", verifyToken, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id }).populate("products.product");

    if (!cart || cart.products.length === 0) {
      return res.status(400).json({ error: "Cart is empty" });
    }

    const order = new Order({
      user: req.user.id,
      products: cart.products,
      total: cart.products.reduce(
        (sum, item) => sum + item.product.price * item.quantity,
        0
      ),
      status: "Pending", // 👈 Default
    });

    await order.save();

    // ✅ Place Order

  await sendEmail(
    req.user.email,
    "Order Placed ✅",
    `Hello, your order #${order._id} has been placed successfully and is now Pending.`
  );

    // Clear cart after placing order
    cart.products = [];
    await cart.save();

    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Mark Order as Paid (User)
router.put("/:id/pay", verifyToken, async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.user.id });
    if (!order) return res.status(404).json({ error: "Order not found" });

    if (order.status !== "Pending") {
      return res.status(400).json({ error: "Order already processed" });
    }

    order.status = "Paid";

    // ✅ Pay for Order

await sendEmail(
  req.user.email,
  "Payment Confirmed 💰",
  `We have received payment for your order #${order._id}. It will be processed soon.`
);
    await order.save();

    res.json({ message: "Order marked as Paid", order });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ✅ Update Order Status (Admin only)
router.put("/:id/status", verifyToken, isAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const allowedStatus = ["Pending", "Paid", "Shipped", "Delivered", "Cancelled"];

    if (!allowedStatus.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    order.status = status;
    await order.save();

    // ✅ Admin updates order status
await sendEmail(
  user.email, // you may need to fetch user via order.user
  `Order Update: ${status}`,
  `Your order #${order._id} has been updated to: ${status}.`
);

    res.json({ message: `Order updated to ${status}`, order });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// ✅ Get User Orders (with filters & pagination)
router.get("/my-orders", verifyToken, async (req, res) => {
  try {
    const { status, minTotal, maxTotal, startDate, endDate, sortBy = "createdAt", order = "desc", page = 1, limit = 10 } = req.query;

    const filter = { user: req.user.id };

    if (status) filter.status = status;
    if (minTotal || maxTotal) filter.total = {};
    if (minTotal) filter.total.$gte = Number(minTotal);
    if (maxTotal) filter.total.$lte = Number(maxTotal);
    if (startDate || endDate) filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);

    const sortOptions = { [sortBy]: order === "asc" ? 1 : -1 };

    const orders = await Order.find(filter)
      .populate("products.product")
      .sort(sortOptions)
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const totalOrders = await Order.countDocuments(filter);

    res.json({
      totalOrders,
      currentPage: Number(page),
      totalPages: Math.ceil(totalOrders / limit),
      orders,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Get All Orders (Admin, with filters & pagination)
router.get("/", verifyToken, isAdmin, async (req, res) => {
  try {
    const { userId, status, minTotal, maxTotal, startDate, endDate, sortBy = "createdAt", order = "desc", page = 1, limit = 10 } = req.query;

    const filter = {};
    if (userId) filter.user = userId;
    if (status) filter.status = status;
    if (minTotal || maxTotal) filter.total = {};
    if (minTotal) filter.total.$gte = Number(minTotal);
    if (maxTotal) filter.total.$lte = Number(maxTotal);
    if (startDate || endDate) filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);

    const sortOptions = { [sortBy]: order === "asc" ? 1 : -1 };

    const orders = await Order.find(filter)
      .populate("user", "name email")
      .populate("products.product")
      .sort(sortOptions)
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const totalOrders = await Order.countDocuments(filter);

    res.json({
      totalOrders,
      currentPage: Number(page),
      totalPages: Math.ceil(totalOrders / limit),
      orders,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Get Single Order by ID
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate("products.product");

    if (!order) return res.status(404).json({ error: "Order not found" });

    // User can only see their order unless admin
    if (order.user.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
