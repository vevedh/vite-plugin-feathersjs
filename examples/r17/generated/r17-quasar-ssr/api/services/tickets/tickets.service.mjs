import { GeneratedService } from './service.class.mjs'
export default function register(app){
 app.use('tickets',new GeneratedService(),{methods:['find','get','create','patch','remove']})
 // This demonstration service has no authentication; bind HTTP only to loopback.
}
