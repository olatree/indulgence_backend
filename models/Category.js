const mongoose = require("mongoose");

// const categorySchema = new mongoose.Schema(
//   {
//     name: { type: String, required: true, unique: true },
//     slug: { type: String, unique: true },
//   },
//   { timestamps: true }
// );

// module.exports = mongoose.model("Category", categorySchema);


const categorySchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: [true, "Category name is required"],
      trim: true,
      maxlength: [50, "Category name cannot exceed 50 characters"]
    },
    slug: { 
      type: String, 
      unique: true,
      lowercase: true 
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Category", categorySchema);