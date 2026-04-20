class AppError extends Error {
  constructor(code, message, message_ur, status = 400, field = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.message_ur = message_ur;
    this.status = status;
    if (field) this.field = field;
  }
}

module.exports = { AppError };
