import { Job } from "@hokify/agenda";
import { NotificationOptions } from "../types/main";
import { JobData, JobNames } from "../types/schedule";
import { findSubScriptionToUser } from "../utils/dbMethods";
import { agenda } from "../utils/schedule";
import webpush from "../utils/webpush";

agenda.define(
  JobNames.NoteOnceNoticeJob,
  async (job: Job<JobData[JobNames.NoteOnceNoticeJob]>) => {
    const jobData = job.attrs.data;
    console.log("Executing Job:", jobData, job.attrs.name);

    if (!webpush) {
      console.error("Webpush is not initialized");
      return;
    }

    if (!jobData) {
      console.error("Job data is missing");
      return;
    }

    const to = await findSubScriptionToUser(jobData.subId);

    if (!to) {
      console.error("Subscription not found for user:", jobData.subId);
      return;
    }

    let data: NotificationOptions = {
      title: "笔记回顾",
      body: `你有一条笔记需要回顾`,
      image: "https://r2.rote.ink/others/logo.png",
      "data": {
        "type": "openUrl",
        "url": `https://rote.ink/rote/${jobData.noteId}`,
      },
    };

    await webpush.sendNotification(
      {
        endpoint: to.endpoint,
        keys: to.keys,
      },
      JSON.stringify(data),
    );
  },
);

export const cancelNoteOnceNoticeJobJob = async (
  subId: string,
  noteId: string,
  userId: string,
) => {
  try {
    await agenda.cancel({
      name: JobNames.NoteOnceNoticeJob,
      "data.subId": subId,
      "data.noteId": noteId,
      "data.userId": userId,
    });
  } catch (error) {
    console.error("Error canceling specific job:", error);
  }
};

export const scheduleNoteOnceNoticeJob = async (
  jobData: JobData[JobNames.NoteOnceNoticeJob],
) => {
  if (!jobData || !jobData.when || !jobData.subId || !jobData.noteId) {
    console.error("Invalid job data:", jobData);
    throw new Error("Invalid job data");
  }
  await agenda.schedule(jobData.when, JobNames.NoteOnceNoticeJob, jobData);
  console.log("Scheduled job:", jobData);
};
