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
// Custom authentication middleware
export function isAuthenticated(req: any, res: any, next: any) {
  if (req.isAuthenticated()) {
    next();
  } else {
    const error = new Error("Unauthenticated");
    error.name = "AuthenticationError";
    next(error);
  }
}

// Custom admin authentication middleware
export function isAdmin(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    const error = new Error("Unauthenticated");
    error.name = "AuthenticationError";
    return next(error);
  }

  const user = req.user as User;
  if (user.username !== "rabithua") {
    const error = new Error("Unauthenticated: Not admin");
    error.name = "AuthorizationError";
    return next(error);
  }
  next();
}

// Custom author authentication middleware
export function isAuthor(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    const error = new Error("Unauthenticated");
    error.name = "AuthenticationError";
    return next(error);
  }

  const user = req.user as User;
  if (!req.body.authorid) {
    const error = new Error("Need data");
    error.name = "ValidationError";
    return next(error);
  }

  if (user.id !== req.body.authorid) {
    const error = new Error("Unauthenticated: Not author");
    error.name = "AuthorizationError";
    return next(error);
  }
  next();
}

// Check if Prisma connection is successful
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

// Request body data validation
export function bodyTypeCheck(req: any, res: any, next: any) {
  const { type, state, editor, permissions } = req.body;

  if (state && !stateType.includes(state.toString())) {
    const error = new Error("State wrong!");
    error.name = "ValidationError";
    return next(error);
  }

  if (permissions && !Array.isArray(permissions)) {
    const error = new Error("Permissions wrong!");
    error.name = "ValidationError";
    return next(error);
  }

  if (type && !roteType.includes(type.toString())) {
    const error = new Error("Type wrong!");
    error.name = "ValidationError";
    return next(error);
  }

  if (editor && !editorType.includes(editor.toString())) {
    const error = new Error("Editor wrong!");
    error.name = "ValidationError";
    return next(error);
  }

  next();
}

// Query parameters validation
export function queryTypeCheck(req: any, res: any, next: any) {
  const { type, state, editor } = req.query;

  if (state && !stateType.includes(state.toString())) {
    const error = new Error("State wrong!");
    error.name = "ValidationError";
    return next(error);
  }

  if (type && !roteType.includes(type.toString())) {
    const error = new Error("Type wrong!");
    error.name = "ValidationError";
    return next(error);
  }

  if (editor && !editorType.includes(editor.toString())) {
    const error = new Error("Editor wrong!");
    error.name = "ValidationError";
    return next(error);
  }

  next();
}

// OpenKey permission validation middleware
export function isOpenKeyOk(req: any, res: any, next: any) {
  const { openkey } = req.body;

  if (!openkey) {
    const error = new Error("Need openkey and content!");
    error.name = "ValidationError";
    return next(error);
  }

  getOneOpenKey(openkey.toString())
    .then(async (e) => {
      req.openKey = e;
      next();
    })
    .catch(async (e) => {
      const error = new Error(e);
      error.name = "ValidationError";
      next(error);
    });
}
