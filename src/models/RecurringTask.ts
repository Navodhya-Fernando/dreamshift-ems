import mongoose, { Schema } from 'mongoose';
const schema = new Schema({
  ownerId:{type:Schema.Types.ObjectId,ref:'User',required:true,index:true},
  projectId:{type:Schema.Types.ObjectId,ref:'Project',required:true},
  assigneeId:{type:Schema.Types.ObjectId,ref:'User',required:true},
  title:{type:String,required:true,trim:true,maxlength:200},
  description:{type:String,default:''},
  priority:{type:String,enum:['LOW','MEDIUM','HIGH','URGENT'],default:'MEDIUM'},
  cadence:{type:String,enum:['DAILY','WEEKDAYS','WEEKLY','MONTHLY'],required:true},
  anchorDay:{type:Number,required:true,min:1,max:31},
  nextRunAt:{type:Date,required:true},
  lastRunAt:Date,
  active:{type:Boolean,default:true},
  lastError:String,
},{timestamps:true});
schema.index({active:1,nextRunAt:1});
schema.index({ownerId:1,createdAt:-1});
export default mongoose.models.RecurringTask || mongoose.model('RecurringTask',schema);
