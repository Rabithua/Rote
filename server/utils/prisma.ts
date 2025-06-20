import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  log: [
    { level: "warn", emit: "event" },
    { level: "info", emit: "event" },
    { level: "error", emit: "event" },
  ],
});

prisma.$on("warn", (e) => {
  console.log("Prisma Warn:", e);
});

prisma.$on("info", (e) => {
  console.log("Prisma Info:", e);
});

prisma.$on("error", (e) => {
  // console.log("Prisma Error:", e);
});

// Check if Prisma connection is successful
(async () => {
  try {
    console.log("Checking Prisma connection...");
    await prisma.$connect();
    await prisma.rote.findFirst();
    console.log("Prisma connected successfully!");
  } catch (error) {
    console.info("Failed to connect to Prisma.", error);
    process.exit(1); // 如果连接失败，终止进程
  }
})();

export default prisma;
