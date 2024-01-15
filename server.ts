import express = require("express");
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
var crypto = require("crypto");

var cors = require("cors");
import moment from "moment";
import bodyParser from "body-parser";

import { PrismaClient, UserSwSubScription } from "@prisma/client";

import {
  allUser,
  createUser,
  createRote,
  findRoteById,
  passportCheckUser,
  addSubScriptionToUser,
  findSubScriptionToUser,
} from "./script";

import multer from "multer";
import multerS3 from "multer-s3";

import { r2uploadhandler, s3 } from "./utils/r2";
import { randomUUID } from "crypto";

// webpush PWA消息推送
import webpush from "web-push";

const apiKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY as string,
  privateKey: process.env.VAPID_PRIVATE_KEY as string,
};

webpush.setVapidDetails(
  "mailto:rabit.hua@gmail.com",
  apiKeys.publicKey,
  apiKeys.privateKey
);

// 储存本地
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, "uploads");
//   },
//   filename(req, file, callback) {
//     const { originalname } = file;
//     callback(null, `${randomUUID()}-${originalname}`);
//   },
// });

// 储存内存中
const storage = multer.memoryStorage();

const fileFilter = (req: any, file: any, cb: any) => {
  if (file.mimetype.split("/")[0] === "image") {
    cb(null, true);
  } else {
    cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE"), false);
  }
};

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: `${process.env.R2_BUCKET}`,
    metadata: function (req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
      const { originalname } = file;
      const date = new Date(); // 获取当前日期
      const year = date.getFullYear(); // 获取当前年份
      const month = date.getMonth() + 1; // 获取当前月份（注意月份从 0 开始，需要加 1）

      cb(null, `uploads/${year}/${month}/${randomUUID()}_${originalname}`);
    },
  }),
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 9,
  },
});

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

passport.use(
  new LocalStrategy(async function (username: any, password: any, done: any) {
    console.log(username, password);
    let data = { username };
    let { user, err } = await passportCheckUser(data);
    if (err) {
      console.log(`查找用户时出现错误`);
      return done(err, false, {
        message: "error.",
      });
    }
    if (!user) {
      console.log(`用户${username}不存在`);
      return done(err, false, {
        message: "User not found.",
      });
    }
    console.log(user);
    // 对比hash
    crypto.pbkdf2(
      password,
      user.salt,
      310000,
      32,
      "sha256",
      function (err: any, hashedPassword: any) {
        console.log(`对比用户信息`, hashedPassword);
        if (err) {
          console.log(`对比出现错误`, err);
          return done(err);
        }
        if (!crypto.timingSafeEqual(user?.passwordhash, hashedPassword)) {
          console.log(`未匹配`);
          return done(null, false, {
            message: "Incorrect username or password.",
          });
        } else {
          console.log(`匹配`);
          return done(null, true, user);
        }
      }
    );
  })
);

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
// app.use(
//   cors({
//     origin: "https://localhost:3001",
//     credentials: true,
//   })
// );

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
  const { username, password, email, nickname } = req.body;
  createUser({
    username,
    password,
    email,
    nickname,
  })
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

app.post("/addSwSubScription", (req, res) => {
  const { userId, subScription } = req.body;
  addSubScriptionToUser(userId, subScription)
    .then((e) => {
      res.send({
        code: 0,
        msg: "ok",
        data: e,
      });
    })
    .catch((err) => {
      res.send({
        code: 1,
        msg: "error",
        data: null,
      });
    });
});

app.get("/sendSwSubScription", async (req, res) => {
  const { subId, msg }: any = req.query;

  if (!subId || !msg) {
    res.send({
      code: 1,
      msg: "error",
      data: null,
    });
    return;
  }

  let to: UserSwSubScription | any = await findSubScriptionToUser(subId);

  // 设置更详细的推送通知
  let notificationOptions = {
    title: "自在废物",
    body: "这是我的博客。",
    image: "https://rote-r2.zzfw.cc/others/logo.png",
    data: {
      type: "openUrl",
      url: "https://rabithua.club",
    },
  };

  try {
    webpush.sendNotification(
      {
        endpoint: to.endpoint,
        keys: to.keys,
      },
      JSON.stringify(notificationOptions)
    );
    res.send({
      code: 0,
      msg: "PWA Notication send success!",
      data: {
        toSubId: subId,
        msg: msg,
      },
    });
  } catch (error) {
    res.send({
      code: 1,
      msg: "error",
      data: null,
    });
  }
});

app.post("/addRote", (req, res) => {
  const { title, content, authorid } = req.body;
  createRote({
    title,
    content,
    authorid,
  })
    .then((rote) => {
      res.send({
        code: 0,
        msg: "ok",
        data: rote,
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

app.get("/oneRote", (req, res) => {
  console.log(req.query);
  findRoteById(req.query.id?.toString() || "")
    .then(async (rote) => {
      res.send({
        code: 0,
        msg: "ok",
        data: rote,
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

app.post("/upload", upload.array("file"), async (req: any, res) => {
  console.log(req.files);
  // const result = await r2uploadhandler(req.files[0]);
  // console.log(result);
  let newFiles = req.files.map((file: any, index: any) => {
    file.location = `https://${process.env.R2_URL_PREFIX}/${file.key}`;
    return file;
  });
  console.log(newFiles);
  res.send({
    code: 0,
    msg: "ok",
    data: {
      files: newFiles,
    },
  });
});

app.post(
  "/login/password",
  passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/login",
  })
);

app.use((error: any, req: any, res: any, next: any) => {
  if (error instanceof multer.MulterError) {
    return res.send({
      code: 1,
      msg: error.code,
      data: null,
    });
  }
});

app.get("*", (req, res) => {
  res.send({
    code: 404,
    msg: "Page not found",
    data: null,
  });
});

app.listen(process.env.PORT, () => {
  console.log(`Rote Node app listening on port ${process.env.PORT}!`);
});
