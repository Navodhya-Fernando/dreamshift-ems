import {NextResponse} from 'next/server';
import {getServerSession} from 'next-auth';
import {authOptions} from '@/lib/auth';
import {googleConfig,oauthStart} from '@/lib/googleCalendar';
export async function GET(){
 const session=await getServerSession(authOptions);if(!session?.user?.id)return new NextResponse('Unauthorized',{status:401});
 const config=googleConfig();if(!config)return new NextResponse('Google Calendar is not configured',{status:503});
 const {url,cookie}=oauthStart(config,session.user.id);
 const response=NextResponse.redirect(url);
 response.cookies.set('ems_google_oauth',cookie,{httpOnly:true,secure:config.origin.startsWith('https:'),sameSite:'lax',path:'/api/integrations/google-calendar/callback',maxAge:600});
 return response;
}
