"use client";
import {useEffect,useState} from 'react';
type InstallEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>};
export default function AppInstall(){
  const [prompt,setPrompt]=useState<InstallEvent|null>(null),[installed,setInstalled]=useState(false),[message,setMessage]=useState('');
  useEffect(()=>{
    setInstalled(window.matchMedia('(display-mode: standalone)').matches||Boolean((navigator as Navigator&{standalone?:boolean}).standalone));
    const onPrompt=(e:Event)=>{e.preventDefault();setPrompt(e as InstallEvent);};
    const done=()=>{setInstalled(true);setPrompt(null);};
    window.addEventListener('beforeinstallprompt',onPrompt);window.addEventListener('appinstalled',done);
    return()=>{window.removeEventListener('beforeinstallprompt',onPrompt);window.removeEventListener('appinstalled',done);};
  },[]);
  async function install(){if(!prompt)return;try{await prompt.prompt();const result=await prompt.userChoice;if(result.outcome==='accepted')setMessage('Installation accepted.');}catch{setMessage('Use your browser installation menu.');}finally{setPrompt(null);}}
  return <section className="card" style={{padding:20,display:'grid',gap:12}}><h2 className="section-title">Install DreamShift EMS</h2><p className="text-muted">Open EMS in its own window with an app icon and automatic web updates.</p>{installed?<p role="status">You are using the installed application.</p>:prompt?<button className="btn btn-primary" onClick={()=>void install()}>Install app</button>:<p className="text-muted text-sm">Use your browser menu to install this application if the install option is available.</p>}{message&&<p role="status">{message}</p>}<div style={{display:'grid',gap:8}}><p><strong>Mac:</strong> Safari → File → Add to Dock, or Chrome → Install page as app.</p><p><strong>Windows / Linux:</strong> Chrome or Edge menu → Install app.</p><p><strong>Android:</strong> Chrome menu → Add to Home screen / Install.</p><p><strong>iPhone / iPad:</strong> Safari → Share → Add to Home Screen.</p></div><p className="text-muted text-sm">Install availability depends on the browser and OS version. Internet is required to access company data. Enable supported device alerts under Settings → Device notifications after installation.</p></section>;
}
