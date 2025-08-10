export enum JobNames {
  NoteOnceNoticeJob = "Note Once Notice Job",
}

export interface JobData {
  [JobNames.NoteOnceNoticeJob]: {
    when: string | Date;
    subId: string;
    noteId: string;
    userId: string;
  };
}
