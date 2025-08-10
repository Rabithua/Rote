import express from 'express';
import { authenticateJWT } from "../../middleware/jwtAuth";
import { scheduleNoteOnceNoticeJob } from "../../schedule/NoteOnceNoticeJob";
import { JobNames } from "../../types/schedule";
import { asyncHandler } from "../../utils/handlers";
import { createResponse } from "../../utils/main";

// 通知相关路由
const notificationsRouter = express.Router();

// 创建通知
notificationsRouter.post(
  '/',
  authenticateJWT,
  asyncHandler(async (req, res) => {
    const { type } = req.body;

    switch (type) {
      case JobNames.NoteOnceNoticeJob:
        await scheduleNoteOnceNoticeJob(req.body);
        break;

      default:
        throw new Error('Invalid notification type');
    }

    res.status(201).json(createResponse());
  })
);

export default notificationsRouter;