const service = require('../services/studentImportExport.service');

async function exportStudents(req, res, next) {
  try {
    const { center_id, format } = req.query;
    const result = await service.exportStudentsData({
      user: req.user,
      centerId: center_id,
      format,
    });

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.buffer);
  } catch (err) {
    next(err);
  }
}


module.exports = {
  exportStudents
};
