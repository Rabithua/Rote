import express from "express";
import {
  addSubScriptionToUser,
  createRote,
  createUser,
  deleteMyOneOpenKey,
  deleteRote,
  editRote,
  findMyRote,
  findRoteById,
  findSubScriptionToUser,
  generateOpenKey,
  getMyOpenKey,
  getMySession,
  getMyTags,
  getUserInfoById,
} from "../utils/dbMethods";
import prisma from "../utils/prisma";
import { User, UserSwSubScription } from "@prisma/client";
import webpush from "../utils/webpush";
import upload from "../utils/upload";
import passport from "passport";
import multer from "multer";
import {
  isAdmin,
  isAuthenticated,
  isAuthor,
  sanitizeUserData,
} from "../utils/main";

let routerV1 = express.Router();

routerV1.all("/ping", isAdmin, (req, res) => {
  res.send({
    code: 0,
    msg: "ok",
    data: null,
  });
});

// User method

routerV1.post("/addUser", isAdmin, (req, res) => {
  const { username, password, email, nickname } = req.body;
  if (!username || !password || !email) {
    res.send({
      code: 1,
      msg: "error: data error",
      data: null,
    });
    return;
  }
  try {
    createUser({
      username,
      password,
      email,
      nickname,
    }).then(async (user) => {
      if (user.id) {
        res.send({
          code: 0,
          msg: "ok",
          data: user,
        });
      } else {
        res.send({
          code: 1,
          msg: "error",
          data: user,
        });
      }
      await prisma.$disconnect();
    });
  } catch (error) {
    res.send({
      code: 1,
      msg: "error",
      data: error,
    });
  }
});

routerV1.post("/register", (req, res) => {
  const { username, password, email, nickname } = req.body;
  if (!username || !password || !email) {
    res.status(401).send({
      code: 1,
      msg: "error: data error",
      data: null,
    });
    return;
  }
  try {
    createUser({
      username,
      password,
      email,
      nickname,
    }).then(async (user) => {
      if (user.id) {
        res.send({
          code: 0,
          msg: "ok",
          data: user,
        });
      } else {
        res.status(401).send({
          code: 1,
          msg: "注册失败，用户名或邮箱已被占用",
          data: user,
        });
      }
      await prisma.$disconnect();
    });
  } catch (error) {
    res.status(401).send({
      code: 1,
      msg: "error",
      data: error,
    });
  }
});

routerV1.post("/addSwSubScription", isAuthenticated, (req, res) => {
  const { subScription } = req.body;
  if (!subScription) {
    res.send({
      code: 1,
      msg: "Need subScription info",
      data: null,
    });
    return;
  }
  const user = req.user as User;
  addSubScriptionToUser(user.id, subScription)
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
        data: err,
      });
    });
});

