import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import express from "express";
import morgan from "morgan";
import env from "./config/env.js";
import "./models/index.js";
import routes from "./routes/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, "../../client/dist");
const clientIndexPath = path.join(clientDistPath, "index.html");
const hasClientBuild = fs.existsSync(clientIndexPath);

const app = express();

app.use(
  cors({
    origin: env.clientUrl,
  })
);
app.use(
  express.json({
    limit: "6mb",
    verify: (request, _response, buffer) => {
      if (request.originalUrl === "/api/payments/razorpay/webhook") {
        request.rawBody = buffer.toString("utf8");
      }
    },
  })
);
app.use(morgan("dev"));

app.get("/api", (_request, response) => {
  response.json({
    success: true,
    message: "Nearby Helper Service Finder API",
  });
});

app.use("/api", routes);

if (hasClientBuild) {
  app.use(express.static(clientDistPath));

  app.get("*", (request, response, next) => {
    if (request.path.startsWith("/api")) {
      next();
      return;
    }

    response.sendFile(clientIndexPath);
  });
} else {
  app.get("/", (_request, response) => {
    response.json({
      success: true,
      message: "Nearby Helper Service Finder API",
    });
  });
}

app.use((error, _request, response, _next) => {
  console.error("Server error:", error.message);

  response.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

app.use((_request, response) => {
  response.status(404).json({
    success: false,
    message: "Route not found",
  });
});

export default app;
