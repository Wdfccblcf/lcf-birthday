import { mountSnowflake } from './ornament.js?v=12-card-framing';

window.previewErrors=[];
window.addEventListener('error',e=>window.previewErrors.push(e.message));
window.addEventListener('unhandledrejection',e=>window.previewErrors.push(String(e.reason)));
try {
  const ornament=await mountSnowflake(document.querySelector('#viewer'));
  window.snowflakePreview=ornament;
  if(window.parent!==window)window.parent.postMessage({type:'snowflake-preview-status',phase:'ready'},location.origin);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&window.parent!==window){e.preventDefault();window.parent.postMessage({type:'snowflake-preview-close'},location.origin);}});
  document.addEventListener('visibilitychange',()=>ornament.pause(document.hidden));
  window.addEventListener('pagehide',()=>ornament.dispose(),{once:true});
} catch(error) {
  console.error(error);window.previewErrors.push(String(error));
  if(window.parent!==window)window.parent.postMessage({type:'snowflake-preview-status',phase:'error'},location.origin);
  const status=document.querySelector('#load-status');
  status.textContent='吊饰暂时未能载入。';status.hidden=false;
}
