// errorHandler.js
class ErrorHandler {
  static handleError(error, context = "") {
    const timestamp = new Date().toISOString();
    console.error(
      `[${timestamp}] Error${context ? ` in ${context}` : ""}:`,
      error.message
    );
    if (error.stack) {
      console.error("Stacktrace:", error.stack);
    }
    // Depending on the application's needs, you might want to:
    // - Log to a file or a logging service
    // - Send an alert (e.g., email, Slack)
    // - Return a standardized error object to the caller
    // For now, we'll just re-throw for critical errors or return a simple error object
    // This is a placeholder and should be expanded based on requirements.
    if (error.isCritical) {
      throw error; // Re-throw critical errors to be handled by a higher-level try-catch
    }
    return {
      success: false,
      error: error.message,
      context,
      timestamp,
    };
  }

  static createError(message, isCritical = false, details = {}) {
    const error = new Error(message);
    error.isCritical = isCritical;
    error.details = details;
    return error;
  }
}

module.exports = ErrorHandler;
