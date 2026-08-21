import express from "express";
import cors from "cors";
import healthRoutes from "./routes/health.routes.js";

const app = express();

// Standard middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use("/api/health", healthRoutes);

// Catch-all 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).json({
    status: "error",
    message: `Route ${req.originalUrl} not found on AlertIQ Backend API`
  });
});

export default app;
