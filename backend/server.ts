import express = require("express");
import cors from "cors";
import expressSession = require("express-session");
import passport from "./utils/passport";
import bodyParser from "body-parser";

import prisma from "./utils/prisma";
import { PrismaSessionStore } from "@quixo3/prisma-session-store";

import { recorderIpAndTime } from "./utils/recoder";
import { rateLimiterMiddleware } from "./middleware/limiter";

import routerV1 from "./route/v1";

const app: express.Application = express();

const port = process.env.PORT || 3000;

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

// record ip and time
app.use(recorderIpAndTime);

// rate limiter
app.use(rateLimiterMiddleware);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// body parser
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// cors
app.use(
  cors({
    origin: process.env.CORS?.split(",") || "http://localhost:3000",
    credentials: true,
    optionsSuccessStatus: 200,
  })
);

app.use("/v1/api", routerV1);

app.get("*", (req, res) => {
  res.status(404).send({
    code: 1,
    msg: "Api not found!",
    data: null,
  });
});

app.listen(port, () => {
  console.log(`Rote Node backend server listening on port ${port}!`);
});
