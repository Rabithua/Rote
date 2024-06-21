import { PrismaClient, User } from "@prisma/client";

import mainJson from "../json/main.json";
import { getOneOpenKey } from "./dbMethods";

const { stateType, roteType, editorType } = mainJson;

export function sanitizeUserData(user: User) {
  delete (user as { passwordhash?: Buffer }).passwordhash;
  delete (user as { salt?: Buffer }).salt;
  return user;
}

export function sanitizeOtherUserData(user: User) {
  delete (user as { passwordhash?: Buffer }).passwordhash;
  delete (user as { salt?: Buffer }).salt;
  delete (user as { email?: string }).email;
  delete (user as { createdAt?: any }).createdAt;
  delete (user as { updatedAt?: any }).updatedAt;
  return user;
}
// 自定义身份验证中间件
export function isAuthenticated(req: any, res: any, next: any) {
  if (req.isAuthenticated()) {
    next();
  } else {
    res.status(401).send({
      code: 1,
      msg: "Unauthenticated",
      data: null,
    });
  }
}

// 自定义身份验证中间件
export function isAdmin(req: any, res: any, next: any) {
  if (req.isAuthenticated()) {
    const user = req.user as User;
    if (user.username !== "rabithua") {
      res.status(401).send({
        code: 1,
        msg: "Unauthenticated: Not admin",
        data: null,
      });
      return;
    }
    next();
  } else {
    res.status(401).send({
      code: 1,
      msg: "Unauthenticated",
      data: null,
    });
  }
}

// 自定义身份验证中间件
export function isAuthor(req: any, res: any, next: any) {
  if (req.isAuthenticated()) {
    const user = req.user as User;
    if (!req.body.authorid) {
      res.status(401).send({
        code: 1,
        msg: "Need data",
        data: null,
      });
      return;
    }
    if (user.id !== req.body.authorid) {
      res.status(401).send({
        code: 1,
        msg: "Unauthenticated: Not author",
        data: null,
      });
      return;
    }
    next();
  } else {
    res.status(401).send({
      code: 1,
      msg: "Unauthenticated",
      data: null,
    });
  }
}

// 检查prisma是否连接成功
export async function checkPrisma(prisma: PrismaClient) {
  try {
    prisma.rote
      .findFirst()
      .then(() => {
        console.log("Prisma connected successfully!");
      })
      .catch((error) => {
        console.error("Failed to connect to Prisma.", error);
      })
      .finally(() => {
        prisma.$disconnect();
      });
  } catch (error) {
    console.error("Failed to connect to Prisma database.");
  }
}

// body数据格式校验
export function bodyTypeCheck(req: any, res: any, next: any) {
  const { type, state, editor, permissions } = req.body;

  if (state && !stateType.includes(state.toString())) {
    res.status(401).send({
      code: 1,
      msg: "error",
      data: "State wrong!",
    });
    return;
  }

  if (permissions && !Array.isArray(permissions)) {
    res.status(401).send({
      code: 1,
      msg: "error",
      data: "Permissions wrong!",
    });
    return;
  }

  if (type && !roteType.includes(type.toString())) {
    res.status(401).send({
      code: 1,
      msg: "error",
      data: "Type wrong!",
    });
    return;
  }

  if (editor && !editorType.includes(editor.toString())) {
    res.status(401).send({
      code: 1,
      msg: "error",
      data: "Editor wrong!",
    });
    return;
  }

  next();
}

// query数据格式校验
export function queryTypeCheck(req: any, res: any, next: any) {
  const { type, state, editor } = req.query;

  if (state && !stateType.includes(state.toString())) {
    res.status(401).send({
      code: 1,
      msg: "error",
      data: "State wrong!",
    });
    return;
  }

  if (type && !roteType.includes(type.toString())) {
    res.status(401).send({
      code: 1,
      msg: "error",
      data: "Type wrong!",
    });
    return;
  }

  if (editor && !editorType.includes(editor.toString())) {
    res.status(401).send({
      code: 1,
      msg: "error",
      data: "Editor wrong!",
    });
    return;
  }

  next();
}

// OpenKey权限检测中间件
export function isOpenKeyOk(req: any, res: any, next: any) {
  const { openkey } = req.body;

  if (!openkey) {
    res.status(401).send({
      code: 1,
      msg: "error",
      data: "Need openkey and content!",
    });
    return;
  }

  getOneOpenKey(openkey.toString())
    .then(async (e) => {
      req.openKey = e;
      next();
    })
    .catch(async (e) => {
      res.status(401).send({
        code: 1,
        msg: "error",
        data: e,
      });
    });
}
