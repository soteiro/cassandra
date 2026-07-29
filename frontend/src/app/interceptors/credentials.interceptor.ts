import { HttpInterceptorFn } from '@angular/common/http'

export const credentialsInterceptor: HttpInterceptorFn = (req, next) =>{
    const reqWithCredentials = req.clone({
        withCredentials :true,
    })

    return next(reqWithCredentials);
};