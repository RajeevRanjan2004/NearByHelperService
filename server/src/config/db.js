import mongoose from "mongoose";
import env from "./env.js";

async function connectDB() {
  if (env.useMockData || !env.mongoUri) {
    console.log("MongoDB skipped: running in mock-data mode.");
    return;
  }

  await mongoose.connect(env.mongoUri);
  console.log("MongoDB connected successfully.");
}

export default connectDB;
