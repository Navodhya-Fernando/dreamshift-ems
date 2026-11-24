import mongoose,{Schema,type Model} from 'mongoose';
import type {ImportedCalendarEvent} from '@/lib/googleCalendar';
interface Connection{_id:mongoose.Types.ObjectId;refreshToken:string;calendarId?:string;calendarName?:string;events:ImportedCalendarEvent[];lastSyncedAt?:Date;connectedAt:Date;revision:string;}
const schema=new Schema<Connection>({_id:{type:Schema.Types.ObjectId,required:true},refreshToken:{type:String,required:true,select:false},calendarId:String,calendarName:String,events:{type:[new Schema({id:String,title:String,date:String,end:String,allDay:Boolean,url:String},{_id:false})],default:[]},lastSyncedAt:Date,connectedAt:{type:Date,required:true},revision:{type:String,required:true}},{versionKey:false});
export default (mongoose.models.GoogleCalendarConnection as Model<Connection>|undefined)||mongoose.model<Connection>('GoogleCalendarConnection',schema);
