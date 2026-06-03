const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["Pending", "Successful", "Failed"],
      default: "Pending",
    },
    provider: {
      type: String,
      default: "MobileMoney",
    },
    transactionId: {
      type: String, // mock UUID, later real MoMo transaction ID
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", PaymentSchema);
