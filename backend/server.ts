import express = require("express");
import passport from "./utils/passport";
import bodyParser from "body-parser";
import cors from "cors";

// Import routes
import routerV1 from "./route/v1";
import recoderIpAndTime from "./utils/recoder";
import { PrismaSessionStore } from "@quixo3/prisma-session-store";
import expressSession = require("express-session");
import prisma from "./utils/prisma";
import { rateLimiterMiddleware } from "./middleware/limiter";

const app: express.Application = express();

// Configure session
app.use(
  expressSession({
    secret: process.env.SESSION_SECRET || "sessionSecret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 31 * 24 * 60 * 60 * 1000,
    },
    store: new PrismaSessionStore(prisma, {
      checkPeriod: 2 * 60 * 1000,
      dbRecordIdIsSessionId: true,
    }),
  })
);

app.use(recoderIpAndTime);
app.use(rateLimiterMiddleware);
// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(
  cors({
    origin: process.env.CROS?.split(",") || "*",
    credentials: true,
    optionsSuccessStatus: 200,
  })
);

app.use("/v1/api", routerV1);

app.get("*", (req, res) => {
  res.status(404).send({
    code: 1,
    msg: "Page not found",
    data: null,
  });
});

app.listen(3000, () => {
  console.log(`Rote Node app listening on port ${3000}!`);
});
