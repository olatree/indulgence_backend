// controllers/product.controller.js
const Product = require("../models/Product");
const Category = require("../models/Category");
const cloudinary = require("../config/cloudinary");
const slugify = require("slugify");
const { cleanupUploadedImages, deleteCloudinaryImages } = require('../utils/imageCleanup');


// Create Product (with image upload)
// exports.createProduct = async (req, res) => {
//   try {
//     const {
//       name,
//       description,
//       price,
//       comparePrice,
//       category,
//       stock,
//       sku,
//       status,
//       featured,
//       tags,
//     } = req.body;

//     // Validation
//     if (!name || !description || !price || !category) {
//       // Delete uploaded images if validation fails
//       if (req.files && req.files.length > 0) {
//         for (const file of req.files) {
//           await cloudinary.uploader.destroy(file.filename);
//         }
//       }
      
//       return res.status(400).json({
//         message: "Name, description, price, and category are required",
//       });
//     }

//     // Check if category exists
//     const categoryExists = await Category.findById(category);
//     if (!categoryExists) {
//       // Delete uploaded images if category doesn't exist
//       if (req.files && req.files.length > 0) {
//         for (const file of req.files) {
//           await cloudinary.uploader.destroy(file.filename);
//         }
//       }
      
//       return res.status(404).json({ message: "Category not found" });
//     }

//     // Check if product name already exists
//     const existingProduct = await Product.findOne({
//       name: { $regex: new RegExp(`^${name}`, "i") },
//     });

//     if (existingProduct) {
//       // Delete uploaded images if product exists
//       if (req.files && req.files.length > 0) {
//         for (const file of req.files) {
//           await cloudinary.uploader.destroy(file.filename);
//         }
//       }
      
//       return res.status(409).json({
//         message: "Product with this name already exists",
//       });
//     }

//     // Generate slug
//     const slug = slugify(name, { lower: true, strict: true });

//     // Check if slug exists
//     const existingSlug = await Product.findOne({ slug });
//     const finalSlug = existingSlug ? `${slug}-${Date.now()}` : slug;

//     // Check if SKU exists (if provided)
//     if (sku) {
//       const existingSku = await Product.findOne({ sku });
//       if (existingSku) {
//         // Delete uploaded images if SKU exists
//         if (req.files && req.files.length > 0) {
//           for (const file of req.files) {
//             await cloudinary.uploader.destroy(file.filename);
//           }
//         }
        
//         return res.status(409).json({
//           message: "Product with this SKU already exists",
//         });
//       }
//     }

//     // Get image URLs from uploaded files
//     const imageUrls = req.files ? req.files.map(file => file.path) : [];

//     // Parse tags if it's a string
//     const parsedTags = typeof tags === 'string' ? tags.split(',').map(tag => tag.trim()).filter(Boolean) : (tags || []);

//     const product = await Product.create({
//       name: name.trim(),
//       slug: finalSlug,
//       description: description.trim(),
//       price: Number(price),
//       comparePrice: comparePrice ? Number(comparePrice) : undefined,
//       category,
//       stock: stock ? Number(stock) : 0,
//       sku,
//       images: imageUrls,
//       status: status || "draft",
//       featured: featured === 'true' || featured === true,
//       tags: parsedTags,
//       createdBy: req.user._id,
//     });

//     // Populate category
//     await product.populate("category", "name slug");

//     res.status(201).json({
//       success: true,
//       data: product,
//       message: "Product created successfully",
//     });
//   } catch (error) {
//     // Delete uploaded images if there's an error
//     if (req.files && req.files.length > 0) {
//       for (const file of req.files) {
//         try {
//           await cloudinary.uploader.destroy(file.filename);
//         } catch (deleteError) {
//           console.error("Error deleting image:", deleteError);
//         }
//       }
//     }

//     if (error.name === "ValidationError") {
//       const messages = Object.values(error.errors).map((err) => err.message);
//       return res.status(400).json({
//         message: "Validation failed",
//         errors: messages,
//       });
//     }

