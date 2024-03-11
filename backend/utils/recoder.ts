import moment from "moment";

// 请求中间件，记录IP和时间
const recoderIpAndTime = function (req: any, res: any, next: any) {
  const ipAddress = req.ip;
  console.log(
    `${moment().format("YYYY/MM/DD HH:mm:ss")} ${ipAddress} ${req.method} ${
      req.path
    }`
  );
  next();
};

export default recoderIpAndTime;
