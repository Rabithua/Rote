import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function allUser() {
  try {
    await prisma.$connect();
    console.log("Prisma 连接成功！");
    const users = await prisma.user.findMany();
    return users;
  } catch (error) {
    console.error("Error creating post:", error);
    return;
  }
}

export async function createUser(data: { name: string; email: string }) {
  try {
    const user = await prisma.user.create({
      data,
    });
    return user;
  } catch (error) {
    console.error("Error creating post:", error);
    return;
  }
}

export async function createPost(
  title: string,
  content: string,
  authorId: string
) {
  try {
    const post = await prisma.post.create({
      data: {
        title,
        content,
        published: false,
        author: { connect: { id: authorId } },
      },
    });
    return post;
  } catch (error) {
    console.error("Error creating post:", error);
    return;
  }
}

export async function findPostById(id: string) {
  try {
    const post = await prisma.post.findUnique({
      where: {
        id,
      },
    });
    return post;
  } catch (error) {
    console.error("Error creating post:", error);
    throw error;
  }
}
