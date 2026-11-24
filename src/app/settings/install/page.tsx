import Link from 'next/link';
import AppInstall from '@/components/layout/AppInstall';
export default function InstallPage(){return <div className="page-wrapper" style={{maxWidth:800}}><Link className="btn btn-ghost" href="/settings">← Settings</Link><h1 className="page-title" style={{margin:'14px 0'}}>App installation</h1><AppInstall/></div>;}
