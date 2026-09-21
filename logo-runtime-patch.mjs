import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const MARKER='WAQF_VISUAL_LOGO_EDITOR_V1';

function replaceRequired(source, searchValue, replacement, label){
  if(source.includes(replacement)) return source;
  if(!source.includes(searchValue)) throw new Error('Logo editor patch target not found: '+label);
  return source.replace(searchValue,replacement);
}

export async function applyLogoRuntimePatch(runtimeDir){
  const builderPath=path.join(runtimeDir,'visual-builder.js');
  const apiPath=path.join(runtimeDir,'visual-builder-patch.mjs');
  let builder=await fs.readFile(builderPath,'utf8');
  let api=await fs.readFile(apiPath,'utf8');

  if(!api.includes(MARKER)){
    const headerRoute="if(pathname==='/api/visual/settings/header'&&req.method==='PUT'){const parsed=await parseJson(req);const value=normalizeHeaderSettings(parsed?.value||parsed||{});const rows=await sb('waqf_settings?on_conflict=key',{method:'POST',body:{key:'header',value},prefer:'resolution=merge-duplicates,return=representation'});return sendJson(res,200,{ok:true,value:rows?.[0]?.value||value})}";
    const logoRoute=headerRoute+"\n    /* "+MARKER+" */ if(pathname==='/api/visual/settings/site-logo'&&req.method==='PUT'){const parsed=await parseJson(req);let mediaId=Number(parsed?.logo_media_id);mediaId=Number.isSafeInteger(mediaId)&&mediaId>0?mediaId:null;if(mediaId){const found=await sb('waqf_media?select=id&id=eq.'+mediaId+'&limit=1');if(!found?.length)mediaId=null}const current=await sb('waqf_settings?select=key,value&key=eq.site&limit=1');const value={...(current?.[0]?.value||{}),logo_media_id:mediaId};const rows=await sb('waqf_settings?on_conflict=key',{method:'POST',body:{key:'site',value},prefer:'resolution=merge-duplicates,return=representation'});return sendJson(res,200,{ok:true,value:rows?.[0]?.value||value})}";
    api=replaceRequired(api,headerRoute,logoRoute,'site logo API');
    api=api.replaceAll('?v=10','?v=11');
    await fs.writeFile(apiPath,api);
  }

  if(!builder.includes(MARKER)){
    const panelMarker='function renderHeaderPanel(){';
    const helpers=`/* ${MARKER} */
function headerLogoControlHtml(){
  const site=settings().site||{},media=state.data?.media||[],current=site.logo_media_id||'';
  const currentSrc=current?'/media/'+current:'/assets/logo.png';
  const options=['<option value="" '+(!current?'selected':'')+'>الشعار الأصلي الافتراضي</option>'].concat(media.map(m=>'<option value="'+m.id+'" '+(String(m.id)===String(current)?'selected':'')+'>'+esc(m.file_name||('صورة '+m.id))+'</option>')).join('');
  return '<div class="vb-card is-open vb-logo-card"><div class="vb-card-head"><div class="vb-card-icon">◈</div><div class="vb-card-title"><strong>شعار الموقع</strong><small>اختر أي صورة من مكتبة الوسائط لتصبح الشعار المستخدم في الشريط العلوي والموقع.</small></div></div><div class="vb-card-body" style="display:block"><div class="vb-logo-editor"><div class="vb-logo-preview"><img src="'+currentSrc+'" alt="معاينة الشعار"></div><div class="vb-logo-fields"><div class="vb-field"><label>الشعار الحالي</label><select id="vbSiteLogoSelect">'+options+'</select></div><div class="vb-logo-actions"><button type="button" class="vb-btn vb-btn-sm vb-btn-light" id="vbUseDefaultLogo">استخدام الشعار الأصلي</button><span>لإضافة شعار جديد، ارفعه أولًا من مكتبة الصور ثم اختره من هذه القائمة.</span></div></div></div></div></div>';
}
async function saveSiteLogo(mediaId){
  try{
    status('saving','جارٍ حفظ الشعار');
    const result=await api('/settings/site-logo',{method:'PUT',body:JSON.stringify({logo_media_id:mediaId||null})});
    state.data.settings=state.data.settings||{};
    state.data.settings.site=result.value||Object.assign({},settings().site||{},{logo_media_id:mediaId||null});
    status('saved','تم تحديث الشعار');
    renderHeaderPanel();renderPreview();
    toast('تم تغيير شعار الموقع');
  }catch(error){status('error','فشل حفظ الشعار');toast(error.message,true)}
}
`;
    builder=replaceRequired(builder,panelMarker,helpers+panelMarker,'logo helper insertion');

    const htmlMarker="root.innerHTML='<div class=\"vb-header-editor\"><div class=\"vb-card is-open\">";
    const htmlReplacement="root.innerHTML='<div class=\"vb-header-editor\">'+headerLogoControlHtml()+'<div class=\"vb-card is-open\">";
    builder=replaceRequired(builder,htmlMarker,htmlReplacement,'header logo card');

    const bindMarker='function bindHeaderPanel(root){';
    const bindReplacement=bindMarker+"const logoSelect=$('#vbSiteLogoSelect',root),defaultLogo=$('#vbUseDefaultLogo',root);if(logoSelect)logoSelect.addEventListener('change',()=>saveSiteLogo(logoSelect.value?Number(logoSelect.value):null));if(defaultLogo)defaultLogo.addEventListener('click',()=>saveSiteLogo(null));";
    builder=replaceRequired(builder,bindMarker,bindReplacement,'logo controls binding');

    await fs.writeFile(builderPath,builder);
  }

  const cssPath=path.join(runtimeDir,'visual-builder.css');
  let css=await fs.readFile(cssPath,'utf8');
  if(!css.includes(MARKER)){
    css+=`
/* ${MARKER} */
.vb-logo-editor{display:grid;grid-template-columns:150px 1fr;gap:18px;align-items:center}
.vb-logo-preview{height:130px;border:1px dashed var(--vb-line);border-radius:18px;background:#fff;display:grid;place-items:center;padding:14px}
.vb-logo-preview img{max-width:100%;max-height:100%;object-fit:contain}
.vb-logo-fields{display:grid;gap:10px}.vb-logo-actions{display:flex;flex-wrap:wrap;align-items:center;gap:10px}.vb-logo-actions span{font-size:11px;color:var(--vb-muted);line-height:1.7}
@media(max-width:680px){.vb-logo-editor{grid-template-columns:1fr}.vb-logo-preview{height:110px}.vb-logo-actions{align-items:stretch;flex-direction:column}}
`;
    await fs.writeFile(cssPath,css);
  }

  execFileSync(process.execPath,['--check',builderPath],{stdio:'inherit'});
}
