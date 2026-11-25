import mongoose,{Schema,type Model} from 'mongoose';
interface Link{_id:string;userId:mongoose.Types.ObjectId;listId:string;projectId:mongoose.Types.ObjectId;localId:mongoose.Types.ObjectId;remoteId:string;base:string;}
const schema=new Schema<Link>({_id:{type:String,required:true},userId:{type:Schema.Types.ObjectId,required:true},listId:{type:String,required:true},projectId:{type:Schema.Types.ObjectId,required:true},localId:{type:Schema.Types.ObjectId,required:true},remoteId:{type:String,required:true},base:{type:String,required:true}},{timestamps:true,versionKey:false});
schema.index({userId:1,listId:1,localId:1},{unique:true});schema.index({userId:1,listId:1,remoteId:1},{unique:true});
export default (mongoose.models.GoogleTaskLink as Model<Link>|undefined)||mongoose.model<Link>('GoogleTaskLink',schema);
