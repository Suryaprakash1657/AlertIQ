import app from "./app.js";
import { config } from "./config/env.js";

const server = app.listen(config.port, () => {
  console.log(`[AlertIQ Backend] Server running in ${config.nodeEnv} mode on port ${config.port}`);
  console.log(`[AlertIQ Backend] Health check available at: http://localhost:${config.port}/api/health`);
});

export default server;
