import { User } from "@prisma/client"

export function sanitizeUserData(user: User) {
    delete (user as { passwordhash?: Buffer }).passwordhash
    delete (user as { salt?: Buffer }).salt
    return user
}

// 自定义身份验证中间件
export function isAuthenticated(req: any, res: any, next: any) {
    if (req.isAuthenticated()) {
        next();
    } else {
        res.status(401).send({
            code: 1,
            msg: 'Unauthenticated',
            data: null
        });
    }
}