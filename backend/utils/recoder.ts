import moment from "moment";

// Request middleware, record IP and time
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
