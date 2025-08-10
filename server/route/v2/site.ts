import express from 'express';
import { getSiteMapData, getStatus } from "../../utils/dbMethods";
import { asyncHandler } from "../../utils/handlers";
import { createResponse } from "../../utils/main";

// 站点数据相关路由
const siteRouter = express.Router();

// 获取站点地图数据
siteRouter.get(
  '/sitemap',
  asyncHandler(async (req, res) => {
    const data = await getSiteMapData();
    res.status(200).json(createResponse(data));
  })
);

// 获取站点状态
siteRouter.get(
  '/status',
  asyncHandler(async (req, res) => {
    await getStatus();
    res.status(200).json(createResponse({}));
  })
);

export default siteRouter;