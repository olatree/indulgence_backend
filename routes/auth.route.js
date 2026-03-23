const router = require("express").Router();
const auth = require("../controllers/auth.controller");
const { protect } = require("../middlewares/auth.middleware");
const {authorize} = require("../middlewares/role.middleware");

router.post("/register", auth.register);
router.post("/login", auth.login);
router.get("/me", protect, auth.me);
router.post("/logout", protect, auth.logout);

// ============= NEW ADMIN ROUTES =============
// All admin routes require both authentication AND admin authorization

// User management routes
router.get('/admin/users', protect, authorize("admin", "super_admin"), auth.getAllUsers);
router.get('/admin/users/:id', protect, authorize("admin", "super_admin"), auth.getUserById);
router.post('/admin/users', protect, authorize("admin", "super_admin"), auth.createUser);
router.put('/admin/users/:id', protect, authorize("admin", "super_admin"), auth.updateUser);
router.delete('/admin/users/:id', protect, authorize("admin", "super_admin"), auth.deleteUser);
router.patch('/admin/users/:id/role', protect, authorize("admin", "super_admin"), auth.updateUserRole);

// Statistics
router.get('/admin/users/stats/summary', protect, authorize("admin", "super_admin"), auth.getUserStats);

module.exports = router;
