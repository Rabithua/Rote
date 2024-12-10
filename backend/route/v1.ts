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
import { errorHandler, asyncHandler } from "../utils/handlers";

let routerV1 = express.Router();

routerV1.all("/ping", (req, res) => {
  res.send({
    code: 0,
    msg: "ok",
    data: null,
  });
});

routerV1.post(
  "/register",
  asyncHandler(async (req, res) => {
    const { username, password, email, nickname } = req.body;

    RegisterDataZod.parse(req.body);

    const user = await createUser({
      username,
      password,
      email,
      nickname,
    });

    if (!user.id) {
      throw new Error("Registration failed, username or email already exists");
    }

    res.send({
      code: 0,
      msg: "ok",
      data: user,
    });
  })
);

routerV1.post(
  "/addSwSubScription",
  isAuthenticated,
  asyncHandler(async (req, res) => {
    const { subScription } = req.body;
    const user = req.user as User;

    if (!subScription) {
      throw new Error("Need subscription info");
    }

    const d = await findSubScriptionToUserByendpoint(subScription.endpoint);
    if (d) {
      res.send({
        code: 0,
        msg: "ok",
        data: d,
      });
      return;
    }

    const result = await addSubScriptionToUser(user.id, subScription);
    res.send({
      code: 0,
      msg: "ok",
      data: result,
    });
  })
);

routerV1.post(
  "/sendSwSubScription",
  asyncHandler(async (req, res) => {
    const { subId }: any = req.query;
    const msg = req.body;

    if (!webpush) {
      throw new Error("Valid keys not found");
    }

    if (!subId || !msg) {
      throw new Error("Need subId and msg in query");
    }

    const to = await findSubScriptionToUser(subId);
    if (!to) {
      throw new Error("UserSwSubScription not found");
    }

    await webpush.sendNotification(
      {
        endpoint: to.endpoint,
        keys: to.keys,
      },
      JSON.stringify({ ...msg })
    );

    res.send({
      code: 0,
      msg: "PWA Notification send success!",
      data: {
        toSubId: subId,
        msg: msg,
      },
    });
  })
);

routerV1.delete(
  "/swSubScription",
  isAuthenticated,
  asyncHandler(async (req, res) => {
    const { subId }: any = req.query;
    const user = req.user as User;

    if (!subId) {
      throw new Error("Need subId in query");
    }

    const to = await findSubScriptionToUser(subId);
    if (!to) {
      throw new Error("UserSwSubScription not found");
    }

    if (to.userid !== user.id) {
      throw new Error("User not match!");
    }

    const data = await deleteSubScription(subId);
    res.send({
      code: 0,
      msg: "ok",
      data: data,
    });
  })
);

routerV1.post(
  "/addRote",
  isAuthenticated,
  bodyTypeCheck,
  asyncHandler(async (req, res) => {
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
      throw new Error("Content is required");
    }

    const rote = await createRote({
      title,
      content,
      type,
      tags,
      state,
      pin: !!pin,
      editor,
      archived: !!archived,
      authorid: user.id,
    });

    res.send({
      code: 0,
      msg: "ok",
      data: rote,
    });
  })
);

routerV1.post(
  "/getMyRote",
  isAuthenticated,
  asyncHandler(async (req, res) => {
    const { skip, limit, archived } = req.query;
    const filter = req.body.filter || {};
    const user = req.user as User;

    const parsedSkip = typeof skip === "string" ? parseInt(skip) : undefined;
    const parsedLimit = typeof limit === "string" ? parseInt(limit) : undefined;

    const rote = await findMyRote(
      user.id,
      parsedSkip,
      parsedLimit,
      filter,
      archived ? (archived === "true" ? true : false) : undefined
    );

    res.send({
      code: 0,
      msg: "ok",
      data: rote,
    });
  })
);

