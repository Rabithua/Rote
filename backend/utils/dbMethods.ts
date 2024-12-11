import { UploadResult } from "../types/main";
import prisma from "./prisma";
import crypto from "crypto";

// Define unified error type
class DatabaseError extends Error {
  constructor(message: string, public originalError?: any) {
    super(message);
    this.name = "DatabaseError";
  }
}

export async function allUser() {
  try {
    const users = await prisma.user.findMany();
    return users;
  } catch (error: any) {
    throw new DatabaseError("Failed to get all users", error);
  }
}

export async function oneUser(id: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
    });
    return user;
  } catch (error) {
    throw new DatabaseError(`Failed to find user by id: ${id}`, error);
  }
}

export async function createUser(data: {
  username: string;
  email: string;
  password: string;
  nickname?: string;
}) {
  try {
    let salt = crypto.randomBytes(16);
    let passwordhash = crypto.pbkdf2Sync(
      data.password,
      salt,
      310000,
      32,
      "sha256"
    );

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
    throw new DatabaseError("Failed to create user", error);
  }
}

export async function addSubScriptionToUser(
  userId: string,
  subScription: any
): Promise<any> {
  try {
    const subScriptionRespon = await prisma.userSwSubScription.create({
      data: {
        userid: userId,
        endpoint: subScription.endpoint,
        expirationTime: subScription.expirationTime,
        keys: {
          auth: subScription.keys.auth,
          p256dh: subScription.keys.p256dh,
        },
      },
      select: { id: true },
    });
    return subScriptionRespon;
  } catch (error) {
    throw new DatabaseError("Failed to add subscription", error);
  }
}

export async function findSubScriptionToUser(subId: string): Promise<any> {
  try {
    const subscription = await prisma.userSwSubScription.findUnique({
      where: { id: subId },
    });

    if (!subscription) {
      throw new DatabaseError("Subscription not found");
    }

    return subscription;
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new DatabaseError(`Failed to find subscription: ${subId}`, error);
  }
}

export async function findSubScriptionToUserByendpoint(
  endpoint: string
): Promise<any> {
  try {
    const subscription = await prisma.userSwSubScription.findUnique({
      where: { endpoint },
      select: { id: true },
    });
    return subscription;
  } catch (error) {
    throw new DatabaseError("Failed to find subscription by endpoint", error);
  }
}

export async function deleteSubScription(subId: string): Promise<any> {
  try {
    const result = await prisma.userSwSubScription.delete({
      where: { id: subId },
    });
    return result;
  } catch (error) {
    throw new DatabaseError(`Failed to delete subscription: ${subId}`, error);
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
    throw new DatabaseError("Failed to authenticate user", error);
  }
}

export async function createRote(data: any): Promise<any> {
  try {
    const rote = await prisma.rote.create({
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
    });
    return rote;
  } catch (error) {
    throw new DatabaseError("Failed to create note", error);
  }
}

