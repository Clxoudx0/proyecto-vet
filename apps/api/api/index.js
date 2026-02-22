// apps/api/api/index.js (VERCEL)
import app from "../app.js";

export default function handler(req, res) {
  return app(req, res);
}