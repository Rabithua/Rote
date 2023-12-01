import express = require("express");
import session from "express-session";
import passport from "passport";
import LocalStrategy from "passport-local";

var cors = require("cors");
import moment from "moment";
import bodyParser from "body-parser";

import { PrismaClient } from "@prisma/client";
import { allUser, createUser, createPost, findPostById } from "./script";

const prisma = new PrismaClient({
  log: [
    { level: "warn", emit: "event" },
    { level: "info", emit: "event" },
    { level: "error", emit: "event" },
  ],
});

prisma.$on("warn", (e) => {
  console.log(e);
});

prisma.$on("info", (e) => {
  console.log(e);
});

prisma.$on("error", (e) => {
  console.log(e);
});

// Create a new express application instance
const app: express.Application = express();
// 配置会话
app.use(
  session({
    secret: "RoteByRabithua",
    resave: false,
    saveUninitialized: false,
  })
);
// 初始化 Passport
app.use(passport.initialize());

// 使用 passport.session() 中间件处理会话
app.use(passport.session());

// passport.use(
//   new LocalStrategy(function (username, password, done) {
//     User.findOne({ username: username }, function (err, user) {
//       if (err) {
//         return done(err);
//       }
//       if (!user) {
//         return done(null, false);
//       }
//       if (!user.verifyPassword(password)) {
//         return done(null, false);
//       }
//       return done(null, user);
//     });
//   })
// );
// 请求中间件，记录IP和时间
const Middleware = function (req: any, res: any, next: any) {
  const ipAddress = req.ip;
  console.log(
    `${moment().format("YYYY/MM/DD HH:mm:ss")} ${ipAddress} ${req.method} ${
      req.path
    }`
  );
  next();
};
app.use(Middleware);
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(
  cors({
    origin: process.env.ORIGIN,
  })
);

app.get("/", (req, res) => {
  allUser()
    .then(async (users) => {
      res.send({
        code: 0,
        msg: "ok",
        data: users,
      });
      await prisma.$disconnect();
    })
    .catch(async (e) => {
      console.error("Error:", e);
      res.send({
        code: 1,
        msg: "error",
        data: null,
      });
      await prisma.$disconnect();
      process.exit(1);
    });
});

app.post("/addUser", (req, res) => {
  createUser(req.body)
    .then(async (user) => {
      res.send({
        code: 0,
        msg: "ok",
        data: user,
      });
      await prisma.$disconnect();
    })
    .catch(async (e) => {
      console.error("Error:", e);
      res.send({
        code: 1,
        msg: "error",
        data: null,
      });
      console.error(e);
      await prisma.$disconnect();
      process.exit(1);
    });
});

app.post("/addPost", (req, res) => {
  const { title, content, authorId } = req.body;
  createPost(title, content, authorId)
    .then((post) => {
      res.send({
        code: 0,
        msg: "ok",
        data: post,
      });
    })
    .catch((error) => {
      console.error("Error:", error);
      res.send({
        code: 1,
        msg: "error",
        data: null,
      });
    });
});

app.get("/onePost", (req, res) => {
  console.log(req.query);
  findPostById(req.query.id?.toString() || "")
    .then(async (post) => {
      res.send({
        code: 0,
        msg: "ok",
        data: post,
      });
      await prisma.$disconnect();
    })
    .catch(async (e) => {
      console.error("Error:", e);
      res.send({
        code: 1,
        msg: "error",
        data: null,
      });
      console.error(e);
      await prisma.$disconnect();
      process.exit(1);
    });
});

app.listen(3000, () => {
  console.log("Example app listening on port 3000!");
});
