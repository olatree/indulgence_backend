const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const roles = ["customer", "admin", "super_admin"];

const addressSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  address: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  zipCode: { type: String, required: true },
  country: { type: String, required: true, default: 'US' },
  type: { type: String, enum: ['home', 'work', 'other'], default: 'home' },
  isDefault: { type: Boolean, default: false },
}, { timestamps: true });

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: roles, default: "customer" },
    addresses: [addressSchema],
    
    // FIX: added missing defaultAddress field
    defaultAddress: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
  },
  { timestamps: true }
);

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = function (password) {
  return bcrypt.compare(password, this.password);
};

const User = mongoose.model("User", userSchema);

// Create super admin on first run
const createSuperAdmin = async () => {
  try {
    const superAdminExists = await User.findOne({ role: "super_admin" });
    
    if (!superAdminExists) {
      await User.create({
        name: "Super Admin",
        email: "indulgence@admin.com",
        password: "123456", // Will be hashed by pre-save hook
        role: "super_admin",
      });
      console.log("✅ Super admin created successfully");
    }
  } catch (error) {
    console.error("Error creating super admin:", error.message);
  }
};

// Call this function when your app connects to MongoDB
mongoose.connection.once("open", () => {
  createSuperAdmin();
});

module.exports = User;
