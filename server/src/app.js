import cors from "cors";
import express from "express";
import morgan from "morgan";
import env from "./config/env.js";
import "./models/index.js";
import routes from "./routes/index.js";

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

app.get("/", (_request, response) => {
  response.json({
    success: true,
    message: "Nearby Helper Service Finder API",
  });
});

app.use("/api", routes);

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
