"use client";
import {useEffect} from 'react';
export default function RegisterServiceWorker(){
useEffect(()=>{if('serviceWorker' in navigator&&window.isSecureContext){navigator.serviceWorker.register('/ems-sw.js',{scope:'/'}).catch(error=>console.warn('EMS service worker registration failed',error));}},[]);
return null;
}
