import type {MetadataRoute} from 'next';
export default function manifest():MetadataRoute.Manifest{
return {id:'/',name:'DreamShift EMS',short_name:'DreamShift',description:'Your work, projects and schedule in one place.',start_url:'/',scope:'/',display:'standalone',background_color:'#101319',theme_color:'#101319',icons:[{src:'/app-icons/192',sizes:'192x192',type:'image/png',purpose:'any'},{src:'/app-icons/512',sizes:'512x512',type:'image/png',purpose:'any'},{src:'/app-icons/512',sizes:'512x512',type:'image/png',purpose:'maskable'}]};
}
