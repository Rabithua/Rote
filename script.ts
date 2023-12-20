import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function allUser() {
  try {
    await prisma.$connect();
    console.log("Prisma 连接成功！");
    const users = await prisma.user.findMany();
    return users;
  } catch (error) {
    console.error("Error creating rote:", error);
    return;
  }
}

export async function createUser(data: {
  username: string;
  email: string;
  password: string;
  nickname?: string
}) {
  try {
    const user = await prisma.user.create({
      data,
    });
    return user;
  } catch (error) {
    console.error("Error creating rote:", error);
    return;
  }
}

export async function passportCheckUser(data: {
  username: string;
  password: string;
}) {
  try {
    const user = await prisma.user.findFirst({
      where: {
        username: data.username,
      },
    });
    return {
      msg: "ok",
      data: user,
    };
  } catch (error) {
    console.error("Error creating rote:", error);
    return {
      msg: "error",
      data: error,
    };
  }
}

export async function createRote(data: {
  title: string;
  content: string;
  authorid: string;
}) {
  try {
    const rote = await prisma.rote.create({
      data,
    });
    return rote;
  } catch (error) {
    console.error("Error creating rote:", error);
    return;
  }
}

export async function findRoteById(id: string) {
  try {
    const rote = await prisma.rote.findUnique({
      where: {
        id,
      },
    });
    return rote;
  } catch (error) {
    console.error("Error creating rote:", error);
    throw error;
  }
}
