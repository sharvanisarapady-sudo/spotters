const progressModel = require('../models/progressModel');

async function getDashboard(req, res) {
  try {
    const [stats, recentTests, activity, systems, plannerTasks] = await Promise.all([
      progressModel.getOverview(req.user.id),
      progressModel.getTestHistory(req.user.id, 5),
      progressModel.getActivityStats(req.user.id),
      progressModel.getSystemPerformance(req.user.id),
      progressModel.getPlannerTasks(req.user.id),
    ]);

    return res.json({
      success: true,
      stats,
      recentTests,
      activity,
      systems,
      plannerTasks,
    });
  } catch (err) {
    console.error('[dashboard] error:', err.message);
    return res.status(500).json({ success: false, message: 'Could not load your dashboard.' });
  }
}

async function addPlannerTask(req, res) {
  try {
    const { title } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Please enter a lesson or task title.' });
    }
    const task = await progressModel.addPlannerTask(req.user.id, req.body);
    return res.status(201).json({ success: true, task });
  } catch (err) {
    console.error('[dashboard] addPlannerTask error:', err.message);
    return res.status(500).json({ success: false, message: 'Could not add planner task.' });
  }
}

async function togglePlannerTask(req, res) {
  try {
    const task = await progressModel.togglePlannerTask(req.user.id, req.params.id);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });
    return res.json({ success: true, task });
  } catch (err) {
    console.error('[dashboard] togglePlannerTask error:', err.message);
    return res.status(500).json({ success: false, message: 'Could not update planner task.' });
  }
}

async function deletePlannerTask(req, res) {
  try {
    await progressModel.deletePlannerTask(req.user.id, req.params.id);
    return res.json({ success: true });
  } catch (err) {
    console.error('[dashboard] deletePlannerTask error:', err.message);
    return res.status(500).json({ success: false, message: 'Could not delete planner task.' });
  }
}

module.exports = { getDashboard, addPlannerTask, togglePlannerTask, deletePlannerTask };