//     if (error.code === 11000) {
//       const field = Object.keys(error.keyPattern)[0];
//       return res.status(409).json({
//         message: `Product with this ${field} already exists`,
//       });
//     }

//     console.error("Create product error:", error);
//     res.status(500).json({
//       message: "Failed to create product",
//       error: process.env.NODE_ENV === "development" ? error.message : undefined,
//     });
//   }
// };

exports.createProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      comparePrice,
      category,
      stock,
      sku,
      status,
      featured,
      tags,
    } = req.body;

    // Validation
    if (!name || !description || !price || !category) {
      await cleanupUploadedImages(req.files);
      return res.status(400).json({
        message: "Name, description, price, and category are required",
      });
    }

    // Check if category exists
    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      await cleanupUploadedImages(req.files);
      return res.status(404).json({ message: "Category not found" });
    }

    // Check if product name already exists
    const existingProduct = await Product.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") }, // 👈 Exact match
    });

    if (existingProduct) {
      await cleanupUploadedImages(req.files);
      return res.status(409).json({
        message: "Product with this name already exists",
      });
    }

    // Generate slug
    const slug = slugify(name, { lower: true, strict: true });
    const existingSlug = await Product.findOne({ slug });
    const finalSlug = existingSlug ? `${slug}-${Date.now()}` : slug;

    // Check if SKU exists (if provided)
    if (sku) {
      const existingSku = await Product.findOne({ sku });
      if (existingSku) {
        await cleanupUploadedImages(req.files);
        return res.status(409).json({
          message: "Product with this SKU already exists",
        });
      }
    }

    // Process images - store both URL and public_id for easier deletion later
    const images = req.files ? req.files.map(file => ({
      url: file.path,
      publicId: file.filename, // 👈 Store public_id for future deletions
    })) : [];

    // Parse tags
    const parsedTags = typeof tags === 'string' 
      ? tags.split(',').map(tag => tag.trim()).filter(Boolean) 
      : (Array.isArray(tags) ? tags : []);

    // Create product
    const product = await Product.create({
      name: name.trim(),
      slug: finalSlug,
      description: description.trim(),
      price: Number(price),
      comparePrice: comparePrice ? Number(comparePrice) : undefined,
      category,
      stock: stock ? Number(stock) : 0,
      sku: sku?.trim(),
      images,
      status: status || "draft",
      featured: featured === 'true' || featured === true,
      tags: parsedTags,
      createdBy: req.user._id,
    });

    // Populate category
    await product.populate("category", "name slug");

    res.status(201).json({
      success: true,
      data: product,
      message: "Product created successfully",
    });
  } catch (error) {
    // Cleanup uploaded images on any error
    await cleanupUploadedImages(req.files);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        message: "Validation failed",
        errors: messages,
      });
    }

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(409).json({
        message: `Product with this ${field} already exists`,
      });
    }

    console.error("Create product error:", error);
    res.status(500).json({
      message: "Failed to create product",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get All Products (with filters, search, pagination)
exports.getProducts = async (req, res) => {
  try {
    const {
      search,
      category,
      status,
      featured,
      minPrice,
      maxPrice,
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Build query
    const query = {};

    // Text search
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { tags: { $in: [new RegExp(search, "i")] } },
      ];
    }

    // Category filter
    if (category) {
      query.category = category;
    }

    // Status filter
    if (status) {
      query.status = status;
    }

    // Featured filter
    if (featured !== undefined) {
      query.featured = featured === "true";
    }

    // Price range filter
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "asc" ? 1 : -1;

    // Execute query with pagination
    const products = await Product.find(query)
      .populate("category", "name slug")
      .populate("createdBy", "name email")
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Product.countDocuments(query);

    res.json({
      success: true,
      data: products,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / limit),
        limit: Number(limit),
      },
    });
  } catch (error) {
    console.error("Get products error:", error);
    res.status(500).json({
      message: "Failed to fetch products",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get Single Product
exports.getProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id)
      .populate("category", "name slug")
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email");

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    console.error("Get product error:", error);
    res.status(500).json({
      message: "Failed to fetch product",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Update Product
// exports.updateProduct = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const {
//       name,
//       description,
//       price,
//       comparePrice,
//       category,
//       stock,
//       sku,
//       images,
//       status,
//       featured,
//       tags,
//     } = req.body;

//     // Check if product exists
//     const product = await Product.findById(id);

//     if (!product) {
//       return res.status(404).json({ message: "Product not found" });
//     }

//     // Check if category exists (if provided)
//     if (category) {
//       const categoryExists = await Category.findById(category);
//       if (!categoryExists) {
//         return res.status(404).json({ message: "Category not found" });
//       }
//     }

//     // Check if new name already exists (if name is being updated)
//     if (name && name !== product.name) {
//       const existingProduct = await Product.findOne({
//         _id: { $ne: id },
//         name: { $regex: new RegExp(`^${name}$`, "i") },
//       });

//       if (existingProduct) {
//         return res.status(409).json({
//           message: "Another product with this name already exists",
//         });
//       }

//       // Generate new slug
//       const slug = slugify(name, { lower: true, strict: true });
//       const existingSlug = await Product.findOne({
//         _id: { $ne: id },
//         slug,
//       });

//       product.slug = existingSlug ? `${slug}-${Date.now()}` : slug;
//     }

//     // Check if SKU exists (if provided and changed)
//     if (sku && sku !== product.sku) {
//       const existingSku = await Product.findOne({
//         _id: { $ne: id },
//         sku,
//       });

//       if (existingSku) {
//         return res.status(409).json({
//           message: "Another product with this SKU already exists",
//         });
//       }
//     }

//     // Update fields
//     if (name) product.name = name.trim();
//     if (description) product.description = description.trim();
//     if (price !== undefined) product.price = price;
//     if (comparePrice !== undefined) product.comparePrice = comparePrice;
//     if (category) product.category = category;
//     if (stock !== undefined) product.stock = stock;
//     if (sku !== undefined) product.sku = sku;
//     if (images) product.images = images;
//     if (status) product.status = status;
//     if (featured !== undefined) product.featured = featured;
//     if (tags) product.tags = tags;

//     product.updatedBy = req.user._id;

//     await product.save();

//     // Populate references
//     await product.populate("category", "name slug");
//     await product.populate("updatedBy", "name email");

//     res.json({
//       success: true,
//       data: product,
//       message: "Product updated successfully",
//     });
//   } catch (error) {
//     if (error.name === "ValidationError") {
//       const messages = Object.values(error.errors).map((err) => err.message);
//       return res.status(400).json({
//         message: "Validation failed",
//         errors: messages,
//       });
//     }

//     if (error.name === "CastError") {
//       return res.status(400).json({ message: "Invalid product ID" });
//     }

//     if (error.code === 11000) {
//       const field = Object.keys(error.keyPattern)[0];
//       return res.status(409).json({
//         message: `Product with this ${field} already exists`,
//       });
//     }

//     console.error("Update product error:", error);
//     res.status(500).json({
//       message: "Failed to update product",
//       error: process.env.NODE_ENV === "development" ? error.message : undefined,
//     });
//   }
// };


exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      price,
      comparePrice,
      category,
      stock,
      sku,
      status,
      featured,
      tags,
      removeImages, // Array of publicIds to remove
    } = req.body;

    // Check if product exists
    const product = await Product.findById(id);
    if (!product) {
      // Cleanup any uploaded files
      await cleanupUploadedImages(req.files);
      return res.status(404).json({ message: "Product not found" });
    }

    // Check if category exists (if provided)
    if (category) {
      const categoryExists = await Category.findById(category);
      if (!categoryExists) {
        await cleanupUploadedImages(req.files);
        return res.status(404).json({ message: "Category not found" });
      }
    }

    // Check if new name already exists (if name is being updated)
    if (name && name.trim() !== product.name) {
      const existingProduct = await Product.findOne({
        _id: { $ne: id },
        name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
      });

      if (existingProduct) {
        await cleanupUploadedImages(req.files);
        return res.status(409).json({
          message: "Another product with this name already exists",
        });
      }

      // Generate new slug
      const slug = slugify(name, { lower: true, strict: true });
      const existingSlug = await Product.findOne({
        _id: { $ne: id },
        slug,
      });

      product.slug = existingSlug ? `${slug}-${Date.now()}` : slug;
      product.name = name.trim();
    }

    // Check if SKU exists (if provided and changed)
    if (sku && sku !== product.sku) {
      const existingSku = await Product.findOne({
        _id: { $ne: id },
        sku,
      });

      if (existingSku) {
        await cleanupUploadedImages(req.files);
        return res.status(409).json({
          message: "Another product with this SKU already exists",
        });
      }
      product.sku = sku;
    }

    // Handle image removal
    if (removeImages && Array.isArray(removeImages) && removeImages.length > 0) {
      // Validate that images to remove belong to this product
      const validImagesToRemove = product.images.filter(img => 
        removeImages.includes(img.publicId)
      );

      // Delete from Cloudinary
      await deleteCloudinaryImages(validImagesToRemove.map(img => img.publicId));

      // Remove from product
      product.images = product.images.filter(img => 
        !removeImages.includes(img.publicId)
      );
    }

    // Handle new image uploads
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map(file => ({
        url: file.path,
        publicId: file.filename,
      }));

      // Check total image count (existing + new)
      const totalImages = product.images.length + newImages.length;
      if (totalImages > 5) {
        await cleanupUploadedImages(req.files);
        return res.status(400).json({
          message: `Maximum 5 images allowed. You have ${product.images.length} existing images and tried to add ${newImages.length} more.`,
        });
      }

      // Add new images
      product.images.push(...newImages);
    }

    // Update other fields (use hasOwnProperty to allow falsy values)
    if (description !== undefined) product.description = description.trim();
    if (price !== undefined) product.price = Number(price);
    if (comparePrice !== undefined) product.comparePrice = comparePrice ? Number(comparePrice) : null;
    if (category !== undefined) product.category = category;
    if (stock !== undefined) product.stock = Number(stock);
    if (status !== undefined) product.status = status;
    if (featured !== undefined) product.featured = featured === 'true' || featured === true;
    
    // Handle tags
    if (tags !== undefined) {
      product.tags = typeof tags === 'string' 
        ? tags.split(',').map(tag => tag.trim()).filter(Boolean)
        : (Array.isArray(tags) ? tags : []);
    }

    product.updatedBy = req.user._id;

    await product.save();

    // Populate references
    await product.populate("category", "name slug");
    await product.populate("updatedBy", "name email");

    res.json({
      success: true,
      data: product,
      message: "Product updated successfully",
    });
  } catch (error) {
    // Cleanup newly uploaded images on error
    await cleanupUploadedImages(req.files);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        message: "Validation failed",
        errors: messages,
      });
    }

    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(409).json({
        message: `Product with this ${field} already exists`,
      });
    }

    console.error("Update product error:", error);
    res.status(500).json({
      message: "Failed to update product",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Delete Product
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    await product.deleteOne();

    res.json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    console.error("Delete product error:", error);
    res.status(500).json({
      message: "Failed to delete product",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Bulk Delete Products
exports.bulkDeleteProducts = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        message: "Please provide an array of product IDs",
      });
    }

    const result = await Product.deleteMany({ _id: { $in: ids } });

    res.json({
      success: true,
      message: `${result.deletedCount} product(s) deleted successfully`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Bulk delete products error:", error);
    res.status(500).json({
      message: "Failed to delete products",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

