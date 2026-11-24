import {ImageResponse} from 'next/og';
export async function GET(_req:Request,{params}:{params:Promise<{size:string}>}){
  const {size}=await params;const n=Number(size);if(![180,192,512].includes(n))return new Response('Not found',{status:404});
  return new ImageResponse(<div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',background:'#101319'}}><div style={{width:n*.62,height:n*.62,borderRadius:n*.16,background:'linear-gradient(145deg,#7397ff,#4565cd)',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontSize:n*.42,fontWeight:700}}>D</div></div>,{width:n,height:n,headers:{'Cache-Control':'public, max-age=86400'}});
}
