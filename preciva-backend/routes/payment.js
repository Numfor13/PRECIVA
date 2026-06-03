const express = require("express");
const { v4: uuidv4 } = require("uuid"); // for mock transaction IDs
const Payment = require("../models/Payment");
const Order = require("../models/Order");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

// 💰 Initiate Payment (mock requestToPay)
router.post("/:orderId/pay", verifyToken, async (req, res) => {
  try {
    const { orderId } = req.params;

    // 1. Find order
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ error: "Order not found" });

    if (order.status !== "Pending") {
      return res.status(400).json({ error: "Order already processed" });
    }

    // 2. Create payment record (mock transaction)
    const payment = new Payment({
      order: order._id,
      user: req.user.id,
      amount: order.total,
      status: "Pending",
      transactionId: uuidv4(), // mock transaction
    });

    await payment.save();

    // 3. Simulate instant success (later will be async check with MTN API)
    payment.status = "Successful";
    await payment.save();

    // 4. Update order status
    order.status = "Paid";
    await order.save();

    
// after payment.status = "Successful"
await sendEmail(
  req.user.email,
  "Payment Successful 🎉",
  `Your payment of ${payment.amount} for order #${order._id} has been received successfully.`
);

    res.json({
      message: "Payment successful (mocked)",
      payment,
      order,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 📜 Get all payments for a user (with filters & pagination)
router.get("/my-payments", verifyToken, async (req, res) => {
  try {
    const { status, from, to, minAmount, maxAmount, sortBy = "createdAt", order = "desc", page = 1, limit = 10 } = req.query;

    const filter = { user: req.user.id };
    if (status) filter.status = status;

    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    if (minAmount || maxAmount) {
      filter.amount = {};
      if (minAmount) filter.amount.$gte = Number(minAmount);
      if (maxAmount) filter.amount.$lte = Number(maxAmount);
    }

    const sortOptions = { [sortBy]: order === "asc" ? 1 : -1 };

    const payments = await Payment.find(filter)
      .populate("order", "status total")
      .sort(sortOptions)
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const totalPayments = await Payment.countDocuments(filter);

    res.json({
      totalPayments,
      currentPage: Number(page),
      totalPages: Math.ceil(totalPayments / limit),
      payments,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 📊 Admin: Get all payments with advanced filters, sorting & pagination
router.get("/", verifyToken, async (req, res) => {
  try {
    // 🔒 Only admins allowed
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Access denied. Admins only." });
    }

    const { status, userId, orderId, from, to, minAmount, maxAmount, sortBy = "createdAt", order = "desc", page = 1, limit = 10 } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (userId) filter.user = userId;
    if (orderId) filter.order = orderId;

    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    if (minAmount || maxAmount) {
      filter.amount = {};
      if (minAmount) filter.amount.$gte = Number(minAmount);
      if (maxAmount) filter.amount.$lte = Number(maxAmount);
    }

    const sortOptions = { [sortBy]: order === "asc" ? 1 : -1 };

    const payments = await Payment.find(filter)
      .populate("user", "name email")
      .populate("order", "status total")
      .sort(sortOptions)
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const totalPayments = await Payment.countDocuments(filter);

    res.json({
      totalPayments,
      currentPage: Number(page),
      totalPages: Math.ceil(totalPayments / limit),
      payments,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;
