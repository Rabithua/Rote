import { Agenda } from "@hokify/agenda";

export const agenda = new Agenda({
  db: { address: process.env.DATABASE_URL! },
});

export async function startAgenda() {
  try {
    await agenda.start();
    console.log("Agenda started successfully!");

    const jobCount = await agenda.jobs({}, {}).then((jobs) => jobs.length);
    console.log(`Number of scheduled tasks: ${jobCount}`);
  } catch (error) {
    console.error("Error starting Agenda:", error);
  }
}
