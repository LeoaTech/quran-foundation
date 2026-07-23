const service = require('../services/homework.service');

const ok  = (res, data, status = 200) => res.status(status).json({ success: true, data });
const err = (res, e)                  => res.status(e.status || 500).json({ success: false, message: e.message });

// GET /courses/:course_id/homework-schedule
async function getSchedule(req, res) {
  try {
    const data = await service.getScheduleWithAssignments(req.params.course_id);
    ok(res, data);
  } catch (e) { err(res, e); }
}

// PUT /courses/:course_id/homework-schedule
// Body: { frequency, total_assignments, first_due_date(CAN BE NULL), instructions }
async function saveSchedule(req, res) {
  try {
    const { frequency, total_assignments, first_due_date, instructions } = req.body;
    const data = await service.saveSchedule({
      courseId:         req.params.course_id,
      orgId:            req.user.org_id,
      frequency,
      totalAssignments: total_assignments,
      firstDueDate:     first_due_date,
      instructions,
      userId:           req.user.id,
    });
    ok(res, data);
  } catch (e) { err(res, e); }
}


module.exports = {
  getSchedule,
  saveSchedule
};
