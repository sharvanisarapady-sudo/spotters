import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import DashboardLayout from '../layouts/DashboardLayout';
import { dashboardService } from '../services/dashboardService';
import { IconTimer, IconLayers, IconChart, IconTrophy, IconCheck, IconCrosshair } from '../components/icons';

const TASK_TYPE_BADGE = {
  lesson: 'bg-blue-50 text-blue-700 border-blue-200',
  practice: 'bg-purple-50 text-purple-700 border-purple-200',
  test: 'bg-amber-50 text-amber-800 border-amber-200',
  revision: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [plannerTasks, setPlannerTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Daily Planner state
  const [filter, setFilter] = useState('all'); // 'all' | 'pending' | 'completed'
  const [showAddTask, setShowAddTask] = useState(false);
  const [addingTask, setAddingTask] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    system_name: 'Neuroradiology',
    task_type: 'lesson',
    scheduled_time: '10:00 AM',
    duration_minutes: 30,
  });

  useEffect(() => {
    let cancelled = false;
    dashboardService
      .get()
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setPlannerTasks(res.plannerTasks || []);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load your dashboard right now. Please refresh.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTask.title.trim() || addingTask) return;
    setAddingTask(true);
    try {
      const res = await dashboardService.addPlannerTask(newTask);
      setPlannerTasks((prev) => [...prev, res.task]);
      setNewTask({
        title: '',
        system_name: 'Neuroradiology',
        task_type: 'lesson',
        scheduled_time: '10:00 AM',
        duration_minutes: 30,
      });
      setShowAddTask(false);
    } catch {
      setError('Could not add lesson to your schedule.');
    } finally {
      setAddingTask(false);
    }
  };

  const handleToggleTask = async (id) => {
    try {
      const res = await dashboardService.togglePlannerTask(id);
      setPlannerTasks((prev) => prev.map((t) => (t.id === id ? res.task : t)));
    } catch {
      setError('Could not update task status.');
    }
  };

  const handleDeleteTask = async (id) => {
    try {
      await dashboardService.deletePlannerTask(id);
      setPlannerTasks((prev) => prev.filter((t) => t.id !== id));
    } catch {
      setError('Could not remove task.');
    }
  };

  const stats = data?.stats || {};
  const activity = data?.activity || {};
  const today = activity.todaySummary || {};
  const systems = data?.systems || [];
  const dailyGoal = Number(user?.daily_goal) || 10;

  const completedTasksCount = plannerTasks.filter((t) => Number(t.is_completed) === 1).length;
  const totalTasksCount = plannerTasks.length;
  const plannerPercent = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

  const visibleTasks = plannerTasks.filter((t) => {
    if (filter === 'pending') return Number(t.is_completed) === 0;
    if (filter === 'completed') return Number(t.is_completed) === 1;
    return true;
  });

  const systemsStudiedCount = systems.filter((s) => s.attempted > 0).length;
  const dailyGoalPercent = Math.min(100, Math.round(((today.questionsToday || 0) / dailyGoal) * 100));

  return (
    <DashboardLayout>
      <main className="max-w-6xl mx-auto px-6 py-10">
        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-8 text-sm text-gray-400">Loading your personal command center…</div>
        ) : (
          <>
            {/* 1. WELCOME BACK & ACTIVE STREAK HERO */}
            <section className="rounded-3xl bg-navy-950 text-white p-7 sm:p-8 shadow-sm">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-mono text-spotter-blue-light">
                    <span>🔥 {activity.activeDays || 1} {activity.activeDays === 1 ? 'Day' : 'Days'} Active</span>
                    <span>•</span>
                    <span>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
                  </div>
                  <h1 className="mt-3 font-display font-semibold text-2xl sm:text-3xl">
                    Welcome back, {user?.full_name || user?.fullName || 'Doctor'}!
                  </h1>
                  <p className="mt-1.5 text-sm text-white/60 max-w-xl">
                    {user?.specialization
                      ? `${user.specialization}${user.institution ? ` · ${user.institution}` : ''}`
                      : 'Here is your daily study planner, today’s diagnostic activity, and live learning status.'}
                  </p>
                </div>

                {/* Quick Score & Completion Pills */}
                <div className="grid grid-cols-3 gap-3 sm:gap-4 shrink-0">
                  <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-center">
                    <p className="text-[11px] font-mono uppercase tracking-wider text-white/40">Active Days</p>
                    <p className="mt-1 font-display font-semibold text-2xl text-amber-400">
                      {activity.activeDays || 1}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-center">
                    <p className="text-[11px] font-mono uppercase tracking-wider text-white/40">Your Score</p>
                    <p className="mt-1 font-display font-semibold text-2xl text-white">
                      {stats.bestScore ? `${stats.bestScore.score}/${stats.bestScore.total}` : `${stats.correctAnswers || 0}/${stats.questionsAttempted || 0}`}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-center">
                    <p className="text-[11px] font-mono uppercase tracking-wider text-white/40">Accuracy</p>
                    <p className="mt-1 font-display font-semibold text-2xl text-emerald-400">
                      {stats.overallAccuracy !== null ? `${stats.overallAccuracy}%` : '—'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Daily Goal Bar */}
              <div className="mt-6 pt-5 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-white/70 font-medium">
                      Today&apos;s Case Goal ({today.questionsToday || 0} of {dailyGoal} questions completed today)
                    </span>
                    <span className="font-mono text-spotter-blue-light">{dailyGoalPercent}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-spotter-blue transition-all duration-500"
                      style={{ width: `${Math.max(dailyGoalPercent, 3)}%` }}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {user?.role === 'admin' && (
                    <Link
                      to="/admin/cases"
                      className="rounded-xl bg-amber-400/20 border border-amber-400/40 hover:bg-amber-400/30 px-4 py-2 text-xs font-semibold text-amber-300 transition"
                    >
                      + Content &amp; Blocks
                    </Link>
                  )}
                  <Link
                    to="/tests"
                    className="rounded-xl bg-spotter-blue hover:bg-spotter-blue-dark px-4 py-2 text-xs font-semibold text-white transition"
                  >
                    Take Block 1 Test
                  </Link>
                  <Link
                    to="/navigation-ai"
                    className="rounded-xl border border-white/15 hover:bg-white/10 px-4 py-2 text-xs font-medium text-white transition"
                  >
                    AI Case Mentor
                  </Link>
                </div>
              </div>
            </section>

            {/* 2. HOW IT'S GOING TODAY — LIVE STATS STRIP */}
            <section className="mt-8">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display font-semibold text-lg text-navy-950">How It&apos;s Going Today</h2>
                <Link to="/progress" className="text-xs font-semibold text-spotter-blue hover:underline">
                  Open Full Analytics &amp; Charts →
                </Link>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-2xl border border-gray-200 bg-white p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Questions Today</span>
                    <IconLayers className="w-4 h-4 text-spotter-blue" />
                  </div>
                  <p className="mt-3 font-display font-semibold text-2xl text-navy-950">{today.questionsToday || 0}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {today.correctToday || 0} answered properly today
                  </p>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Tests Completed</span>
                    <IconTimer className="w-4 h-4 text-spotter-blue" />
                  </div>
                  <p className="mt-3 font-display font-semibold text-2xl text-navy-950">{stats.testsCompleted || 0}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {today.testsCompletedToday || 0} completed today
                  </p>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Planner Schedule</span>
                    <IconCheck className="w-4 h-4 text-emerald-600" />
                  </div>
                  <p className="mt-3 font-display font-semibold text-2xl text-navy-950">
                    {completedTasksCount}/{totalTasksCount}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {plannerPercent}% of planned lessons done
                  </p>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Systems Covered</span>
                    <IconTrophy className="w-4 h-4 text-amber-500" />
                  </div>
                  <p className="mt-3 font-display font-semibold text-2xl text-navy-950">
                    {systemsStudiedCount}/{systems.length || 11}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Radiology systems practiced
                  </p>
                </div>
              </div>
            </section>

            {/* 3. DAILY PLANNER & LESSON SCHEDULE + TODAY'S ACTIVITIES */}
            <div className="mt-8 grid lg:grid-cols-5 gap-6">
              {/* Daily Planner & Lesson Schedule (3 cols) */}
              <section className="lg:col-span-3 rounded-2xl border border-gray-200 bg-white p-6 flex flex-col">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display font-semibold text-lg text-navy-950">
                      Daily Planner &amp; Lesson Schedule
                    </h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Organize your daily radiology study sessions, practice blocks, and case reviews.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddTask((v) => !v)}
                    className="rounded-lg bg-spotter-blue hover:bg-spotter-blue-dark text-white text-xs font-semibold px-3.5 py-2 transition"
                  >
                    {showAddTask ? 'Close' : '+ Schedule Lesson'}
                  </button>
                </div>

                {/* Planner progress bar */}
                <div className="mt-4 rounded-xl bg-gray-50 border border-gray-100 p-3.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-navy-950">
                      Schedule Completion: {completedTasksCount} of {totalTasksCount} tasks completed
                    </span>
                    <span className="font-mono font-semibold text-spotter-blue">{plannerPercent}%</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-gray-200 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${plannerPercent}%` }}
                    />
                  </div>
                </div>

                {/* Add New Lesson Form */}
                {showAddTask && (
                  <form onSubmit={handleAddTask} className="mt-4 rounded-xl border border-spotter-blue/30 bg-spotter-blue/5 p-4 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-navy-950">
                      Add New Lesson / Study Task
                    </p>
                    <input
                      type="text"
                      required
                      value={newTask.title}
                      onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                      placeholder="e.g. Review Brain MRI T2/FLAIR sequences"
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                    />
                    <div className="grid sm:grid-cols-3 gap-2.5">
                      <select
                        value={newTask.system_name}
                        onChange={(e) => setNewTask({ ...newTask, system_name: e.target.value })}
                        className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs"
                      >
                        <option value="Neuroradiology">Neuroradiology</option>
                        <option value="Cardiothoracic">Cardiothoracic</option>
                        <option value="Musculoskeletal">Musculoskeletal</option>
                        <option value="Gastrointestinal">Gastrointestinal</option>
                        <option value="Genitourinary">Genitourinary</option>
                        <option value="Head & Neck">Head &amp; Neck</option>
                        <option value="Paediatric">Paediatric</option>
                        <option value="All Systems">All Systems</option>
                      </select>

                      <select
                        value={newTask.task_type}
                        onChange={(e) => setNewTask({ ...newTask, task_type: e.target.value })}
                        className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs"
                      >
                        <option value="lesson">Lesson Study</option>
                        <option value="practice">Case Practice</option>
                        <option value="test">Timed Test Block</option>
                        <option value="revision">Missed Qs Revision</option>
                      </select>

                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={newTask.scheduled_time}
                          onChange={(e) => setNewTask({ ...newTask, scheduled_time: e.target.value })}
                          placeholder="10:00 AM"
                          className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs"
                        />
                        <input
                          type="number"
                          min={5}
                          max={240}
                          value={newTask.duration_minutes}
                          onChange={(e) => setNewTask({ ...newTask, duration_minutes: Number(e.target.value) || 30 })}
                          className="w-16 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs"
                          title="Duration in minutes"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAddTask(false)}
                        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-600"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={addingTask}
                        className="rounded-lg bg-spotter-blue hover:bg-spotter-blue-dark px-4 py-1.5 text-xs font-semibold text-white"
                      >
                        {addingTask ? 'Saving…' : 'Save to Planner'}
                      </button>
                    </div>
                  </form>
                )}

                {/* Filter tabs */}
                <div className="mt-4 flex items-center gap-2 border-b border-gray-100 pb-3">
                  {[
                    ['all', `All (${plannerTasks.length})`],
                    ['pending', `Pending (${totalTasksCount - completedTasksCount})`],
                    ['completed', `Completed (${completedTasksCount})`],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFilter(key)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                        filter === key
                          ? 'bg-navy-950 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Task list */}
                {visibleTasks.length === 0 ? (
                  <p className="mt-6 text-sm text-gray-400 text-center py-6">
                    No tasks in this view. Click &ldquo;+ Schedule Lesson&rdquo; to plan your study session.
                  </p>
                ) : (
                  <ul className="mt-3 divide-y divide-gray-100">
                    {visibleTasks.map((task) => {
                      const done = Number(task.is_completed) === 1;
                      return (
                        <li key={task.id} className="py-3 flex items-center justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <button
                              type="button"
                              onClick={() => handleToggleTask(task.id)}
                              aria-label={done ? 'Mark as pending' : 'Mark as completed'}
                              className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition ${
                                done
                                  ? 'bg-emerald-500 border-emerald-500 text-white'
                                  : 'border-gray-300 hover:border-spotter-blue bg-white'
                              }`}
                            >
                              {done && <IconCheck className="w-3.5 h-3.5" />}
                            </button>
                            <div className="min-w-0">
                              <p
                                className={`text-sm font-medium truncate ${
                                  done ? 'line-through text-gray-400' : 'text-navy-950'
                                }`}
                              >
                                {task.title}
                              </p>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                                <span
                                  className={`rounded border px-1.5 py-0.5 font-medium capitalize ${
                                    TASK_TYPE_BADGE[task.task_type] || TASK_TYPE_BADGE.lesson
                                  }`}
                                >
                                  {task.task_type}
                                </span>
                                {task.system_name && <span>{task.system_name}</span>}
                                {task.scheduled_time && (
                                  <span className="font-mono text-gray-400">
                                    · {task.scheduled_time} ({task.duration_minutes || 30}m)
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDeleteTask(task.id)}
                            className="text-xs text-gray-400 hover:text-red-600 px-2 py-1 shrink-0"
                            title="Delete task"
                          >
                            ✕
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              {/* Today's Activities & Learning Progress Snapshot (2 cols) */}
              <div className="lg:col-span-2 space-y-6">
                {/* Activities Today Feed */}
                <section className="rounded-2xl border border-gray-200 bg-white p-6">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display font-semibold text-lg text-navy-950">Your Recent Activities</h2>
                    <span className="text-xs font-mono text-gray-400">Live log</span>
                  </div>

                  {!activity.todayFeed || activity.todayFeed.length === 0 ? (
                    <div className="mt-5 rounded-xl border border-dashed border-gray-200 p-6 text-center">
                      <IconCrosshair className="w-6 h-6 mx-auto text-gray-300" />
                      <p className="mt-2 text-sm text-gray-500">No diagnostic activity logged yet today.</p>
                      <p className="mt-1 text-xs text-gray-400">
                        Start a test block or diagnose a case in Navigation AI to see your live activity stream.
                      </p>
                    </div>
                  ) : (
                    <ul className="mt-4 divide-y divide-gray-100">
                      {activity.todayFeed.map((item) => (
                        <li key={item.id} className="py-3 flex items-start justify-between gap-3 text-xs">
                          <div className="min-w-0">
                            <p className="font-medium text-navy-950 truncate">{item.label}</p>
                            <p className="text-gray-400 mt-0.5">
                              {new Date(item.ts).toLocaleString([], {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2.5 py-0.5 font-semibold ${
                              item.badgeTone === 'green'
                                ? 'bg-green-50 text-green-700'
                                : item.badgeTone === 'red'
                                ? 'bg-red-50 text-red-600'
                                : 'bg-blue-50 text-blue-700'
                            }`}
                          >
                            {item.badge}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {/* Learning Progress Snapshot */}
                <section className="rounded-2xl border border-gray-200 bg-white p-6">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display font-semibold text-lg text-navy-950">Systems Learning Status</h2>
                    <Link to="/progress" className="text-xs font-medium text-spotter-blue hover:underline">
                      All {systems.length} systems →
                    </Link>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    Your active radiology systems and current diagnostic accuracy.
                  </p>

                  <ul className="mt-4 space-y-3">
                    {systems.slice(0, 5).map((s) => (
                      <li key={s.id} className="text-xs">
                        <div className="flex items-center justify-between">
                          <Link
                            to={`/practice/${s.slug}`}
                            className="font-medium text-navy-950 hover:text-spotter-blue transition"
                          >
                            {s.name}
                          </Link>
                          <span className="font-mono text-gray-500">
                            {s.accuracy !== null ? `${s.accuracy}% (${s.correct}/${s.attempted})` : 'Not started'}
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-spotter-blue"
                            style={{ width: `${s.accuracy !== null ? Math.max(s.accuracy, 4) : 0}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            </div>
          </>
        )}
      </main>
    </DashboardLayout>
  );
}
