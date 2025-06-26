import express = require('express');
import bodyParser from 'body-parser';
import cors from 'cors';
import passport from './utils/passport';

import prisma from './utils/prisma';

import { rateLimiterMiddleware } from './middleware/limiter';
import { errorHandler } from './utils/handlers';
import { recorderIpAndTime } from './utils/recoder';

import routerV2 from './route/v2'; // RESTful API routes

import { startAgenda } from './utils/schedule';

const app: express.Application = express();

const port = process.env.PORT || 3000;

// record ip and time
app.use(recorderIpAndTime);

// rate limiter
app.use(rateLimiterMiddleware);

// Initialize Passport
app.use(passport.initialize());

// body parser
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// cors
app.use(
  cors({
    origin: process.env.CORS?.split(',') || 'http://localhost:3000',
    credentials: true,
    optionsSuccessStatus: 200,
  })
);

app.use('/v2/api', routerV2); // RESTful API

// Global error handler (must be after all routes)
app.use(errorHandler);

app.get('*', (req, res) => {
  res.status(404).send({
    code: 1,
    message: 'Api not found!',
    data: null,
  });
});

app.listen(port, () => {
  console.log(`Rote Node backend server listening on port ${port}!`);
});

startAgenda().then(() => {
  // scheduleNoteOnceNoticeJob({
  //   when: "One Minute",
  //   subId: "67ba96bcc13e4e3e622d6113",
  //   noteId: "680f39fc819b0a0fcd1339f6",
  //   userId: "65f2f28eaa85f74b004888a8",
  // });
}); // Start the scheduled job
