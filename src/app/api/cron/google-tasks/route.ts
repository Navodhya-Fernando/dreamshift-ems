import {NextResponse} from 'next/server';
import dbConnect from '@/lib/mongoose';
import {runGoogleTasksBatch} from '@/lib/googleTasks';
export const maxDuration=300;
export async function GET(req:Request){const secret=process.env.CRON_SECRET;if(!secret||req.headers.get('authorization')!=='Bearer '+secret)return NextResponse.json({success:false,error:'Unauthorized'},{status:401});try{await dbConnect();return NextResponse.json({success:true,data:await runGoogleTasksBatch()});}catch{return NextResponse.json({success:false,error:'Google Tasks job failed'},{status:503});}}