routerV1.post(
  "/getUserPublicRote",
  asyncHandler(async (req, res) => {
    const { skip, limit, archived, username }: any = req.query;
    const filter = req.body.filter || {};

    const parsedSkip = typeof skip === "string" ? parseInt(skip) : undefined;
    const parsedLimit = typeof limit === "string" ? parseInt(limit) : undefined;

    if (!username) {
      throw new Error("Username not found");
    }

    const userInfo = await getUserInfoByUsername(username);

    if (!userInfo.id) {
      throw new Error("Username not found");
    }

    const rote = await findUserPublicRote(
      userInfo.id,
      parsedSkip,
      parsedLimit,
      filter,
      archived ? (archived === "true" ? true : false) : undefined
    );

    res.send({
      code: 0,
      msg: "ok",
      data: rote,
    });
  })
);

routerV1.post(
  "/getPublicRote",
  asyncHandler(async (req, res) => {
    const { skip, limit } = req.query;
    const filter = req.body.filter || {};

    const parsedSkip = typeof skip === "string" ? parseInt(skip) : undefined;
    const parsedLimit = typeof limit === "string" ? parseInt(limit) : undefined;

    const rote = await findPublicRote(parsedSkip, parsedLimit, filter);

    res.send({
      code: 0,
      msg: "ok",
      data: rote,
    });
  })
);

routerV1.get(
  "/getUserInfo",
  asyncHandler(async (req, res) => {
    const { username } = req.query;
    if (!username) {
      throw new Error("Need userid");
    }

    const data = await getUserInfoByUsername(username.toString());
    res.send({
      code: 0,
      msg: "ok",
      data,
    });
  })
);

routerV1.get(
  "/getMyTags",
  isAuthenticated,
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    if (!user.id) {
      throw new Error("Need userid");
    }

    const data = await getMyTags(user.id);
    res.send({
      code: 0,
      msg: "ok",
      data,
    });
  })
);

routerV1.get(
  "/oneRote",
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    const { id } = req.query;

    if (!id || id.length !== 24) {
      throw new Error("Invalid or missing ID");
    }

    const rote = await findRoteById(id.toString());
    if (!rote) {
      throw new Error("Rote not found");
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

    throw new Error("Access denied: rote is private");
  })
);

routerV1.post(
  "/oneRote",
  isAuthor,
  bodyTypeCheck,
  asyncHandler(async (req, res) => {
    const rote = req.body;
    const data = await editRote(rote);

    res.send({
      code: 0,
      msg: "ok",
      data: data,
    });
  })
);

routerV1.delete(
  "/oneRote",
  isAuthor,
  asyncHandler(async (req, res) => {
    const rote = req.body;
    if (!rote) {
      throw new Error("Need data");
    }

    const data = await deleteRote(rote);
    await deleteAttachments(rote.id);

    res.send({
      code: 0,
      msg: "ok",
      data,
    });
  })
);

routerV1.post(
  "/upload",
  isAuthenticated,
  asyncHandler(async (req, res) => {
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

    const [fields, files] = await form.parse(req);
    if (!files.images) {
      throw new Error("No images uploaded");
    }

    const imageFiles = Array.isArray(files.images)
      ? files.images
      : [files.images];

    const uploadResults: UploadResult[] = [];
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
  })
);

routerV1.post(
  "/login/password",
  asyncHandler(async (req, res, next) => {
    passport.authenticate("local", (err: any, user: User, data: any) => {
      if (err || !user) {
        throw new Error(data || "Authentication failed");
      }

      req.logIn(user, (err) => {
        if (err) {
          throw new Error("Login failed");
        }
        res.send({
          code: 0,
          msg: "ok",
          data: sanitizeUserData(user),
        });
      });
    })(req, res, next);
  })
);

routerV1.post(
  "/logout",
  isAuthenticated,
  asyncHandler(async (req, res) => {
    await new Promise<void>((resolve, reject) => {
      req.logout((err) => {
        if (err) reject(err);
        resolve();
      });
    });

    res.send({
      code: 0,
      msg: "ok",
      data: null,
    });
  })
);

