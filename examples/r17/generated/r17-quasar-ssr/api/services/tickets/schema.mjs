import { BadRequest } from '@feathersjs/errors'
import Ajv from 'ajv'
export const dataSchema={type:'object',additionalProperties:false,required:['title'],properties:{title:{type:'string',minLength:1,maxLength:120}}}
const valid=new Ajv({allErrors:true}).compile(dataSchema)
export function validateData(value){if(!valid(value))throw new BadRequest('Invalid service data');return {title:value.title.trim()}}
