import express from "express";
import {
  addSubScriptionToUser,
  createAttachments,
  createRote,
  createUser,
  deleteAttachments,
  deleteMyOneOpenKey,
  deleteRote,
  deleteSubScription,
  editMyOneOpenKey,
  editMyProfile,
  editRote,
  findMyRote,
  findPublicRote,
  findRoteById,
  findSubScriptionToUser,
  findSubScriptionToUserByendpoint,
  findUserPublicRote,
  generateOpenKey,
  getMyOpenKey,
  getMySession,
  getMyTags,
  getOneOpenKey,
  getUserInfoByUsername,
} from "../utils/dbMethods";
import prisma from "../utils/prisma";
import { Rote, User, UserSwSubScription } from "@prisma/client";
import webpush from "../utils/webpush";
import upload from "../utils/upload";
import passport from "passport";
import multer from "multer";
import {
  bodyTypeCheck,
  isAdmin,
  isAuthenticated,
  isAuthor,
  queryTypeCheck,
  sanitizeUserData,
} from "../utils/main";
import mainJson from "../json/main.json";
import useOpenKey from "./useOpenKey";

const { stateType, roteType, safeRoutes } = mainJson;

let routerV1 = express.Router();

routerV1.all("/ping", (req, res) => {
  res.send({
    code: 0,
    msg: "ok",
    data: null,
  });
});

// User method

// routerV1.post("/addUser", isAdmin, (req, res) => {
//   const { username, password, email, nickname } = req.body;
//   if (!username || !password || !email) {
//     res.send({
//       code: 1,
//       msg: "error: data error",
//       data: null,
//     });
//     return;
//   }
//   try {
//     createUser({
//       username,
//       password,
//       email,
//       nickname,
//     }).then(async (user) => {
//       if (user.id) {
//         res.send({
//           code: 0,
//           msg: "ok",
//           data: user,
//         });
//       } else {
//         res.send({
//           code: 1,
//           msg: "error",
//           data: user,
//         });
//       }
//       await prisma.$disconnect();
//     });
//   } catch (error) {
//     res.send({
//       code: 1,
//       msg: "error",
//       data: error,
//     });
//   }
// });

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
  if (username) {
    function isValidUsername(username: string) {
      // 用户名只允许包含大小写字母、数字和下划线
      const validUsernameRegex = /^[a-zA-Z0-9_]+$/;
      return validUsernameRegex.test(username);
    }
    // 检查用户名是否符合要求
    if (!isValidUsername(username)) {
      res.status(401).send({
        code: 1,
        msg: "用户名只能包含大小写字母和数字以及下划线",
        data: null,
      });
      return;
    } else {
      // 检查用户名是否在安全路由数组中
      if (safeRoutes.includes(username)) {
        res.status(401).send({
          code: 1,
          msg: "用户名与路由冲突，换一个吧",
          data: null,
        });
        return;
      }
    }
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
          data: null,
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

routerV1.post("/addSwSubScription", isAuthenticated, async (req, res) => {
  const { subScription } = req.body;
  const user = req.user as User;

  if (!subScription) {
    res.status(401).send({
      code: 1,
      msg: "Need subScription info",
      data: null,
    });
    return;
  }

  try {
    const d = await findSubScriptionToUserByendpoint(subScription.endpoint);
    if (d) {
      res.send({
        code: 0,
        msg: "ok",
        data: d,
      });
    } else {
      addSubScriptionToUser(user.id, subScription)
        .then((e) => {
          res.send({
            code: 0,
            msg: "ok",
            data: e,
          });
        })
        .catch((err) => {
          res.status(401).send({
            code: 1,
            msg: "error",
            data: err,
          });
        });
    }
  } catch (error) {
    res.status(401).send({
      code: 1,
      msg: "error",
      data: error,
    });
  }
});

routerV1.post("/sendSwSubScription", async (req, res) => {
  const { subId }: any = req.query;
  const msg = req.body;

  if (!subId || !msg) {
    res.status(401).send({
      code: 1,
      msg: "error",
      data: "Need subId and msg in query",
    });
    return;
  }

  let to: UserSwSubScription | any = await findSubScriptionToUser(subId);

  if (!to) {
    res.status(401).send({
      code: 1,
      msg: "error",
      data: "UserSwSubScription not found",
    });
    return;
  }

  // 设置更详细的推送通知
  let notificationOptions = {
    title: "自在废物",
    body: "这是我的博客。",
    image: "https://r2.rote.ink/others/logo.png",
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
      JSON.stringify({ ...msg })
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
    res.status(401).send({
      code: 1,
      msg: "error",
      data: null,
    });
  }
});

routerV1.delete("/swSubScription", isAuthenticated, async (req, res) => {
  const { subId }: any = req.query;
  const user = req.user as User;

  if (!subId) {
    res.status(401).send({
      code: 1,
      msg: "error",
      data: "Need subId and msg in query",
    });
    return;
  }

  let to: UserSwSubScription | any = await findSubScriptionToUser(subId);

  if (!to) {
    res.status(401).send({
      code: 1,
      msg: "error",
      data: "UserSwSubScription not found",
    });
    return;
  }

  if (to.userid !== user.id) {
    res.status(401).send({
      code: 1,
      msg: "error",
      data: "User not match!",
    });
    return;
  }

  deleteSubScription(subId)
    .then((data) => {
      res.send({
        code: 0,
        msg: "ok",
        data: data,
      });
    })
    .catch((error) => {
      console.error("Error:", error);
      res.status(401).send({
        code: 1,
        msg: "error",
        data: error,
      });
    });
});

routerV1.post("/addRote", isAuthenticated, bodyTypeCheck, (req, res) => {
  const {
    title,
    content,
    type,
    tags,
    state,
    archived,
    pin,
    editor,
    attachments,
  } = req.body;
  const user = req.user as User;
  if (!content) {
    res.status(401).send({
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
    pin: !!pin,
    editor,
    archived: !!archived,
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
      res.status(401).send({
        code: 1,
        msg: "error",
        data: error,
      });
    });
});

routerV1.post("/getMyRote", isAuthenticated, (req, res) => {
  console.log(req.body);
  const { skip, limit, archived } = req.query;
  const filter = req.body.filter || {};
  const user = req.user as User;

  const parsedSkip = typeof skip === "string" ? parseInt(skip) : undefined;
  const parsedLimit = typeof limit === "string" ? parseInt(limit) : undefined;

  findMyRote(
    user.id,
    parsedSkip,
    parsedLimit,
    filter,
    archived ? (archived === "true" ? true : false) : undefined
  )
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
      res.status(401).send({
        code: 1,
        msg: "error",
        data: e,
      });
      await prisma.$disconnect();
    });
});

