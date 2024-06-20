import express from "express";
import { isOpenKeyOk, queryTypeCheck } from "../utils/main";
import { getOneOpenKey, createRote } from "../utils/dbMethods";

declare module "express-serve-static-core" {
  interface Request {
    openKey?: {
      id: string;
      userid: string;
      permissions: string[];
      createdAt: Date;
      updatedAt: Date;
    } | null;
  }
}

let useOpenKey = express.Router();

useOpenKey.get("/onerote", isOpenKeyOk, queryTypeCheck, (req, res) => {
  const { content, state, type, tag, pin } = req.query;

  if (!content) {
    res.send({
      code: 1,
      msg: "error",
      data: "Need openkey and content!",
    });
    return;
  }

  const rote = {
    content,
    state: state || "private",
    type: type || "rote",
    tags: Array.isArray(tag) ? tag : tag ? [tag] : [],
    pin: !!pin,
  };

  if (!req.openKey?.permissions.includes("SENDROTE")) {
    res.send({
      code: 1,
      msg: "error",
      data: "OpenKey permission unmatch!",
    });
    return;
  }

  createRote({
    ...rote,
    authorid: req.openKey.userid,
  })
    .then(async (rote) => {
      res.send({
        code: 0,
        msg: "ok",
        data: rote,
      });
    })
    .catch(async (e) => {
      res.send({
        code: 1,
        msg: "error",
        data: e,
      });
    });
});

useOpenKey.post("/onerote", isOpenKeyOk, queryTypeCheck, (req, res) => {
  const { content, state, type, tags, pin } = req.query;

  if (!content) {
    res.send({
      code: 1,
      msg: "error",
      data: "Need openkey and content!",
    });
    return;
  }

  const rote = {
    content,
    state: state || "private",
    type: type || "rote",
    tags: tags || [],
    pin: !!pin,
  };

  if (!req.openKey?.permissions.includes("SENDROTE")) {
    res.send({
      code: 1,
      msg: "error",
      data: "OpenKey permission unmatch!",
    });
    return;
  }

  createRote({
    ...rote,
    authorid: req.openKey.userid,
  })
    .then(async (rote) => {
      res.send({
        code: 0,
        msg: "ok",
        data: rote,
      });
    })
    .catch(async (e) => {
      res.send({
        code: 1,
        msg: "error",
        data: e,
      });
    });
});

export default useOpenKey;
