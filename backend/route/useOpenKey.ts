import express from "express";
import { isOpenKeyOk, queryTypeCheck } from "../utils/main";
import { getOneOpenKey, createRote } from "../utils/dbMethods";
import { asyncHandler } from "../utils/handlers";

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

useOpenKey.get(
  "/onerote",
  isOpenKeyOk,
  queryTypeCheck,
  asyncHandler(async (req, res) => {
    const { content, state, type, tag, pin } = req.query;

    if (!content) {
      throw new Error("Need openkey and content!");
    }

    if (!req.openKey?.permissions.includes("SENDROTE")) {
      throw new Error("OpenKey permission unmatch!");
    }

    const rote = {
      content,
      state: state || "private",
      type: type || "rote",
      tags: Array.isArray(tag) ? tag : tag ? [tag] : [],
      pin: !!pin,
    };

    const result = await createRote({
      ...rote,
      authorid: req.openKey.userid,
    });

    res.send({
      code: 0,
      msg: "ok",
      data: result,
    });
  })
);

useOpenKey.post(
  "/onerote",
  isOpenKeyOk,
  queryTypeCheck,
  asyncHandler(async (req, res) => {
    const { content, state, type, tags, pin } = req.body;

    if (!content) {
      throw new Error("Need openkey and content!");
    }

    if (!req.openKey?.permissions.includes("SENDROTE")) {
      throw new Error("OpenKey permission unmatch!");
    }

    const rote = {
      content,
      state: state || "private",
      type: type || "rote",
      tags: Array.isArray(tags) ? tags : tags ? tags.split(" ") : [],
      pin: !!pin,
    };

    const result = await createRote({
      ...rote,
      authorid: req.openKey.userid,
    });

    res.send({
      code: 0,
      msg: "ok",
      data: result,
    });
  })
);

export default useOpenKey;
