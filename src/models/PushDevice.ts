import mongoose,{Schema,type Model} from 'mongoose';
interface Device{_id:string;userId:mongoose.Types.ObjectId;endpoint:string;keys:{p256dh:string;auth:string};label:string;createdAt:Date;lastDeliveredAt:Date;lastAttemptAt?:Date;lastTestAt?:Date;lastError?:string;leaseUntil?:Date;leaseId?:string;}
const schema=new Schema<Device>({_id:{type:String,required:true},userId:{type:Schema.Types.ObjectId,required:true},endpoint:{type:String,required:true,select:false},keys:{type:new Schema({p256dh:String,auth:String},{_id:false}),required:true,select:false},label:{type:String,default:'Browser'},createdAt:{type:Date,required:true},lastDeliveredAt:{type:Date,required:true},lastAttemptAt:Date,lastTestAt:Date,lastError:String,leaseUntil:Date,leaseId:String},{versionKey:false});
schema.index({userId:1});schema.index({lastAttemptAt:1});
export default (mongoose.models.PushDevice as Model<Device>|undefined)||mongoose.model<Device>('PushDevice',schema);