routerV1.post("/getUserPublicRote", async (req, res) => {
  console.log(req.body);
  const { skip, limit, archived, username }: any = req.query;
  const filter = req.body.filter || {};

  const parsedSkip = typeof skip === "string" ? parseInt(skip) : undefined;
  const parsedLimit = typeof limit === "string" ? parseInt(limit) : undefined;

  if (!username) {
    res.status(401).send({
      code: 1,
      msg: "error",
      data: "Username not found",
    });
    return;
  }

  const userInfo = await getUserInfoByUsername(username);

  if (!userInfo.id) {
    res.status(401).send({
      code: 1,
      msg: "error",
      data: "Username not found",
    });
    return;
  }

  findUserPublicRote(
    userInfo.id,
    parsedSkip,
    parsedLimit,
    filter,
    archived ? (archived === "true" ? true : false) : undefined
  )
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
      res.status(401).send({
        code: 1,
        msg: "error",
        data: e,
      });
      await prisma.$disconnect();
    });
});

routerV1.post("/getPublicRote", (req, res) => {
  const { skip, limit } = req.query;
  const filter = req.body.filter || {};

  const parsedSkip = typeof skip === "string" ? parseInt(skip) : undefined;
  const parsedLimit = typeof limit === "string" ? parseInt(limit) : undefined;

  findPublicRote(parsedSkip, parsedLimit, filter)
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
      res.status(401).send({
        code: 1,
        msg: "error",
        data: e,
      });
      await prisma.$disconnect();
    });
});

routerV1.get("/getUserInfo", (req, res) => {
  const { username } = req.query;
  if (!username) {
    res.status(403).send({
      code: 1,
      msg: "Need userid",
      data: null,
    });
    return;
  }

  getUserInfoByUsername(username.toString())
    .then(async (data) => {
      res.send({
        code: 0,
        msg: "ok",
        data,
      });
      await prisma.$disconnect();
    })
    .catch(async (e) => {
      res.status(404).send({
        code: 1,
        msg: "error",
        data: e,
      });
      await prisma.$disconnect();
    });
});

