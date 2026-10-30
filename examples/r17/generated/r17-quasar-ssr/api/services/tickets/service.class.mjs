import { NotFound, BadRequest } from '@feathersjs/errors'
import { validateData } from './schema.mjs'
export class GeneratedService {
  #items=new Map()
  #counter=1
  constructor(){for(const method of ['find','get','create','patch','remove'])this[method]=this[method].bind(this)}
  #id(value){const n=Number(value);if(!Number.isSafeInteger(n)||n<1)throw new BadRequest('Invalid ID');return n}
  async find(){return [...this.#items.values()].map(x=>({...x}))}
  async get(id){const item=this.#items.get(this.#id(id));if(!item)throw new NotFound('Not found');return {...item}}
  async create(data){const row={id:this.#counter++,...validateData(data)};this.#items.set(row.id,row);return {...row}}
  async patch(id,data){const key=this.#id(id);if(!this.#items.has(key))throw new NotFound('Not found');const row={id:key,...validateData(data)};this.#items.set(key,row);return {...row}}
  async remove(id){const key=this.#id(id);const row=this.#items.get(key);if(!row)throw new NotFound('Not found');this.#items.delete(key);return {...row}}
}
