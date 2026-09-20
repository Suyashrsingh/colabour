import express from "express";
import { createServer } from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use(express.json());

  // Razorpay Standard Checkout Endpoints
  const { handleCreateOrder, handleVerifyPayment } = await import("./razorpay.js");

  app.post("/api/create-order", async (req, res) => {
    try {
      const result = await handleCreateOrder(req.body);
      res.status(result.status).json(result.body);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Internal server error" });
    }
  });

  app.post("/api/verify-payment", async (req, res) => {
    try {
      const result = handleVerifyPayment(req.body);
      res.status(result.status).json(result.body);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Internal server error" });
    }
  });

  // Serve static files from dist/public
  const staticPath =
    fs.existsSync(path.resolve(__dirname, "public"))
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

  // Handle client-side routing - serve index.html for all routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
