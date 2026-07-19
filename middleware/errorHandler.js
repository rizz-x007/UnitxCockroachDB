// middleware/errorHandler.js

/**
 * Route handler decorator.
 * Automatically catches asynchronous route rejections and forwards them to next().
 */
const asyncHandler = fn => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Global application error interceptor.
 */
function errorHandler(err, req, res, next) {
    console.error('❌ [Unhandled Application Error]:', err.stack || err.message || err);

    // Format file-upload size threshold errors elegantly
    if (err.name === 'MulterError') {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ success: false, message: 'File size limit exceeded.' });
        }
        return res.status(400).json({ success: false, message: err.message });
    }

    const status = err.status || 500;
    const message = err.message || 'Internal Server Error';

    res.status(status).json({
        success: false,
        message: status === 500 ? 'An unexpected server error occurred.' : message
    });
}

module.exports = {
    asyncHandler,
    errorHandler
};