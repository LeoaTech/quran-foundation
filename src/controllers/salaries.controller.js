const service = require('../services/salaries.service');

async function listStaffDetails(req, res, next) {
  try {
    const data = await service.listStaffDetails({
      user: req.user,
      centerId: req.params.center_id,
    });
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function updateBaseSalary(req, res, next) {
  try {
    const data = await service.updateBaseSalary({
      user: req.user,
      centerId: req.params.center_id,
      staffUserId: req.params.staff_user_id,
      baseSalary: req.body.base_salary,
    });
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function recordPayment(req, res, next) {
  try {
    const data = await service.recordPayment({
      user: req.user,
      centerId: req.params.center_id,
      body: req.body,
    });
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

async function listPayments(req, res, next) {
  try {
    const result = await service.listPayments({
      user: req.user,
      centerId: req.params.center_id,
      query: req.query,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listStaffDetails,
  updateBaseSalary,
  recordPayment,
  listPayments,
};
