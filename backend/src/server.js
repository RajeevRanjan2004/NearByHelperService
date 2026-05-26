import app from "./app.js";
import connectDB from "./config/db.js";
import env from "./config/env.js";

async function startServer() {
  let startupMode = env.useMockData || !env.mongoUri ? "mock-data mode" : "database mode";

  try {
    await connectDB();
  } catch (error) {
    startupMode = "mock-data fallback";
    console.error(`MongoDB unavailable, continuing in mock-data fallback: ${error.message}`);
  }

  app.listen(env.port, () => {
    console.log(`Server running on http://localhost:${env.port} (${startupMode})`);
  });
}

startServer();
