import mongoose,{Schema,type Model} from 'mongoose';
import type {Permission,RoleCode,RoleScope} from '@/lib/roles';
export interface IRole {scope:RoleScope;code:RoleCode;label:string;permissions:Permission[];}
const schema=new Schema<IRole>({scope:{type:String,enum:['PLATFORM','WORKSPACE'],required:true},code:{type:String,enum:['OWNER','ADMIN','WORKSPACE_ADMIN','EMPLOYEE'],required:true},label:{type:String,required:true},permissions:[{type:String}]},{timestamps:true});
schema.index({scope:1,code:1},{unique:true});
export default (mongoose.models.Role as Model<IRole>|undefined)||mongoose.model<IRole>('Role',schema);
