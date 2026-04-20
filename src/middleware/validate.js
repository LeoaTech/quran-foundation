const { AppError } = require('../utils/errors');

function validate(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const first = result.error.errors[0];
      const field = first.path.length ? first.path.join('.') : undefined;
      return next(new AppError(
        'VALIDATION_ERROR',
        first.message,
        'درج کردہ معلومات درست نہیں ہیں۔',
        400,
        field,
      ));
    }
    req.body = result.data;
    next();
  };
}

module.exports = validate;
