import multer from "multer";
import multerS3 from "multer-s3";
import { s3 } from "./r2";
import { randomUUID } from "crypto";

// 储存本地
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, "uploads");
//   },
//   filename(req, file, callback) {
//     const { originalname } = file;
//     callback(null, `${randomUUID()}-${originalname}`);
//   },
// });

// 储存内存中
// const storage = multer.memoryStorage();

const fileFilter = (req: any, file: any, cb: any) => {
  if (file.mimetype.split("/")[0] === "image") {
    cb(null, true);
  } else {
    cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE"), false);
  }
};

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: `${process.env.R2_BUCKET}`,
    metadata: function (req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
      const { originalname } = file;
      const date = new Date(); // 获取当前日期
      const year = date.getFullYear(); // 获取当前年份
      const month = date.getMonth() + 1; // 获取当前月份（注意月份从 0 开始，需要加 1）

      cb(null, `uploads/${year}/${month}/${randomUUID()}_${originalname}`);
    },
  }),
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 9,
  },
});

export default upload;