routerV1.get("/sendSwSubScription", async (req, res) => {
  const { subId, msg }: any = req.query;

  if (!subId || !msg) {
    res.send({
      code: 1,
      msg: "error",
      data: "Need subId and msg in query",
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

routerV1.post("/addRote", isAuthenticated, (req, res) => {
  const { title, content, type, tags, state, pin, editor, attachments } =
    req.body;
  const user = req.user as User;
  if (!content) {
    res.send({
      code: 1,
      msg: "error",
      data: "Need content",
    });
    return;
  }
  createRote({
    title,
    content,
    type,
    tags,
    state,
    pin,
    editor,
    attachments,
    authorid: user.id,
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
        data: error,
      });
    });
});

routerV1.post("/getMyRote", isAuthenticated, (req, res) => {
  console.log(req.body);
  const { skip, limit } = req.query;
  const filter = req.body.filter || {};
  const user = req.user as User;

  const parsedSkip = typeof skip === "string" ? parseInt(skip) : undefined;
  const parsedLimit = typeof limit === "string" ? parseInt(limit) : undefined;

  findMyRote(user.id, parsedSkip, parsedLimit, filter)
    .then(async (rote) => {
      res.send({
        code: 0,
        msg: "ok",
        data: rote,
      });
      await prisma.$disconnect();
    })
    .catch(async (e) => {
      console.log(e);
      res.send({
        code: 1,
        msg: "error",
        data: e,
      });
      await prisma.$disconnect();
    });
});

routerV1.get("/getUserInfo", (req, res) => {
  const { userid } = req.query;
  if (!userid) {
    res.send({
      code: 1,
      msg: "Need userid",
      data: null,
    });
    return;
  }
  getUserInfoById(userid)
    .then(async (data) => {
      res.send({
        code: 0,
        msg: "ok",
        data,
      });
      await prisma.$disconnect();
    })
    .catch(async (e) => {
      res.send({
        code: 1,
        msg: "error",
        data: e,
      });
      await prisma.$disconnect();
    });
});

routerV1.get("/getMyTags", (req, res) => {
  const user = req.user as User;

  if (!user.id) {
    res.send({
      code: 1,
      msg: "Need userid",
      data: null,
    });
    return;
  }
  getMyTags(user.id)
    .then(async (data) => {
      res.send({
        code: 0,
        msg: "ok",
        data,
      });
      await prisma.$disconnect();
    })
    .catch(async (e) => {
      res.send({
        code: 1,
        msg: "error",
        data: e,
      });
      await prisma.$disconnect();
    });
});

routerV1.get("/oneRote", (req, res) => {
  console.log(req.query);
  const { id } = req.query;
  if (!id) {
    res.send({
      code: 1,
      msg: "error",
      data: "Need id",
    });
    return;
  }
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
      res.send({
        code: 1,
        msg: "error",
        data: e,
      });
      await prisma.$disconnect();
    });
});

routerV1.post("/oneRote", isAuthor, (req, res) => {
  console.log(req.body);
  const rote = req.body;
  if (!rote) {
    res.send({
      code: 1,
      msg: "error",
      data: "Need data",
    });
    return;
  }
  editRote(rote)
    .then(async (rote) => {
      res.send({
        code: 0,
        msg: "ok",
        data: rote,
      });
      await prisma.$disconnect();
    })
    .catch(async (e) => {
      res.send({
        code: 1,
        msg: "error",
        data: e,
      });
      await prisma.$disconnect();
    });
});

routerV1.delete("/oneRote", isAuthor, (req, res) => {
  console.log(req.body);
  const rote = req.body;
  if (!rote) {
    res.send({
      code: 1,
      msg: "error",
      data: "Need data",
    });
    return;
  }
  deleteRote(rote)
    .then(async (rote) => {
      res.send({
        code: 0,
        msg: "ok",
        data: rote,
      });
      await prisma.$disconnect();
    })
    .catch(async (e) => {
      res.send({
        code: 1,
        msg: "error",
        data: e,
      });
      await prisma.$disconnect();
    });
});

routerV1.post(
  "/upload",
  isAuthenticated,
  upload.array("file"),
  async (req: any, res) => {
    console.log(req.files);
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
  }
);

routerV1.post("/login/password", function (req, res, next) {
  passport.authenticate("local", (err: any, user: User, data: any) => {
    if (err) {
      res.status(401).send({
        code: 1,
        msg: "error",
        data: data,
      });
      return;
    }
    if (!user) {
      res.status(401).send({
        code: 1,
        msg: "error",
        data: data,
      });
      return;
    }
    req.logIn(user, (err) => {
      if (err) {
        res.status(401).send({
          code: 1,
          msg: "error",
          data: err,
        });
      }
      res.send({
        code: 0,
        msg: "ok",
        data: sanitizeUserData(user),
      });
    });
  })(req, res, next);
});

routerV1.post("/logout", isAuthenticated, function (req, res, next) {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.send({
      code: 0,
      msg: "ok",
      data: null,
    });
  });
});

routerV1.get("/profile", isAuthenticated, function (req, res) {
  res.send({
    code: 0,
    msg: "ok",
    data: req.user as User,
  });
});

routerV1.get("/getsession", isAuthenticated, function (req, res) {
  const user = req.user as User;

  if (!user.id) {
    res.send({
      code: 1,
      msg: "Need userid",
      data: null,
    });
    return;
  }

  getMySession(user.id)
    .then(async (data) => {
      res.send({
        code: 0,
        msg: "ok",
        data,
      });
      await prisma.$disconnect();
    })
    .catch(async (e) => {
      res.send({
        code: 1,
        msg: "error",
        data: e,
      });
      await prisma.$disconnect();
    });
});

routerV1.get("/openkey/generate", isAuthenticated, function (req, res) {
  const user = req.user as User;

  if (!user.id) {
    res.send({
      code: 1,
      msg: "Need userid",
      data: null,
    });
    return;
  }

  generateOpenKey(user.id)
    .then(async (data) => {
      res.send({
        code: 0,
        msg: "ok",
        data,
      });
      await prisma.$disconnect();
    })
    .catch(async (e) => {
      res.send({
        code: 1,
        msg: "error",
        data: e,
      });
      await prisma.$disconnect();
    });
});

routerV1.get("/openkey", isAuthenticated, function (req, res) {
  const user = req.user as User;

  if (!user.id) {
    res.send({
      code: 1,
      msg: "Need userid",
      data: null,
    });
    return;
  }

  getMyOpenKey(user.id)
    .then(async (data) => {
      res.send({
        code: 0,
        msg: "ok",
        data,
      });
      await prisma.$disconnect();
    })
    .catch(async (e) => {
      res.send({
        code: 1,
        msg: "error",
        data: e,
      });
      await prisma.$disconnect();
    });
});

routerV1.delete("/openkey", isAuthenticated, function (req, res) {
  const user = req.user as User;

  if (!user.id) {
    res.send({
      code: 1,
      msg: "Need userid",
      data: null,
    });
    return;
  }

  const { id } = req.body;

  if (!id || id.length !== 24) {
    res.send({
      code: 1,
      msg: "error",
      data: "Data error",
    });
    return;
  }

  deleteMyOneOpenKey(user.id, id)
    .then(async (data) => {
      res.send({
        code: 0,
        msg: "ok",
        data,
      });
      await prisma.$disconnect();
    })
    .catch(async (e) => {
      res.send({
        code: 1,
        msg: "error",
        data: e,
      });
      await prisma.$disconnect();
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
