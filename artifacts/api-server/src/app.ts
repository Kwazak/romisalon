import { existsSync } from "node:fs";
import path from "node:path";
import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use("/api", router);

const candidatePublicDirs = [
  path.resolve(import.meta.dirname, "../../frontend"),
  path.resolve(process.cwd(), "../frontend"),
  path.resolve(process.cwd(), "frontend"),
  path.resolve(import.meta.dirname, "../../romi-salon/dist/public"),
  path.resolve(process.cwd(), "artifacts/romi-salon/dist/public"),
  path.resolve(process.cwd(), "../romi-salon/dist/public"),
  "d:/project/RomiSalon/artifacts/romi-salon/dist/public",
];
const publicDir = candidatePublicDirs.find((dir) => existsSync(path.join(dir, "index.html")));

if (publicDir) {
  app.use(express.static(publicDir));
  app.use((req, res, next) => {
    if (req.method === "GET" && !req.path.startsWith("/api")) {
      res.sendFile(path.join(publicDir, "index.html"));
      return;
    }
    next();
  });
}

export default app;
