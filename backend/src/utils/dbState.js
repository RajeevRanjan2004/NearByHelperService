import mongoose from "mongoose";
import env from "../config/env.js";

function isDatabaseReady() {
  return !env.useMockData && mongoose.connection.readyState === 1;
}

export { isDatabaseReady };
