import { PrismaClient, User } from "@prisma/client";

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
        console.error("Failed to connect to Prisma:", error);
      })
      .finally(() => {
        prisma.$disconnect();
      });
  } catch (error) {
    console.error("Failed to connect to Prisma database:", error);
  }
}
