import { PrismaClient, UserSwSubScription } from "@prisma/client";
import { checkPrisma } from "./main";

const prisma = new PrismaClient({
  log: [
    { level: "warn", emit: "event" },
    { level: "info", emit: "event" },
    { level: "error", emit: "event" },
  ],
});

prisma.$on("warn", (e) => {
  console.log(e);
});

prisma.$on("info", (e) => {
  console.log(e);
});

prisma.$on("error", (e) => {
  // console.log(e);
});

checkPrisma(prisma);

export default prisma;
