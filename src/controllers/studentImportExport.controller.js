const service = require('../services/studentImportExport.service');
// bunny.service is only used for profile images, not import temp files

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

async function getImportStatus(req, res, next) {
  try {
    const { jobId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const result = await service.getImportJobStatus({
      jobId,
      page: parseInt(page),
      limit: parseInt(limit),
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function downloadErrorReport(req, res, next) {
  try {
    const { jobId } = req.params;
    const fs = require('fs');

    const job = await require('../db/knex')('import_jobs').where({ id: jobId }).first();
    if (!job) {
      return res.status(404).json({ error: { message: 'Error report not found for this job.' } });
    }

    // If error report exists on disk, stream it directly
    if (job.error_report_key && fs.existsSync(job.error_report_key)) {
      const ext = job.file_format === 'csv' ? 'csv' : 'xlsx';
      const contentType = ext === 'csv'
        ? 'text/csv; charset=utf-8'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="import_errors_${jobId}.${ext}"`);
      return fs.createReadStream(job.error_report_key).pipe(res);
    }

    // Fallback: generate on the fly from import_errors table
    const generated = await service.generateImportErrorReport(jobId);
    res.setHeader('Content-Type', generated.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${generated.filename}"`);
    return res.send(generated.buffer);
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
  getImportStatus,
  downloadErrorReport,
  getImportTemplate,
};
