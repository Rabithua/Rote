/**
 * OpenKey API
 */

import express from "express";
import { isOpenKeyOk, queryTypeCheck } from "../utils/main";
import { getOneOpenKey, createRote, findMyRote } from "../utils/dbMethods";
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

// send rote using openkey: GET
useOpenKey.get(
  "/onerote",
  isOpenKeyOk,
  queryTypeCheck,
  asyncHandler(async (req, res) => {
    const { content, state, type, tag, pin } = req.query;

    if (!content) {
      throw new Error("Need content!");
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

// send rote using openkey: POST
useOpenKey.post(
  "/onerote",
  isOpenKeyOk,
  queryTypeCheck,
  asyncHandler(async (req, res) => {
    const { content, state, type, tags, pin } = req.body;

    if (!content) {
      throw new Error("Need content!");
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

// get rote using openkey: GET
useOpenKey.get(
  "/myrote",
  isOpenKeyOk,
  asyncHandler(async (req, res) => {
    const { skip, limit, archived } = req.query;
    const filter = req.body.filter || {};

    if (!req.openKey?.permissions.includes("GETROTE")) {
      throw new Error("OpenKey permission unmatch!");
    }

    const parsedSkip = typeof skip === "string" ? parseInt(skip) : undefined;
    const parsedLimit = typeof limit === "string" ? parseInt(limit) : undefined;

    const rote = await findMyRote(
      req.openKey.userid,
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

export default useOpenKey;
