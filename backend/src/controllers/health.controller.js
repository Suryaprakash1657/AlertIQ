/**
 * Health check controller
 * Confirms that the AlertIQ backend service is running and healthy.
 */
export const getHealth = (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "AlertIQ Backend API",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString()
  });
};
