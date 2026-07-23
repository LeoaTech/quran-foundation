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

module.exports = {
  getSchedule
};
