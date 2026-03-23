// routes/product.route.js
const router = require("express").Router();
const {protect} = require("../middlewares/auth.middleware");
const {authorize} = require("../middlewares/role.middleware");
const controller = require("../controllers/product.controller");
const upload = require("../middlewares/upload.middleware");
const multer = require("multer");

const multerErrorHandler = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        message: 'File size too large. Maximum 5MB per image.' 
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ 
        message: 'Too many files. Maximum 5 images allowed.' 
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ 
        message: 'Unexpected field name.' 
      });
    }
  }
  
  if (err.message === 'Only image files are allowed!') {
    return res.status(400).json({ message: err.message });
  }
  
  next(err);
};

// Public routes
router.get("/", controller.getProducts);
router.get("/:id", controller.getProduct);

// Protected routes (admin and super_admin only)
router.post(
  "/",
  protect,
  authorize("admin", "super_admin"),
  upload.array('images', 5), 
  multerErrorHandler, // 👈 ADD THIS
  controller.createProduct
);

router.put(
  "/:id",
  protect,
  authorize("admin", "super_admin"),
  upload.array('images', 5), 
  multerErrorHandler, // 👈 ADD THIS
  controller.updateProduct
);

router.delete(
  "/:id",
  protect,
  authorize("admin", "super_admin"),
  controller.deleteProduct
);

router.delete(
  "/bulk-delete",
  protect,
  authorize("admin", "super_admin"),
  controller.bulkDeleteProducts
);

module.exports = router;