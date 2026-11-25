import mongoose,{Schema} from 'mongoose';
const schema=new Schema({
  organizerId:{type:Schema.Types.ObjectId,ref:'User',required:true},
  attendeeIds:[{type:Schema.Types.ObjectId,ref:'User'}],
  title:{type:String,required:true,maxlength:200},
  description:{type:String,default:''},
  startTime:{type:Date,required:true},endTime:{type:Date,required:true},meetingUrl:{type:String,default:''},googleEventPublishedAt:Date,googleEventId:String,googleCalendarId:String,
  invites:[{userId:Schema.Types.ObjectId,status:{type:String,enum:['PENDING','SENDING','SENT','FAILED'],default:'PENDING'},sentAt:Date}],
},{timestamps:true});
schema.index({attendeeIds:1,startTime:1});
schema.index({organizerId:1,startTime:1});
export default mongoose.models.Meeting||mongoose.model('Meeting',schema);
