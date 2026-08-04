import { inject, Injectable } from '@angular/core'
import { httpResource } from '@angular/common/http'
import { AuthService } from '../services/auth.service'

export interface ProyectResponse {
    id: number;
    nombre: string;
    descripcion: string;
    comentario: string;
    fecha_creacion: string;
    estado: string;
}

@Injectable({
    providedIn: 'root'
})

export class proyectService {
    private readonly authService = inject(AuthService)
    readonly proyectResource = httpResource<ProyectResponse[]>(
        () => {
            if (!this.authService.isLoggedIn()){
                return undefined;
            }
           return 'http://localhost:8080/api/proyects'}
    )

    public getProyectById(id: () => string | null){
        if (!this.authService.isLoggedIn()){
            return undefined
        }

        return httpResource<ProyectResponse>( () =>{
            const proyectId = id()
            if(!proyectId) return undefined
            return `http://localhost:8080/api/proyects/${proyectId}`
        }
        )
    }

    reload(){
        this.proyectResource.reload()
    }
}