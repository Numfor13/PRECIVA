// routes/user.js
const express = require("express");
const User = require("../models/User");
const { verifyToken, isAdmin } = require("../middleware/auth");
const sendEmail = require("../utils/sendEmail");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

const router = express.Router();


// 👤 Get own profile
router.get("/me", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password"); // exclude password
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ✏️ Update own profile
router.put("/me", verifyToken, async (req, res) => {
  try {
    const { name, email } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { name, email },
      { new: true }
    ).select("-password");

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

  // PUT /api/users/change-password
router.put("/change-password", verifyToken, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) return res.status(400).json({ error: "Old password incorrect" });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// ✅ Request password reset
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });

    // generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = Date.now() + 3600000; // 1 hour

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetTokenExpiry;
    await user.save();

    // email link (frontend will handle reset form)
    const resetLink = `http://localhost:3000/reset-password/${resetToken}`;

    // send email
    const transporter = nodemailer.createTransport({ sendmail: true });
    await transporter.sendMail({
      from: "noreply@yourapp.com",
      to: user.email,
      subject: "Password Reset Request",
      text: `Click here to reset your password: ${resetLink}`,
    });

    res.json({ message: "Password reset email sent" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Verify reset token
router.get("/reset-password/:token", async (req, res) => {
  try {
    const user = await User.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() }, // not expired
    });

    if (!user) return res.status(400).json({ error: "Invalid or expired token" });

    res.json({ message: "Token is valid" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Reset password
router.post("/reset-password/:token", async (req, res) => {
  try {
    const { newPassword } = req.body;

    const user = await User.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) return res.status(400).json({ error: "Invalid or expired token" });

    // hash and save new password
    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    res.json({ message: "Password reset successful" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🗑️ Delete own account
router.delete("/me", verifyToken, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.user.id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ message: "Account deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// 🔑 Admin: Get all users (with filters & pagination)
router.get("/", verifyToken, isAdmin, async (req, res) => {
  try {
    const { role, email, from, to, page = 1, limit = 10 } = req.query;
    let filter = {};

    if (role) filter.role = role;
    if (email) filter.email = new RegExp(email, "i"); // case-insensitive search
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    const users = await User.find(filter)
      .select("-password")
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    const count = await User.countDocuments(filter);

    res.json({
      total: count,
      page: Number(page),
      pages: Math.ceil(count / limit),
      users,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// 🔎 Admin: Get single user
router.get("/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// 🛠 Admin: Update user role
router.put("/:id/role", verifyToken, isAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    if (!["user", "admin"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    ).select("-password");

    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({ message: "User role updated", user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/:id/block
router.put("/:id/block", verifyToken, isAdmin, async (req, res) => {
  try {
    const { blocked } = req.body;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { blocked: blocked ?? true },
      { new: true }
    ).select("-password");

    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({ message: `User ${blocked ? "blocked" : "unblocked"}`, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Inside role update
await sendEmail(
  user.email,
  "Your Account Role Changed",
  `Hello ${user.name}, your role has been updated to ${role}.`
);


// ❌ Admin: Delete user
router.delete("/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({ message: "User deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Inside delete
await sendEmail(
  user.email,
  "Account Deleted",
  `Hello ${user.name}, your account has been deleted by the admin.`
);



module.exports = router;
