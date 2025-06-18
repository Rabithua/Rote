import express = require('express');
import bodyParser from 'body-parser';
import cors from 'cors';
import passport from './utils/passport';
import expressSession = require('express-session');

import { PrismaSessionStore } from '@quixo3/prisma-session-store';
import prisma from './utils/prisma';

import { rateLimiterMiddleware } from './middleware/limiter';
import { errorHandler } from './utils/handlers';
import { recorderIpAndTime } from './utils/recoder';

import routerV1 from './route/v1';
import routerV2 from './route/v2'; // New RESTful routes

import { startAgenda } from './utils/schedule';

const app: express.Application = express();

const port = process.env.PORT || 3000;

// Configure session
app.use(
  expressSession({
    secret: process.env.SESSION_SECRET || 'sessionSecret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 31 * 24 * 60 * 60 * 1000,
    },
    store: new PrismaSessionStore(prisma, {
      checkPeriod: 2 * 60 * 1000,
      dbRecordIdIsSessionId: true,
    }),
  })
);

// record ip and time
app.use(recorderIpAndTime);

// rate limiter
app.use(rateLimiterMiddleware);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

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

app.use('/v1/api', routerV1);
app.use('/v2/api', routerV2); // New RESTful API

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
