const Category = require("../models/Category");
const slugify = require("slugify");

// exports.createCategory = async (req, res) => {
//   const { name } = req.body;

//   const category = await Category.create({
//     name,
//     slug: slugify(name, { lower: true }),
//   });

//   res.status(201).json(category);
// };

exports.createCategory = async (req, res) => {
  try {
    const { name } = req.body;

    // Validation
    if (!name || name.trim() === "") {
      return res.status(400).json({ message: "Category name is required" });
    }

    // Check if category already exists (case-insensitive)
    const existingCategory = await Category.findOne({ 
      name: { $regex: new RegExp(`^${name}$`, "i") } 
    });

    if (existingCategory) {
      return res.status(409).json({ 
        message: "Category with this name already exists" 
      });
    }

    const slug = slugify(name, { lower: true, strict: true });

    // Check if slug already exists (edge case)
    const existingSlug = await Category.findOne({ slug });
    
    const finalSlug = existingSlug 
      ? `${slug}-${Date.now()}` // Add timestamp if slug exists
      : slug;

    const category = await Category.create({
      name: name.trim(),
      slug: finalSlug,
      createdBy: req.user._id, // Track who created it
    });

    res.status(201).json({
      success: true,
      data: category,
    });

  } catch (error) {
    // Handle mongoose validation errors
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        message: "Validation failed", 
        errors: messages 
      });
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(409).json({ 
        message: "Category already exists" 
      });
    }

    console.error("Create category error:", error);
    res.status(500).json({ 
      message: "Failed to create category",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
};

// exports.getCategories = async (req, res) => {
//   const categories = await Category.find();
//   res.json(categories);
// };

exports.getCategories = async (req, res) => {
  try {
    const { search, page = 1, limit = 10 } = req.query;

    const query = {};
    
    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    const categories = await Category.find(query)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 }); // Newest first

    const total = await Category.countDocuments(query);

    res.json({
      categories,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    // Validation
    if (!name || name.trim() === "") {
      return res.status(400).json({ message: "Category name is required" });
    }

    // Check if category exists
    const category = await Category.findById(id);
    
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    // Check if new name already exists (excluding current category)
    const existingCategory = await Category.findOne({
      _id: { $ne: id }, // Exclude current category
      name: { $regex: new RegExp(`^${name}$`, "i") }
    });

    if (existingCategory) {
      return res.status(409).json({
        message: "Another category with this name already exists"
      });
    }

    // Generate new slug
    const slug = slugify(name, { lower: true, strict: true });

    // Check if new slug already exists (excluding current category)
    const existingSlug = await Category.findOne({
      _id: { $ne: id },
      slug
    });

    const finalSlug = existingSlug
      ? `${slug}-${Date.now()}`
      : slug;

    // Update category
    category.name = name.trim();
    category.slug = finalSlug;
    category.updatedBy = req.user._id; // Track who updated it

    await category.save();

    res.json({
      success: true,
      data: category,
      message: "Category updated successfully"
    });

  } catch (error) {
    // Handle mongoose validation errors
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        message: "Validation failed",
        errors: messages
      });
    }

    // Handle invalid ObjectId
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid category ID" });
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(409).json({
        message: "Category already exists"
      });
    }

    console.error("Update category error:", error);
    res.status(500).json({
      message: "Failed to update category",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    // Optional: Check if category is being used by products
    const productsCount = await Product.countDocuments({ category: id });
    if (productsCount > 0) {
      return res.status(400).json({ 
        message: `Cannot delete category. ${productsCount} product(s) are using this category` 
      });
    }

    await category.deleteOne();

    res.json({
      success: true,
      message: "Category deleted successfully"
    });

  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid category ID" });
    }

    console.error("Delete category error:", error);
    res.status(500).json({
      message: "Failed to delete category",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
};