// const { createCategory, getCategories } = require("../controllers/category.controller");

// // const router = require("express").Router();
// const router = require("express").Router();

const {protect} = require("../middlewares/auth.middleware");
const {authorize} = require("../middlewares/role.middleware");
// // const controller = require("../controllers/category.controller");

// router.post(
//   "/",
//   protect,
//   authorize("admin", "super_admin"),
//   createCategory
// );

// router.get("/", getCategories);

// module.exports = router;


// routes/category.route.js
const router = require("express").Router();
// const protect = require("../middlewares/auth.middleware");
// const authorize = require("../middlewares/role.middleware");
const controller = require("../controllers/category.controller");

router.post(
  "/",
  protect,
  authorize("admin", "super_admin"),
  controller.createCategory
);

router.get("/", controller.getCategories);

router.put(
  "/:id",
  protect,
  authorize("admin", "super_admin"),
  controller.updateCategory
);

router.delete(
  "/:id",
  protect,
  authorize("super_admin", "admin"),
  controller.deleteCategory
)

module.exports = router;