routerV1.get("/getMyTags", isAuthenticated, (req, res) => {
  const user = req.user as User;

  if (!user.id) {
    res.status(401).send({
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
      res.status(401).send({
        code: 1,
        msg: "error",
        data: e,
      });
      await prisma.$disconnect();
    });
});

routerV1.get("/oneRote", async (req, res) => {
  const user = req.user as User;
  const { id } = req.query;
  if (!id || id.length !== 24) {
    res.status(401).send({
      code: 1,
      msg: "Need id or id wrong",
      data: null,
    });
    return;
  }
  const rote = await findRoteById(id.toString() || "");
  if (!rote) {
    res.status(401).send({
      code: 1,
      msg: "Not found",
      data: null,
    });
    return;
  }
  if (rote.state == "public") {
    res.send({
      code: 0,
      msg: "ok",
      data: rote,
    });
    return;
  }

  if (rote.authorid == user?.id) {
    res.send({
      code: 0,
      msg: "ok",
      data: rote,
    });
    return;
  }

  res.status(401).send({
    code: 1,
    msg: "rote is private",
    data: null,
  });
});

routerV1.post("/oneRote", isAuthor, bodyTypeCheck, (req, res) => {
  console.log(req.body);
  const rote = req.body;

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
      res.status(401).send({
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
    res.status(401).send({
      code: 1,
      msg: "error",
      data: "Need data",
    });
    return;
  }
  deleteRote(rote)
    .then(async (data) => {
      deleteAttachments(rote.id);
      res.send({
        code: 0,
        msg: "ok",
        data,
      });
      await prisma.$disconnect();
    })
    .catch(async (e) => {
      res.status(401).send({
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
    const user = req.user as User;
    const roteid = req.query.roteid || undefined;
    console.log(req.files);
    if (!req.files) {
      res.status(401).send({
        code: 1,
        msg: "error",
        data: "Need files!",
      });
      return;
    }
    let newFiles = req.files.map((file: any, index: any) => {
      file.location = `https://${process.env.R2_URL_PREFIX}/${file.key}`;
      return file;
    });
    createAttachments(user.id, roteid, newFiles)
      .then((data) => {
        res.send({
          code: 0,
          msg: "ok",
          data,
        });
      })
      .catch(async (e) => {
        res.status(401).send({
          code: 1,
          msg: "error",
          data: e,
        });
        await prisma.$disconnect();
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

routerV1.get("/user", function (req, res) {
  res.send({
    code: 0,
    msg: "ok",
    data: req.user as User,
  });
});

routerV1.post("/profile", isAuthenticated, function (req, res) {
  const user = req.user as User;
  editMyProfile(user.id, req.body)
    .then(async (data) => {
      res.send({
        code: 0,
        msg: "ok",
        data,
      });
      await prisma.$disconnect();
    })
    .catch(async (e) => {
      res.status(401).send({
        code: 1,
        msg: "error",
        data: e,
      });
      await prisma.$disconnect();
    });
});

routerV1.get("/getsession", isAuthenticated, function (req, res) {
  const user = req.user as User;

  if (!user.id) {
    res.status(401).send({
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
      res.status(401).send({
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
    res.status(401).send({
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
    })
    .catch(async (e) => {
      res.status(401).send({
        code: 1,
        msg: "error",
        data: e,
      });
    });
});

routerV1.get("/openkey", isAuthenticated, function (req, res) {
  const user = req.user as User;

  if (!user.id) {
    res.status(401).send({
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
      res.status(401).send({
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
    res.status(401).send({
      code: 1,
      msg: "Need userid",
      data: null,
    });
    return;
  }

  const { id } = req.body;

  if (!id || id.length !== 24) {
    res.status(401).send({
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
      res.status(401).send({
        code: 1,
        msg: "error",
        data: e,
      });
      await prisma.$disconnect();
    });
});

routerV1.post("/openkey", isAuthenticated, bodyTypeCheck, function (req, res) {
  const user = req.user as User;

  if (!user.id) {
    res.status(401).send({
      code: 1,
      msg: "Need userid",
      data: null,
    });
    return;
  }

  const { id, permissions } = req.body;

  if (!id || !permissions) {
    res.status(401).send({
      code: 1,
      msg: "error",
      data: "Data error",
    });
    return;
  }

  editMyOneOpenKey(user.id, id, permissions)
    .then(async (data) => {
      res.send({
        code: 0,
        msg: "ok",
        data,
      });
      await prisma.$disconnect();
    })
    .catch(async (e) => {
      res.status(401).send({
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
    return res.status(401).send({
      code: 1,
      msg: error.code,
      data: null,
    });
  }
});

routerV1.use("/openKey", useOpenKey);

export default routerV1;
