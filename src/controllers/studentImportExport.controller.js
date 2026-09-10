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

async function importStudents(req, res, next) {
  try {
    const { center_id } = req.body || {};
    const fileBuffer = req.file?.buffer;
    const fileName = req.file?.originalname;

    const result = await service.importStudentsData({
      user: req.user,
      centerId: center_id || req.query.center_id,
      fileBuffer,
      fileName,
    });

    res.status(202).json(result);
  } catch (err) {
    next(err);
  }
}


async function getImportTemplate(req, res, next) {
  try {
    const { format } = req.query;
    const result = await service.getImportTemplate({ format });

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.buffer);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  exportStudents,
  importStudents,
  getImportTemplate,
};
