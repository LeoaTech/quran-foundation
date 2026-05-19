const service = require('../services/donations.service');
const { z } = require('zod');
const { AppError } = require('../utils/errors');

const recordSchema = z.object({
  donor_type: z.enum(['student', 'teacher', 'visitor', 'guardian']),
  donor_user_id: z.string().uuid().optional().nullable(),
  donor_name: z.string().min(1, "Name is required").default('Anonymous'),
  donor_phone: z.string().optional().nullable(),
  amount: z.number().positive(),
  date_received: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  purpose: z.string().min(1, "Purpose is required"),
  notes: z.string().optional().nullable(),
  is_anonymous: z.boolean().optional().default(false),
});

async function recordDonation(req, res, next) {
  try {
    const body = recordSchema.parse(req.body);
    
    const donation = await service.recordDonation({
      user: req.user,
      body,
    });
    
    res.status(201).json(donation);
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new AppError('VALIDATION_ERROR', err.errors[0].message, 'درست معلومات فراہم کریں۔', 400));
    } else {
      next(err);
    }
  }
}

async function listDonations(req, res, next) {
  try {
    const result = await service.listDonations({
      user: req.user,
      query: req.query,
    });
    
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  recordDonation,
  listDonations,
};