export async function findRoteById(id: string): Promise<any> {
  try {
    const rote = await prisma.rote.findFirst({
      where: { id },
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
    return rote;
  } catch (error) {
    throw new DatabaseError(`Failed to find rote by id: ${id}`, error);
  }
}

export async function editRote(data: any): Promise<any> {
  try {
    const { id, authorid, ...dataClean } = data;
    const rote = await prisma.rote.update({
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
    });
    return rote;
  } catch (error) {
    throw new DatabaseError(`Failed to update rote: ${data.id}`, error);
  }
}

export async function deleteRote(data: any): Promise<any> {
  try {
    const rote = await prisma.rote.delete({
      where: {
        id: data.id,
        authorid: data.authorid,
      },
    });
    return rote;
  } catch (error) {
    throw new DatabaseError(`Failed to delete rote: ${data.id}`, error);
  }
}

export async function deleteAttachments(roteid: string): Promise<any> {
  try {
    const result = await prisma.attachment.deleteMany({
      where: { roteid },
    });
    return result;
  } catch (error) {
    throw new DatabaseError(
      `Failed to delete attachments for rote: ${roteid}`,
      error
    );
  }
}

export async function findMyRote(
  authorid: string,
  skip: number | undefined,
  limit: number | undefined,
  filter: any,
  archived: any
): Promise<any> {
  try {
    const rotes = await prisma.rote.findMany({
      where: {
        AND: [
          {
            authorid,
            archived,
          },
          { ...filter },
        ],
      },
      skip: skip ? skip : 0,
      take: limit ? limit : 20,
      orderBy: [{ pin: "desc" }, { createdAt: "desc" }],
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
    return rotes;
  } catch (error) {
    throw new DatabaseError("Failed to find user rotes", error);
  }
}

export async function findUserPublicRote(
  userid: string,
  skip: number | undefined,
  limit: number | undefined,
  filter: any,
  archived: any
): Promise<any> {
  try {
    const rotes = await prisma.rote.findMany({
      where: {
        AND: [
          {
            authorid: userid,
            archived,
            state: "public",
          },
          { ...filter },
        ],
      },
      skip: skip ? skip : 0,
      take: limit ? limit : 20,
      orderBy: [{ pin: "desc" }, { createdAt: "desc" }],
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
    return rotes;
  } catch (error) {
    throw new DatabaseError("Failed to find public rotes", error);
  }
}

export async function findPublicRote(
  skip: number | undefined,
  limit: number | undefined,
  filter: any
): Promise<any> {
  try {
    const rotes = await prisma.rote.findMany({
      where: {
        AND: [{ state: "public" }, { ...filter }],
      },
      skip: skip ? skip : 0,
      take: limit ? limit : 20,
      orderBy: [{ createdAt: "desc" }],
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
    return rotes;
  } catch (error) {
    throw new DatabaseError("Failed to find public rotes", error);
  }
}

export async function getMyTags(userid: string): Promise<any> {
  try {
    const rotes = await prisma.rote.findMany({
      where: { authorid: userid },
      select: { tags: true },
    });
    const allTags = Array.from(new Set(rotes.flatMap((item) => item.tags)));
    return allTags;
  } catch (error) {
    throw new DatabaseError("Failed to get user tags", error);
  }
}

export async function getMySession(userid: string): Promise<any> {
  try {
    const sessions = await prisma.session.findMany({
      where: {
        data: {
          contains: userid,
        },
      },
    });
    return sessions;
  } catch (error) {
    throw new DatabaseError("Failed to get user sessions", error);
  }
}

export async function generateOpenKey(userid: string): Promise<any> {
  try {
    const openKey = await prisma.userOpenKey.create({
      data: {
        permissions: ["SENDROTE"],
        userid,
      },
    });
    return openKey;
  } catch (error) {
    throw new DatabaseError("Failed to generate open key", error);
  }
}

export async function getMyOpenKey(userid: string): Promise<any> {
  try {
    const openKeys = await prisma.userOpenKey.findMany({
      where: { userid },
    });
    return openKeys;
  } catch (error) {
    throw new DatabaseError("Failed to get user open keys", error);
  }
}

export async function deleteMyOneOpenKey(
  userid: string,
  id: string
): Promise<any> {
  try {
    const openKey = await prisma.userOpenKey.findUnique({
      where: { id },
    });

    if (!openKey) {
      throw new DatabaseError("Open key not found");
    }

    if (openKey.userid !== userid) {
      throw new DatabaseError("Unauthorized to delete this open key");
    }

    const result = await prisma.userOpenKey.delete({
      where: { id },
    });
    return result;
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new DatabaseError(`Failed to delete open key: ${id}`, error);
  }
}

export async function editMyOneOpenKey(
  userid: string,
  id: string,
  permissions: string[]
): Promise<any> {
  try {
    const openKey = await prisma.userOpenKey.findUnique({
      where: { id },
    });

    if (!openKey) {
      throw new DatabaseError("Open key not found");
    }

    if (openKey.userid !== userid) {
      throw new DatabaseError("Unauthorized to edit this open key");
    }

    const result = await prisma.userOpenKey.update({
      where: { id },
      data: { permissions },
    });
    return result;
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new DatabaseError(`Failed to update open key: ${id}`, error);
  }
}

export async function getOneOpenKey(id: string): Promise<any> {
  try {
    const openKey = await prisma.userOpenKey.findUnique({
      where: { id },
    });

    if (!openKey) {
      throw new DatabaseError("Open key not found");
    }

    return openKey;
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new DatabaseError(`Failed to get open key: ${id}`, error);
  }
}

export async function createAttachments(
  userid: string,
  roteid: string | undefined,
  data: UploadResult[]
): Promise<any> {
  try {
    const attachments = data.map((e: UploadResult) => ({
      userid,
      roteid,
      url: e.url,
      compressUrl: e.compressUrl,
      details: e.details,
      storage: "R2",
    }));

    const attachments_new = await prisma.$transaction(
      attachments.map((attachment: any) =>
        prisma.attachment.create({
          data: attachment,
        })
      )
    );
    return attachments_new;
  } catch (error) {
    throw new DatabaseError("Failed to create attachments", error);
  }
}

export async function editMyProfile(userid: any, data: any): Promise<any> {
  try {
    const user = await prisma.user.update({
      where: { id: userid },
      data: {
        avatar: data.avatar || undefined,
        nickname: data.nickname || undefined,
        description: data.description || undefined,
        cover: data.cover || undefined,
      },
    });
    return user;
  } catch (error) {
    throw new DatabaseError("Failed to update user profile", error);
  }
}

export async function getUserInfoByUsername(username: string): Promise<any> {
  try {
    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        avatar: true,
        cover: true,
        nickname: true,
        username: true,
        createdAt: true,
        description: true,
      },
    });

    if (!user) {
      throw new DatabaseError("User not found");
    }

    return user;
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new DatabaseError(`Failed to get user info: ${username}`, error);
  }
}

export async function getHeatMap(
  userId: string,
  startDate: string,
  endDate: string
): Promise<any> {
  try {
    const rotes = await prisma.rote.findMany({
      where: {
        authorid: userId,
        createdAt: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
    });

    const result = rotes.reduce((acc: any, item: any) => {
      const date = item.createdAt.toISOString().split("T")[0];
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {});

    return result;
  } catch (error) {
    throw new DatabaseError("Failed to generate heatmap data", error);
  }
}

export async function getSiteMapData(): Promise<any> {
  try {
    const users = await prisma.user.findMany({
      select: {
        username: true,
        nickname: true,
      },
    });
    return users;
  } catch (error) {
    throw new DatabaseError("Failed to get sitemap data", error);
  }
}

export async function getStatus(): Promise<boolean> {
  try {
    await prisma.rote.findFirst();
    return true;
  } catch (error) {
    throw new DatabaseError("Failed to check database status", error);
  }
}

export async function findMyRandomRote(authorid: string): Promise<any> {
  try {
    const allCount = await prisma.rote.count({ where: { authorid } });
    if (allCount === 0) {
      throw new DatabaseError("No rotes found for user");
    }

    const random = Math.floor(Math.random() * allCount);
    const rote = await prisma.rote.findFirst({
      where: { authorid },
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
    });

    return rote;
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new DatabaseError("Failed to find random user rote", error);
  }
}

export async function findRandomPublicRote(): Promise<any> {
  try {
    const allCount = await prisma.rote.count({ where: { state: "public" } });
    if (allCount === 0) {
      throw new DatabaseError("No public rotes found");
    }

    const random = Math.floor(Math.random() * allCount);
    const rote = await prisma.rote.findFirst({
      where: { state: "public" },
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
    });

    return rote;
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new DatabaseError("Failed to find random public rote", error);
  }
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
      throw new DatabaseError("User not found");
    }

    const passwordhash = user.passwordhash;
    const salt = user.salt;

    const oldpasswordhash = crypto.pbkdf2Sync(
      oldpassword,
      salt,
      310000,
      32,
      "sha256"
    );

    if (
      Buffer.from(oldpasswordhash).toString("hex") !==
      Buffer.from(passwordhash).toString("hex")
    ) {
      throw new DatabaseError("Incorrect old password");
    }

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
        salt: newSalt,
      },
    });

    return userUpdate;
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new DatabaseError("Failed to change password", error);
  }
}

export async function statistics(authorid: string): Promise<any> {
  try {
    const [noteCount, attachments] = await Promise.all([
      prisma.rote.count({ where: { authorid } }),
      prisma.attachment.findMany({ where: { userid: authorid } }),
    ]);

    return {
      noteCount,
      attachmentsCount: attachments.length,
    };
  } catch (error) {
    throw new DatabaseError("Failed to get user statistics", error);
  }
}

export async function exportData(authorid: string): Promise<any> {
  try {
    const notes = await prisma.rote.findMany({
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
    return { notes };
  } catch (error) {
    throw new DatabaseError("Failed to export user data", error);
  }
}
