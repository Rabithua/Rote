import express from "express";
import {
  addSubScriptionToUser,
  allUser,
  createRote,
  createUser,
  findRoteById,
  findSubScriptionToUser,
} from "../script";
import prisma from "../utils/prisma";
import { User, UserSwSubScription } from "@prisma/client";
import webpush from "../utils/webpush";
import upload from "../utils/upload";
import passport from "passport";
import multer from "multer";

let routerV1 = express.Router();

// User method

routerV1.get("/", (req, res) => {
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

routerV1.post("/addUser", (req, res) => {
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

routerV1.post("/addSwSubScription", (req, res) => {
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

routerV1.get("/sendSwSubScription", async (req, res) => {
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

routerV1.post("/addRote", (req, res) => {
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

routerV1.get("/oneRote", (req, res) => {
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

routerV1.post("/upload", upload.array("file"), async (req: any, res) => {
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

routerV1.post('/login/password',
  (req, res, next) => {
    passport.authenticate('local', (err: any, user: User, data: any) => {
      console.log(JSON.stringify(data))
      if (err) {
        res.send({
          code: 1,
          msg: 'error',
          data: data
        })
        return;
      }
      if (!user) {
        res.send({
          code: 1,
          msg: 'error',
          data: data
        })
        return;
      }
      req.logIn(user, (err) => {
        if (err) {
          res.send({
            code: 1,
            msg: 'error',
            data: err
          })
        }
        delete (user as { passwordhash?: Buffer }).passwordhash
        delete (user as { salt?: Buffer }).salt
        res.send({
          code: 0,
          msg: 'ok',
          data: user
        })
      })
    })(req, res, next)
  })

routerV1.post('/logout', function (req, res, next) {
  req.logout(function (err) {
    if (err) { return next(err); }
    res.send({
      code: 0,
      msg: 'ok',
      data: null
    })
  });
});


// 文件上传错误处理
routerV1.use((error: any, req: any, res: any, next: any) => {
  if (error instanceof multer.MulterError) {
    return res.send({
      code: 1,
      msg: error.code,
      data: null,
    });
  }
});

export default routerV1;
