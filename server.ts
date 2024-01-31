import express = require("express");
import passport from "./utils/passport";
import bodyParser from "body-parser";
import cors from 'cors';

// 引入路由
import routerV1 from "./route/v1";
import recoderIpAndTime from "./utils/recoder";
import { PrismaSessionStore } from '@quixo3/prisma-session-store';
import expressSession = require("express-session");
import prisma from "./utils/prisma";


const app: express.Application = express();

// 配置会话
app.use(
  expressSession({
    secret: process.env.SESSION_SECRET || 'sessionSecret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 },
    store: new PrismaSessionStore(
      prisma,
      {
        checkPeriod: 2 * 60 * 1000, // 检查过期会话的时间间隔
        dbRecordIdIsSessionId: true, // 将会话ID用作Prisma记录ID
      }
    ),
  })
);

app.use(recoderIpAndTime);
// 初始化 Passport
app.use(passport.initialize());
app.use(passport.session());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors({
  origin: 'https://localhost:3001',
  optionsSuccessStatus: 200 // 一些旧的浏览器（如IE11、各种智能电视）对204的响应不支持
}));

app.use("/v1/api", routerV1);

// 404
app.get("*", (req, res) => {
  res.status(404).send({
    code: 1,
    msg: "Page not found",
    data: null,
  });
});

app.listen(process.env.PORT, () => {
  console.log(`Rote Node app listening on port ${process.env.PORT}!`);
});
