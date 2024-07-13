import prisma from "./prisma";
var crypto = require("crypto");

export async function allUser() {
  try {
    await prisma.$connect();
    const users = await prisma.user.findMany();
    return users;
  } catch (error: any) {
    throw new Error(error);
  }
}

export async function oneUser(id: string) {
  try {
    await prisma.$connect();
    const user = await prisma.user.findUnique({
      where: {
        id,
      },
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
    return error;
  }
}

export async function addSubScriptionToUser(
  userId: string,
  subScription: any
): Promise<any> {
  return new Promise((resolve, reject) => {
    prisma.userSwSubScription
      .create({
        data: {
          userid: userId,
          endpoint: subScription.endpoint,
          expirationTime: subScription.expirationTime,
          keys: {
            auth: subScription.keys.auth,
            p256dh: subScription.keys.p256dh,
          },
        },
        select: {
          id: true,
        },
      })
      .then((subScriptionRespon) => {
        console.log("订阅信息已成功添加到用户数组:", subScriptionRespon);
        resolve(subScriptionRespon);
      })
      .catch((error) => {
        // console.log("添加订阅信息时出错:", error);
        reject(error);
      });
  });
}

export async function findSubScriptionToUser(subId: string) {
  return new Promise((resolve, reject) => {
    // 查找订阅信息
    prisma.userSwSubScription
      .findUnique({
        where: {
          id: subId,
        },
      })
      .then((res) => {
        resolve(res);
      })
      .catch((err) => {
        reject(err);
      });
  });
}

export async function findSubScriptionToUserByendpoint(endpoint: string) {
  return new Promise((resolve, reject) => {
    // 查找订阅信息
    prisma.userSwSubScription
      .findUnique({
        where: {
          endpoint: endpoint,
        },
        select: {
          id: true,
        },
      })
      .then((res) => {
        resolve(res);
      })
      .catch((err) => {
        reject(err);
      });
  });
}

export async function deleteSubScription(subId: string) {
  return new Promise((resolve, reject) => {
    try {
      prisma.userSwSubScription
        .delete({
          where: {
            id: subId,
          },
        })
        .then((res) => {
          resolve(res);
        })
        .catch((err) => {
          reject(err);
        });
    } catch (error) {
      reject(error);
    }
  });
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

export async function createRote(data: any): Promise<any> {
  return new Promise((resolve, reject) => {
    prisma.rote
      .create({
        data,
        include: {
          author: {
            select: {
              username: true,
              nickname: true,
              avatar: true,
            },
          },
          attachments: true,
          userreaction: true,
          visitorreaction: true,
        },
      })
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
    prisma.rote
      .findFirst({
        where: {
          id,
        },
        include: {
          author: {
            select: {
              username: true,
              nickname: true,
              avatar: true,
            },
          },
          attachments: true,
          userreaction: true,
          visitorreaction: true,
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

export async function editRote(data: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const { id, authorid, ...dataClean } = data;
    prisma.rote
      .update({
        where: {
          id: data.id,
          authorid: data.authorid,
        },
        data: dataClean,
        include: {
          author: {
            select: {
              username: true,
              nickname: true,
              avatar: true,
            },
          },
          attachments: true,
          userreaction: true,
          visitorreaction: true,
        },
      })
      .then((rote) => {
        resolve(rote);
      })
      .catch((error) => {
        console.error("Error update rote:", error);
        reject(error);
      });
  });
}

export async function deleteRote(data: any): Promise<any> {
  return new Promise((resolve, reject) => {
    prisma.rote
      .delete({
        where: {
          id: data.id,
          authorid: data.authorid,
        },
      })
      .then((rote) => {
        resolve(rote);
      })
      .catch((error) => {
        console.error("Error delete rote:", error);
        reject(error);
      });
  });
}

export async function deleteAttachments(roteid: string): Promise<any> {
  return new Promise((resolve, reject) => {
    console.log("开始删除附件", roteid);
    prisma.attachment
      .deleteMany({
        where: {
          roteid,
        },
      })
      .then((data) => {
        console.log(data);
        resolve(data);
      })
      .catch((error) => {
        console.error("Error delete attachments:", error);
        reject(error);
      });
  });
}

export async function findMyRote(
  authorid: string,
  skip: number | undefined,
  limit: number | undefined,
  filter: any,
  archived: any
): Promise<any> {
  return new Promise((resolve, reject) => {
    console.log(`filter: ${JSON.stringify(filter)}`);
    // 修改代码跳过skip个数据，再拉取limit个数据返回
    prisma.rote
      .findMany({
        where: {
          AND: [
            {
              authorid,
              // 筛选state不是archived的内容
              archived,
            },
            { ...filter },
          ],
        },
        skip: skip ? skip : 0,
        take: limit ? limit : 20,
        orderBy: [
          {
            pin: "desc", // 根据 pin 字段从最大的开始获取
          },
          {
            createdAt: "desc", // 根据 updatedAt 字段从最新的开始获取
          },
        ],
        include: {
          author: {
            select: {
              username: true,
              nickname: true,
              avatar: true,
            },
          },
          attachments: true,
          userreaction: true,
          visitorreaction: true,
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

export async function findUserPublicRote(
  userid: string,
  skip: number | undefined,
  limit: number | undefined,
  filter: any,
  archived: any
): Promise<any> {
  return new Promise((resolve, reject) => {
    console.log(`filter: ${JSON.stringify(filter)}`);
    // 修改代码跳过skip个数据，再拉取limit个数据返回
    prisma.rote
      .findMany({
        where: {
          AND: [
            {
              authorid: userid,
              // 筛选state不是archived的内容
              archived,
              state: "public",
            },
            { ...filter },
          ],
        },
        skip: skip ? skip : 0,
        take: limit ? limit : 20,
        orderBy: [
          {
            pin: "desc", // 根据 pin 字段从最大的开始获取
          },
          {
            createdAt: "desc", // 根据 updatedAt 字段从最新的开始获取
          },
        ],
        include: {
          author: {
            select: {
              username: true,
              nickname: true,
              avatar: true,
            },
          },
          attachments: true,
          userreaction: true,
          visitorreaction: true,
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

export async function findPublicRote(
  skip: number | undefined,
  limit: number | undefined,
  filter: any
): Promise<any> {
  return new Promise((resolve, reject) => {
    console.log(`filter: ${JSON.stringify(filter)}`);
    // 修改代码跳过skip个数据，再拉取limit个数据返回
    prisma.rote
      .findMany({
        where: {
          AND: [
            {
              state: "public",
            },
            { ...filter },
          ],
        },
        skip: skip ? skip : 0,
        take: limit ? limit : 20,
        orderBy: [
          {
            createdAt: "desc", // 根据 updatedAt 字段从最新的开始获取
          },
        ],
        include: {
          author: {
            select: {
              username: true,
              nickname: true,
              avatar: true,
            },
          },
          attachments: true,
          userreaction: true,
          visitorreaction: true,
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

export async function getMyTags(userid: any): Promise<any> {
  console.log(userid);
  return new Promise((resolve, reject) => {
    prisma.rote
      .findMany({
        where: {
          authorid: userid,
        },
        select: {
          tags: true,
        },
      })
      .then((res) => {
        console.log(`所有标签: ${JSON.stringify(res)}`);
        const allTags = Array.from(new Set(res.flatMap((item) => item.tags)));
        resolve(allTags);
      })
      .catch((error) => {
        console.error("Error getting tags:", error);
        reject(error);
      });
  });
}

export async function getMySession(userid: any): Promise<any> {
  console.log(userid);
  return new Promise((resolve, reject) => {
    prisma.session
      .findMany({
        where: {
          data: {
            contains: userid,
          },
        },
      })
      .then((res) => {
        resolve(res);
      })
      .catch((error) => {
        console.error("Error getting sessions:", error);
        reject(error);
      });
  });
}

export async function generateOpenKey(userid: any): Promise<any> {
  console.log(userid);
  return new Promise((resolve, reject) => {
    prisma.userOpenKey
      .create({
        data: {
          permissions: ["SENDROTE"],
          userid,
        },
      })
      .then((res) => {
        resolve(res);
      })
      .catch((error) => {
        console.error("Error generate openkey:", error);
        reject(error);
      });
  });
}

export async function getMyOpenKey(userid: any): Promise<any> {
  console.log(userid);
  return new Promise((resolve, reject) => {
    prisma.userOpenKey
      .findMany({
        where: {
          userid,
        },
      })
      .then((res) => {
        resolve(res);
      })
      .catch((error) => {
        console.error("Error generate openkey:", error);
        reject(error);
      });
  });
}

export async function deleteMyOneOpenKey(userid: any, id: any): Promise<any> {
  console.log(userid, id);
  return new Promise((resolve, reject) => {
    prisma.userOpenKey
      .findUnique({
        where: {
          id,
        },
      })
      .then((res) => {
        if (!res) {
          reject();
        } else {
          if (res.userid !== userid) {
            reject();
          }

          prisma.userOpenKey
            .delete({
              where: {
                id,
              },
            })
            .then((res) => {
              resolve(res);
            })
            .catch(() => {
              reject();
            });
        }
      })
      .catch((error) => {
        console.error("Error generate openkey:", error);
        reject(error);
      });
  });
}

export async function editMyOneOpenKey(
  userid: any,
  id: string,
  permissions: string[]
): Promise<any> {
  console.log(userid, id);
  return new Promise((resolve, reject) => {
    prisma.userOpenKey
      .findUnique({
        where: {
          id,
        },
      })
      .then((res) => {
        if (!res) {
          reject("OpenKey not found!");
        } else {
          if (res.userid !== userid) {
            reject("OpenKey user not match!");
          }

          prisma.userOpenKey
            .update({
              where: {
                id,
              },
              data: {
                permissions,
              },
            })
            .then((res) => {
              resolve(res);
            })
            .catch(() => {
              reject();
            });
        }
      })
      .catch((error) => {
        console.error("Error generate openkey:", error);
        reject(error);
      });
  });
}

export async function getOneOpenKey(id: string): Promise<any> {
  return new Promise((resolve, reject) => {
    prisma.userOpenKey
      .findUnique({
        where: {
          id,
        },
      })
      .then((res) => {
        if (!res) {
          reject("OpenKey not found!");
        } else {
          resolve(res);
        }
      })
      .catch((error) => {
        console.error("Error generate openkey:", error);
        reject(error);
      });
  });
}

export async function createAttachments(
  userid: any,
  roteid: any,
  data: any
): Promise<any> {
  console.log(userid);
  const attachments = data.map((e: any) => {
    return {
      userid,
      roteid,
      url: e.location,
      details: e,
      storage: "R2",
    };
  });
  return new Promise(async (resolve, reject) => {
    try {
      const attachments_new = await prisma.$transaction(
        attachments.map((attachment: any) =>
          prisma.attachment.create({
            data: attachment,
          })
        )
      );
      resolve(attachments_new);
    } catch (error) {
      console.error("Error create attachment:", error);
      reject(error);
    }
  });
}

export async function editMyProfile(userid: any, data: any): Promise<any> {
  console.log(userid);
  return new Promise((resolve, reject) => {
    prisma.user
      .update({
        where: {
          id: userid,
        },
        data: {
          avatar: data.avatar || undefined,
          nickname: data.nickname || undefined,
          description: data.description || undefined,
          cover: data.cover || undefined,
        },
      })
      .then((res) => {
        resolve(res);
      })
      .catch(() => {
        reject();
      });
  });
}

export async function getUserInfoByUsername(username: string): Promise<any> {
  return new Promise((resolve, reject) => {
    prisma.user
      .findUnique({
        where: {
          username,
        },
        select: {
          id: true,
          avatar: true,
          cover: true,
          nickname: true,
          username: true,
          createdAt: true,
          description: true,
        },
      })
      .then((res) => {
        console.log(res);
        if (res) {
          resolve(res);
        } else {
          reject("User not found");
        }
      })
      .catch((error) => {
        console.error("Error finding rote:", error);
        reject(error);
      });
  });
}

export async function getHeatMap(
  userId: string,
  startDate: string,
  endDate: string
): Promise<any> {
  return new Promise((resolve, reject) => {
    prisma.rote
      .findMany({
        where: {
          authorid: userId,
          createdAt: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        },
      })
      .then((res) => {
        // 将结果转换为所需的格式
        const result = res.reduce((acc: any, item: any) => {
          const date = item.createdAt.toISOString().split("T")[0];
          acc[date] = (acc[date] || 0) + 1;
          return acc;
        }, {});
        resolve(result);
      })
      .catch((error) => {
        console.error("Error generate openkey:", error);
        reject(error);
      });
  });
}

export async function getSiteMapData(): Promise<any> {
  return new Promise((resolve, reject) => {
    prisma.user
      .findMany({
        where: {},
        select: {
          username: true,
          nickname: true,
        },
      })
      .then((res) => {
        resolve(res);
      })
      .catch((error) => {
        console.error("Error prisma method:", error);
        reject(error);
      });
  });
}

export async function getStatus(): Promise<any> {
  return new Promise((resolve, reject) => {
    prisma.rote
      .findFirst({
        where: {},
      })
      .then((res) => {
        resolve(true);
      })
      .catch((error) => {
        console.error("Error prisma method:", error);
        reject(error);
      });
  });
}

export async function findMyRandomRote(authorid: string): Promise<any> {
  return new Promise(async (resolve, reject) => {
    let allCount = await prisma.rote.count({ where: { authorid } });
    let random = Math.floor(Math.random() * allCount);
    prisma.rote
      .findFirst({
        where: {
          authorid,
        },
        skip: random,
        include: {
          author: {
            select: {
              username: true,
              nickname: true,
              avatar: true,
            },
          },
          attachments: true,
          userreaction: true,
          visitorreaction: true,
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

export async function findRandomPublicRote(): Promise<any> {
  return new Promise(async (resolve, reject) => {
    let allCount = await prisma.rote.count({ where: { state: "public" } });
    let random = Math.floor(Math.random() * allCount);
    prisma.rote
      .findFirst({
        where: {
          state: "public",
        },
        skip: random,
        include: {
          author: {
            select: {
              username: true,
              nickname: true,
              avatar: true,
            },
          },
          attachments: true,
          userreaction: true,
          visitorreaction: true,
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

export async function changeUserPassword(
  oldpassword: string,
  newpassword: string,
  id: string
): Promise<any> {
  try {
    const user = await prisma.user.findFirst({
      where: {
        id: id,
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const passwordhash = user.passwordhash;
    const salt = user.salt;

    // 使用异步版本的pbkdf2
    const oldpasswordhash = crypto.pbkdf2Sync(
      oldpassword,
      salt,
      310000,
      32,
      "sha256"
    );

    if (oldpasswordhash.toString("hex") === passwordhash.toString("hex")) {
      const newSalt = crypto.randomBytes(16);
      const newpasswordhash = crypto.pbkdf2Sync(
        newpassword,
        newSalt,
        310000,
        32,
        "sha256"
      );

      const userUpdate = await prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          passwordhash: newpasswordhash,
          salt: newSalt, // 使用新盐值
        },
      });

      return userUpdate;
    } else {
      throw new Error("Password not match");
    }
  } catch (error) {
    throw error; // 直接抛出错误，让调用者处理
  }
}

export async function ccccc(id: any, newpassword: string): Promise<any> {
  return new Promise(async (resolve, reject) => {
    const newSalt = crypto.randomBytes(16);
    const newpasswordhash = crypto.pbkdf2Sync(
      newpassword,
      newSalt,
      310000,
      32,
      "sha256"
    );

    const userUpdate = await prisma.user.update({
      where: {
        id,
      },
      data: {
        passwordhash: newpasswordhash,
        salt: newSalt, // 使用新盐值
      },
    });

    resolve(userUpdate);
  });
}

export async function statistics(authorid: string): Promise<any> {
  return new Promise(async (resolve, reject) => {
    let noteCount = await prisma.rote.count({ where: { authorid } });
    let attachments = await prisma.attachment.findMany({
      where: { userid: authorid },
    });

    resolve({
      noteCount,
      attachmentsCount: attachments.length,
    });
  });
}

export async function exportData(authorid: string): Promise<any> {
  return new Promise(async (resolve, reject) => {
    let notes = await prisma.rote.findMany({
      where: { authorid },
      include: {
        author: {
          select: {
            username: true,
            nickname: true,
            avatar: true,
          },
        },
        attachments: true,
        userreaction: true,
        visitorreaction: true,
      },
    });
    resolve({
      notes,
    });
  });
}
