import { z } from "zod";
import mainJson from "../json/main.json";
const { safeRoutes } = mainJson;

export const RegisterDataZod = z.object({
  username: z
    .string()
    .min(1, "用户名不能为空")
    .max(20, "用户名不能超过20位")
    .regex(/^[A-Za-z0-9_-]+$/, "用户名只能包含大小写字母和数字或者下划线和‘-’")
    .refine((value) => !safeRoutes.includes(value), {
      message: "用户名与路由冲突，换一个吧",
    }),
  password: z.string().min(1, "密码不能为空").max(30, "密码不能超过30位"),
  email: z
    .string()
    .min(1, "邮箱不能为空")
    .max(30, "邮箱不能超过30位")
    .email("邮箱格式不正确"),
  nickname: z.string().min(1, "昵称不能为空").max(20, "昵称不能超过20位"),
});

export const passwordChangeZod = z.object({
  newpassword: z.string().min(1, "密码不能为空").max(30, "密码不能超过30位"),
  oldpassword: z.string().min(1, "密码不能为空").max(30, "密码不能超过30位"),
});
