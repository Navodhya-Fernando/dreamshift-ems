import mongoose,{Schema} from 'mongoose';
const schema=new Schema({name:{type:String,required:true},startedAt:{type:Date,required:true},finishedAt:Date,status:{type:String,enum:['RUNNING','SUCCESS','PARTIAL','FAILED'],required:true},durationMs:Number,details:Schema.Types.Mixed},{timestamps:true});
schema.index({name:1,startedAt:-1});
schema.index({startedAt:1},{expireAfterSeconds:2592000});
export default mongoose.models.SystemJobRun||mongoose.model('SystemJobRun',schema);
