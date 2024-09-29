import { User, UserSwSubScription } from "@prisma/client";
import express from "express";
import formidable from "formidable";
import passport from "passport";
import {
  addSubScriptionToUser,
  changeUserPassword,
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
  exportData,
  findMyRandomRote,
  findMyRote,
  findPublicRote,
  findRandomPublicRote,
  findRoteById,
  findSubScriptionToUser,
  findSubScriptionToUserByendpoint,
  findUserPublicRote,
  generateOpenKey,
  getHeatMap,
  getMyOpenKey,
  getMySession,
  getMyTags,
  getSiteMapData,
  getStatus,
  getUserInfoByUsername,
  statistics,
} from "../utils/dbMethods";
import prisma from "../utils/prisma";
import webpush from "../utils/webpush";

import { randomUUID } from "crypto";
import moment from "moment";
import { UploadResult } from "../types/main";
import {
  bodyTypeCheck,
  isAuthenticated,
  isAuthor,
  sanitizeUserData,
} from "../utils/main";
import { r2uploadhandler } from "../utils/r2";
import { RegisterDataZod, passwordChangeZod } from "../utils/zod";
import useOpenKey from "./useOpenKey";

let routerV1 = express.Router();

routerV1.all("/ping", (req, res) => {
  res.send({
    code: 0,
    msg: "ok",
    data: null,
  });
});

routerV1.post("/register", (req, res) => {
  const { username, password, email, nickname } = req.body;

  try {
    RegisterDataZod.parse(req.body);
  } catch (err: any) {
    res.status(401).send({
      code: 1,
      msg: JSON.parse(err.message)[0].message,
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

  if (!webpush) {
    res.status(401).send({
      code: 1,
      msg: "error",
      data: "Vaipd keys not found",
    });
    return;
  }

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
  if (!content && !attachments) {
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

routerV1.post("/upload", isAuthenticated, async (req, res) => {
  const user = req.user as User;
  const roteid = req.query.roteid as string | undefined;

  const form = formidable({
    multiples: true,
    maxFileSize: 20 * 1024 * 1024, // 5MB limit
    maxFiles: 9,
    maxTotalFileSize: 100 * 1024 * 1024, // 100MB limit
    filename: () => {
      return `${randomUUID()}`;
    },
  });

  const uploadResults: UploadResult[] = [];

  try {
    const [fields, files] = await form.parse(req);
    if (!files.images) {
      return res.status(400).json({ error: "No images uploaded" });
    }
    const imageFiles = Array.isArray(files.images)
      ? files.images
      : [files.images];

    for (const file of imageFiles) {
      let r2_upload_result = await r2uploadhandler(file);

      if (r2_upload_result !== null) {
        uploadResults.push(r2_upload_result);
      }
    }

    const data = await createAttachments(user.id, roteid, uploadResults);

    res.status(200).json({
      code: 0,
      msg: "ok",
      data,
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({
      code: 1,
      msg: "error",
      data: "Upload or database operation failed",
    });
  } finally {
    await prisma.$disconnect();
  }
});

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

routerV1.post("/getMyHeatmap", isAuthenticated, function (req, res) {
  const user = req.user as User;
  const { startDate, endDate } = req.body;
  if (!startDate || !endDate) {
    res.status(401).send({
      code: 1,
      msg: "error",
      data: "Need startDate and endDate",
    });
    return;
  }

  getHeatMap(user.id, startDate, endDate)
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

routerV1.get("/sitemapData", function (req, res) {
  getSiteMapData()
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

routerV1.get("/status", (req, res) => {
  getStatus()
    .then(async (data) => {
      res.send({
        code: 0,
        msg: "ok",
        data: {},
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

routerV1.get("/randomRote", (req, res) => {
  const user = req.user as User;

  if (user) {
    console.log(user.id);
    // 获取用户的一条随机 rote
    findMyRandomRote(user.id)
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
  } else {
    findRandomPublicRote()
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
  }
});

routerV1.get("/exportData", isAuthenticated, (req, res) => {
  const user = req.user as User;

  exportData(user.id)
    .then(async (data) => {
      // 将data创建为一个json文件，访问路由直接下载

      // 将JSON数据转换为字符串
      const jsonData = JSON.stringify(data);

      // 设置响应头，以便浏览器将响应作为文件下载
      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=${user.username}-${moment().format(
          "YYYY/MM/DD HH:mm:ss"
        )}.json`
      );

      // 发送JSON字符串作为响应
      res.send(jsonData);
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

routerV1.get("/statistics", isAuthenticated, (req, res) => {
  const user = req.user as User;

  statistics(user.id)
    .then(async (data) => {
      res.send({
        code: 0,
        msg: "ok",
        data: data,
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

routerV1.post("/change/password", isAuthenticated, (req, res) => {
  const user = req.user as User;
  const { newpassword, oldpassword } = req.body;

  let zodData = passwordChangeZod.safeParse(req.body);

  if (zodData.success === false) {
    res.status(401).send({
      code: 1,
      msg: "error",
      data: zodData.error.errors[0].message,
    });
    return;
  }

  changeUserPassword(oldpassword, newpassword, user.id)
    .then(async (user) => {
      res.send({
        code: 0,
        msg: "ok",
        data: user,
      });
      await prisma.$disconnect();
    })
    .catch(async (e) => {
      res.status(401).send({
        code: 1,
        msg: "error",
        data: e.message,
      });
    });
});

routerV1.use("/openKey", useOpenKey);

export default routerV1;
