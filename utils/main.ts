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

// 自定义身份验证中间件
export function isAdmin(req: any, res: any, next: any) {
    if (req.isAuthenticated()) {
        const user = req.user as User
        if (user.username !== 'rabithua') {
            res.status(401).send({
                code: 1,
                msg: 'Unauthenticated: Not admin',
                data: null
            })
            return
        }
        next();
    } else {
        res.status(401).send({
            code: 1,
            msg: 'Unauthenticated',
            data: null
        });
    }
}