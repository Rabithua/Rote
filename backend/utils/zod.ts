import { z } from "zod";
import mainJson from "../json/main.json";
const { safeRoutes } = mainJson;

export const RegisterDataZod = z.object({
  username: z
    .string()
    .min(1, "Username cannot be empty")
    .max(20, "Username cannot exceed 20 characters")
    .regex(
      /^[A-Za-z0-9_-]+$/,
      "Username can only contain letters, numbers, underscore and hyphen"
    )
    .refine((value) => !safeRoutes.includes(value), {
      message: "Username conflicts with routes, please choose another one",
    }),
  password: z
    .string()
    .min(1, "Password cannot be empty")
    .max(30, "Password cannot exceed 30 characters"),
  email: z
    .string()
    .min(1, "Email cannot be empty")
    .max(30, "Email cannot exceed 30 characters")
    .email("Invalid email format"),
  nickname: z
    .string()
    .min(1, "Nickname cannot be empty")
    .max(20, "Nickname cannot exceed 20 characters"),
});

export const passwordChangeZod = z.object({
  newpassword: z
    .string()
    .min(1, "Password cannot be empty")
    .max(30, "Password cannot exceed 30 characters"),
  oldpassword: z
    .string()
    .min(1, "Password cannot be empty")
    .max(30, "Password cannot exceed 30 characters"),
});