routerV1.get(
  "/profile",
  isAuthenticated,
  asyncHandler(async (req, res) => {
    res.send({
      code: 0,
      msg: "ok",
      data: req.user as User,
    });
  })
);

routerV1.post(
  "/profile",
  isAuthenticated,
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    const data = await editMyProfile(user.id, req.body);

    res.send({
      code: 0,
      msg: "ok",
      data,
    });
  })
);

routerV1.get(
  "/getsession",
  isAuthenticated,
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    if (!user.id) {
      throw new Error("Need userid");
    }

    const data = await getMySession(user.id);
    res.send({
      code: 0,
      msg: "ok",
      data,
    });
  })
);

routerV1.get(
  "/openkey/generate",
  isAuthenticated,
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    if (!user.id) {
      throw new Error("Need userid");
    }

    const data = await generateOpenKey(user.id);
    res.send({
      code: 0,
      msg: "ok",
      data,
    });
  })
);

routerV1.get(
  "/openkey",
  isAuthenticated,
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    if (!user.id) {
      throw new Error("Need userid");
    }

    const data = await getMyOpenKey(user.id);
    res.send({
      code: 0,
      msg: "ok",
      data,
    });
  })
);

routerV1.delete(
  "/openkey",
  isAuthenticated,
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    const { id } = req.body;

    if (!user.id) {
      throw new Error("Need userid");
    }

    if (!id || id.length !== 24) {
      throw new Error("Data error");
    }

    const data = await deleteMyOneOpenKey(user.id, id);
    res.send({
      code: 0,
      msg: "ok",
      data,
    });
  })
);

routerV1.post(
  "/openkey",
  isAuthenticated,
  bodyTypeCheck,
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    const { id, permissions } = req.body;

    if (!user.id) {
      throw new Error("Need userid");
    }

    if (!id || !permissions) {
      throw new Error("Data error");
    }

    const data = await editMyOneOpenKey(user.id, id, permissions);
    res.send({
      code: 0,
      msg: "ok",
      data,
    });
  })
);

routerV1.post(
  "/getMyHeatmap",
  isAuthenticated,
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      throw new Error("Need startDate and endDate");
    }

    const data = await getHeatMap(user.id, startDate, endDate);
    res.send({
      code: 0,
      msg: "ok",
      data,
    });
  })
);

routerV1.get(
  "/sitemapData",
  asyncHandler(async (req, res) => {
    const data = await getSiteMapData();
    res.send({
      code: 0,
      msg: "ok",
      data,
    });
  })
);

routerV1.get(
  "/status",
  asyncHandler(async (req, res) => {
    await getStatus();
    res.send({
      code: 0,
      msg: "ok",
      data: {},
    });
  })
);

routerV1.get(
  "/randomRote",
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    let rote;

    if (user) {
      rote = await findMyRandomRote(user.id);
    } else {
      rote = await findRandomPublicRote();
    }

    res.send({
      code: 0,
      msg: "ok",
      data: rote,
    });
  })
);

routerV1.get(
  "/exportData",
  isAuthenticated,
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    const data = await exportData(user.id);

    const jsonData = JSON.stringify(data);

    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${user.username}-${moment().format(
        "YYYY/MM/DD HH:mm:ss"
      )}.json`
    );

    res.send(jsonData);
  })
);

routerV1.get(
  "/statistics",
  isAuthenticated,
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    const data = await statistics(user.id);

    res.send({
      code: 0,
      msg: "ok",
      data: data,
    });
  })
);

routerV1.post(
  "/change/password",
  isAuthenticated,
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    const { newpassword, oldpassword } = req.body;

    const zodData = passwordChangeZod.safeParse(req.body);
    if (zodData.success === false) {
      throw new Error(zodData.error.errors[0].message);
    }

    const updatedUser = await changeUserPassword(
      oldpassword,
      newpassword,
      user.id
    );
    res.send({
      code: 0,
      msg: "ok",
      data: updatedUser,
    });
  })
);

routerV1.use("/openKey", useOpenKey);

routerV1.use(errorHandler);

export default routerV1;
