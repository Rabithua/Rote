import { PrismaClient } from "@prisma/client";
import prisma from "./utils/prisma";
var crypto = require("crypto");


export async function allUser() {
  try {
    await prisma.$connect();
    const users = await prisma.user.findMany();
    return users;
  } catch (error: any) {
    throw new Error(error)
  }
}

export async function oneUser(id: string) {
  try {
    await prisma.$connect();
    const user = await prisma.user.findUnique({
      where: {
        id
      }
    });
    return user;
  } catch (error) {
    console.error("Error find user by id:", error);
    return;
  }
}

export async function createUser(data: {
  username: string;
  email: string;
  password: string;
  nickname?: string;
}) {
  try {
    // hash 加密
    let salt = crypto.randomBytes(16);
    let passwordhash = crypto.pbkdf2Sync(
      data.password,
      salt,
      310000,
      32,
      "sha256"
    );
    console.log(passwordhash, typeof passwordhash);

    const user = await prisma.user.create({
      data: {
        username: data.username,
        email: data.email,
        nickname: data.nickname,
        passwordhash,
        salt,
      },
    });
    return user;
  } catch (error: any) {
    return error
  }
}

export async function addSubScriptionToUser(userId: string, subScription: any): Promise<any> {
  return new Promise((resolve, reject) => {
    prisma.userSwSubScription.create({
      data: {
        userid: userId,
        endpoint: subScription.endpoint,
        expirationTime: subScription.expirationTime,
        keys: {
          auth: subScription.keys.auth,
          p256dh: subScription.keys.p256dh,
        },
      },
    })
      .then((subScriptionRespon) => {
        console.log("订阅信息已成功添加到用户数组:", subScriptionRespon);
        resolve(subScriptionRespon);
      })
      .catch((error) => {
        console.log("添加订阅信息时出错:", error);
        reject(error);
      });
  });
}

export async function findSubScriptionToUser(subId: string) {
  try {
    // 查找订阅信息
    const swSubScription = await prisma.userSwSubScription.findUnique({
      where: {
        id: subId,
      },
    });

    if (swSubScription) {
      return swSubScription;
    } else {
      console.log("未找到订阅信息");
      return;
    }
  } catch (error) {
    console.log("查询订阅信息时出错:", error);
    return;
  }
}

export async function passportCheckUser(data: { username: string }) {
  try {
    const user = await prisma.user.findFirst({
      where: {
        username: data.username,
      },
    });
    return {
      err: null,
      user: user,
    };
  } catch (error) {
    console.error("Error creating rote:", error);
    return {
      err: error,
      user: null,
    };
  }
}

export async function createRote(data: {
  title: string;
  content: string;
  authorid: string;
}): Promise<any> {
  return new Promise((resolve, reject) => {
    prisma.rote.create({ data })
      .then((rote) => {
        resolve(rote);
      })
      .catch((error) => {
        console.error("Error creating rote:", error);
        reject(error);
      });
  });
}

export async function findRoteById(id: string): Promise<any> {
  return new Promise((resolve, reject) => {
    prisma.rote.findUnique({
      where: {
        id,
      },
    })
      .then((rote) => {
        resolve(rote);
      })
      .catch((error) => {
        console.error("Error finding rote:", error);
        reject(error);
      });
  });
}
