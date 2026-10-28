const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const dashboardController = require('../controllers/dashboardController');

const router = express.Router();

router.get('/', requireAuth, dashboardController.getDashboard);
router.post('/planner', requireAuth, dashboardController.addPlannerTask);
router.patch('/planner/:id/toggle', requireAuth, dashboardController.togglePlannerTask);
router.delete('/planner/:id', requireAuth, dashboardController.deletePlannerTask);

module.exports = router;
