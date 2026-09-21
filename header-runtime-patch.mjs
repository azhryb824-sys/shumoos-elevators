import { promises as fs } from 'node:fs';
import path from 'node:path';

const HEADER_MARKER = 'WAQF_VISUAL_HEADER_EDITOR_V1';

function requireReplace(source, searchValue, replacement, label) {
  if (source.includes(replacement)) return source;
  if (!source.includes(searchValue)) throw new Error(`Header patch target not found: ${label}`);
  return source.replace(searchValue, () => replacement);
}

function requireRegexReplace(source, pattern, replacement, label) {
  if (typeof replacement === 'string' && source.includes(replacement)) return source;
  if (!pattern.test(source)) throw new Error(`Header patch target not found: ${label}`);
  pattern.lastIndex = 0;
  return source.replace(pattern, () => replacement);
}

export async function applyHeaderRuntimePatch(runtimeDir) {
  const builderJsPath = path.join(runtimeDir, 'visual-builder.js');
  const builderCssPath = path.join(runtimeDir, 'visual-builder.css');
  const publicCssPath = path.join(runtimeDir, 'visual-public.css');
  const builderPatchPath = path.join(runtimeDir, 'visual-builder-patch.mjs');

  let builderJs = await fs.readFile(builderJsPath, 'utf8');
  let builderCss = await fs.readFile(builderCssPath, 'utf8');
  let publicCss = await fs.readFile(publicCssPath, 'utf8');
  let builderPatch = await fs.readFile(builderPatchPath, 'utf8');

  if (!builderPatch.includes(HEADER_MARKER)) {
    builderPatch = requireReplace(
      builderPatch,
      'const [pages,sections,media,products,productImages,projects,settings]=await Promise.all([',
      'const [pages,sections,media,products,productImages,projects,settings,menus]=await Promise.all([',
      'visual bootstrap destructuring'
    );

    builderPatch = requireRegexReplace(
      builderPatch,
      /sb\('waqf_settings\?select=key,value'\),\s*\]\);return\{ok:true,pages,sections,media,products,productImages,projects,settings:settingsObject\(settings\)\}\}/,
      "sb('waqf_settings?select=key,value'),\n  sb('waqf_menu_items?select=*&order=location.asc,sort_order.asc,id.asc'),\n]);return{ok:true,pages,sections,media,products,productImages,projects,settings:settingsObject(settings),menus:menus||[]}}",
      'visual bootstrap menus query'
    );

    const visualApiMarker = 'async function visualApi(req,res,url){';
    const helpers = `/* ${HEADER_MARKER} */
const headerDefaults={enabled:true,layout:'logo_right',sticky:true,shadow:true,background:'#fffdf8',text_color:'#1e2933',accent_color:'#b38b4d',border_color:'#eadfc9',max_width:1180,height:84,padding_x:16,logo_size:66,show_logo:true,show_name:true,show_city:true,name_size:18,city_size:12,menu_size:14,menu_gap:18,mobile_menu:true,cta_enabled:true,cta_label:'المتجر',cta_url:'/store',cta_background:'#b38b4d',cta_text_color:'#ffffff',cta_radius:12,announcement_enabled:false,announcement_text:'',announcement_label:'',announcement_url:'',announcement_background:'#0d2b46',announcement_text_color:'#ffffff',announcement_size:13};
const clampHeader=(value,min,max,fallback)=>{const number=Number(value);return Number.isFinite(number)?Math.max(min,Math.min(max,number)):fallback};
const headerColor=(value,fallback)=>/^#[0-9a-f]{6}$/i.test(String(value||''))?String(value):fallback;
const headerBool=(value,fallback=false)=>value===undefined?fallback:!!value;
function normalizeHeaderSettings(source={}){const input=source&&typeof source==='object'?source:{};return{enabled:headerBool(input.enabled,true),layout:['logo_right','centered','logo_left','compact'].includes(input.layout)?input.layout:'logo_right',sticky:headerBool(input.sticky,true),shadow:headerBool(input.shadow,true),background:headerColor(input.background,headerDefaults.background),text_color:headerColor(input.text_color,headerDefaults.text_color),accent_color:headerColor(input.accent_color,headerDefaults.accent_color),border_color:headerColor(input.border_color,headerDefaults.border_color),max_width:clampHeader(input.max_width,760,1600,1180),height:clampHeader(input.height,58,140,84),padding_x:clampHeader(input.padding_x,0,64,16),logo_size:clampHeader(input.logo_size,32,110,66),show_logo:headerBool(input.show_logo,true),show_name:headerBool(input.show_name,true),show_city:headerBool(input.show_city,true),name_size:clampHeader(input.name_size,12,34,18),city_size:clampHeader(input.city_size,9,24,12),menu_size:clampHeader(input.menu_size,11,24,14),menu_gap:clampHeader(input.menu_gap,4,46,18),mobile_menu:headerBool(input.mobile_menu,true),cta_enabled:headerBool(input.cta_enabled,true),cta_label:clean(input.cta_label||'المتجر').slice(0,80),cta_url:clean(input.cta_url||'/store').slice(0,500),cta_background:headerColor(input.cta_background,headerDefaults.cta_background),cta_text_color:headerColor(input.cta_text_color,headerDefaults.cta_text_color),cta_radius:clampHeader(input.cta_radius,0,40,12),announcement_enabled:headerBool(input.announcement_enabled,false),announcement_text:clean(input.announcement_text||'').slice(0,300),announcement_label:clean(input.announcement_label||'').slice(0,80),announcement_url:clean(input.announcement_url||'').slice(0,500),announcement_background:headerColor(input.announcement_background,headerDefaults.announcement_background),announcement_text_color:headerColor(input.announcement_text_color,headerDefaults.announcement_text_color),announcement_size:clampHeader(input.announcement_size,10,22,13)}}
function normalizeHeaderMenu(source={}){const input=source&&typeof source==='object'?source:{};return{location:'header',label:clean(input.label||'رابط جديد').slice(0,100),url:clean(input.url||'#').slice(0,500),sort_order:Math.max(0,Math.floor(Number(input.sort_order)||0)),published:input.published!==false,new_tab:!!input.new_tab}}
`;
    builderPatch = requireReplace(builderPatch, visualApiMarker, helpers + visualApiMarker, 'visual API helpers');

    const bootstrapHandler = "if(pathname==='/api/visual/bootstrap'&&req.method==='GET')return sendJson(res,200,await loadBootstrap());";
    const headerHandlers = `${bootstrapHandler}
    if(pathname==='/api/visual/settings/header'&&req.method==='PUT'){const parsed=await parseJson(req);const value=normalizeHeaderSettings(parsed?.value||parsed||{});const rows=await sb('waqf_settings?on_conflict=key',{method:'POST',body:{key:'header',value},prefer:'resolution=merge-duplicates,return=representation'});return sendJson(res,200,{ok:true,value:rows?.[0]?.value||value})}
    if(pathname==='/api/visual/menus'&&req.method==='POST'){const body=normalizeHeaderMenu(await parseJson(req));const rows=await sb('waqf_menu_items',{method:'POST',body});return sendJson(res,201,rows?.[0]||body)}
    let headerMenuMatch=pathname.match(/^\/api\/visual\/menus\/(\d+)$/);if(headerMenuMatch&&req.method==='PATCH'){const body=normalizeHeaderMenu(await parseJson(req));const rows=await sb(`waqf_menu_items?id=eq.${headerMenuMatch[1]}`,{method:'PATCH',body});return sendJson(res,200,rows?.[0]||body)}
    if(headerMenuMatch&&req.method==='DELETE'){await sb(`waqf_menu_items?id=eq.${headerMenuMatch[1]}`,{method:'DELETE',prefer:'return=minimal'});return sendJson(res,200,{ok:true})}`;
    builderPatch = requireReplace(builderPatch, bootstrapHandler, headerHandlers, 'visual header API handlers');

    const tabMarker = '<button class="vb-tab" data-tab="page">الصفحة</button>';
    builderPatch = requireReplace(
      builderPatch,
      tabMarker,
      `${tabMarker}<button class="vb-tab" data-tab="header">الشريط العلوي</button>`,
      'header editor tab'
    );

    const panelMarker = '<div class="vb-panel" data-panel="page"><div id="vbPagePanel"></div></div>';
    builderPatch = requireReplace(
      builderPatch,
      panelMarker,
      `${panelMarker}<div class="vb-panel" data-panel="header"><div id="vbHeaderPanel"></div></div>`,
      'header editor panel'
    );

    builderPatch = builderPatch.replaceAll('?v=9', '?v=10').replaceAll('?v=8', '?v=10');
    builderPatch = `/* ${HEADER_MARKER} */\n${builderPatch}`;
    await fs.writeFile(builderPatchPath, builderPatch);
  }

  if (!builderJs.includes(HEADER_MARKER)) {
    const renderPageMarker = 'function renderPageSelect(){';
    const headerEditorCode = `/* ${HEADER_MARKER} */
const HEADER_DEFAULTS={enabled:true,layout:'logo_right',sticky:true,shadow:true,background:'#fffdf8',text_color:'#1e2933',accent_color:'#b38b4d',border_color:'#eadfc9',max_width:1180,height:84,padding_x:16,logo_size:66,show_logo:true,show_name:true,show_city:true,name_size:18,city_size:12,menu_size:14,menu_gap:18,mobile_menu:true,cta_enabled:true,cta_label:'المتجر',cta_url:'/store',cta_background:'#b38b4d',cta_text_color:'#ffffff',cta_radius:12,announcement_enabled:false,announcement_text:'',announcement_label:'',announcement_url:'',announcement_background:'#0d2b46',announcement_text_color:'#ffffff',announcement_size:13};
function headerSettings(){const all=settings();all.header=Object.assign({},HEADER_DEFAULTS,all.header||{});return all.header}
function headerMenus(){return (state.data?.menus||[]).filter(item=>item.location==='header').sort((a,b)=>num(a.sort_order)-num(b.sort_order)||num(a.id)-num(b.id))}
function hField(label,key,value,type='text',attrs=''){if(type==='checkbox')return '<label class="vb-check"><input type="checkbox" data-header-field="'+key+'" '+(value?'checked':'')+'> '+esc(label)+'</label>';return '<div class="vb-field"><label>'+esc(label)+'</label><input type="'+type+'" data-header-field="'+key+'" value="'+esc(value??'')+'" '+attrs+'></div>'}
function hRange(label,key,value,min,max,step=1){return '<div class="vb-field"><label>'+esc(label)+'</label><div class="vb-range"><input type="range" data-header-field="'+key+'" value="'+num(value)+'" min="'+min+'" max="'+max+'" step="'+step+'"><output>'+num(value)+'</output></div></div>'}
function hSelect(label,key,value,options){return '<div class="vb-field"><label>'+esc(label)+'</label><select data-header-field="'+key+'">'+options.map(item=>'<option value="'+esc(item[0])+'" '+(String(item[0])===String(value)?'selected':'')+'>'+esc(item[1])+'</option>').join('')+'</select></div>'}
function headerStyleVars(h){return '--waqf-header-bg:'+h.background+';--waqf-header-text:'+h.text_color+';--waqf-header-accent:'+h.accent_color+';--waqf-header-border:'+h.border_color+';--waqf-header-max:'+num(h.max_width)+'px;--waqf-header-height:'+num(h.height)+'px;--waqf-header-pad:'+num(h.padding_x)+'px;--waqf-logo-size:'+num(h.logo_size)+'px;--waqf-name-size:'+num(h.name_size)+'px;--waqf-city-size:'+num(h.city_size)+'px;--waqf-menu-size:'+num(h.menu_size)+'px;--waqf-menu-gap:'+num(h.menu_gap)+'px;--waqf-cta-bg:'+h.cta_background+';--waqf-cta-text:'+h.cta_text_color+';--waqf-cta-radius:'+num(h.cta_radius)+'px;--waqf-announcement-bg:'+h.announcement_background+';--waqf-announcement-text:'+h.announcement_text_color+';--waqf-announcement-size:'+num(h.announcement_size)+'px';}
function headerLogoUrl(){const site=settings().site||{};return site.logo_media_id?'/media/'+site.logo_media_id:'/assets/logo.png'}
function renderHeaderPreview(){const h=headerSettings(),site=settings().site||{};if(h.enabled===false)return'';const menus=headerMenus().filter(item=>item.published!==false&&(!h.cta_enabled||String(item.url)!==String(h.cta_url)));const announcement=h.announcement_enabled&&h.announcement_text?'<div class="waqf-announcement"><span>'+esc(h.announcement_text)+'</span>'+(h.announcement_label&&h.announcement_url?'<a href="'+esc(h.announcement_url)+'">'+esc(h.announcement_label)+'</a>':'')+'</div>':'';const brand='<a class="waqf-header-brand" href="/">'+(h.show_logo?'<img class="waqf-header-logo" src="'+headerLogoUrl()+'" alt="'+esc(site.name||'وقف الأثر الجميل')+'">':'')+((h.show_name||h.show_city)?'<span>'+(h.show_name?'<strong>'+esc(site.name||'وقف الأثر الجميل')+'</strong>':'')+(h.show_city?'<small>'+esc(site.city||'مكة المكرمة')+'</small>':'')+'</span>':'')+'</a>';const menu='<div class="waqf-header-menu">'+menus.map(item=>'<a href="'+esc(item.url||'#')+'">'+esc(item.label||'رابط')+'</a>').join('')+(h.cta_enabled?'<a class="waqf-header-cta" href="'+esc(h.cta_url||'#')+'">'+esc(h.cta_label||'المتجر')+'</a>':'')+'</div>';return '<header class="waqf-custom-header waqf-header-layout-'+esc(h.layout)+' '+(h.sticky?'is-sticky ':'')+(h.shadow?'has-shadow ':'')+(h.mobile_menu?'has-mobile-menu':'')+'" style="'+headerStyleVars(h)+'">'+announcement+'<nav class="waqf-header-nav">'+brand+(h.mobile_menu?'<button class="waqf-header-toggle" type="button" onclick="this.closest(\'.waqf-custom-header\').classList.toggle(\'is-mobile-open\')" aria-label="فتح القائمة">☰</button>':'')+menu+'</nav></header>'}
function renderHeaderPanel(){const root=$('#vbHeaderPanel');if(!root)return;const h=headerSettings(),menus=headerMenus();root.innerHTML='<div class="vb-header-editor"><div class="vb-card is-open"><div class="vb-card-head"><div class="vb-card-icon">▤</div><div class="vb-card-title"><strong>إعدادات الشريط العلوي</strong><small>تظهر التعديلات في المعاينة وعلى جميع صفحات الموقع.</small></div></div><div class="vb-card-body" style="display:block"><div class="vb-header-grid">'+hSelect('تخطيط الشريط','layout',h.layout,[['logo_right','الشعار يمين'],['centered','مركزي'],['logo_left','الشعار يسار'],['compact','مضغوط']])+hField('لون الخلفية','background',h.background,'color')+hField('لون النصوص','text_color',h.text_color,'color')+hField('اللون المميز','accent_color',h.accent_color,'color')+hField('لون الفاصل','border_color',h.border_color,'color')+'</div><div class="vb-row-3">'+hRange('ارتفاع الشريط','height',h.height,58,140,1)+hRange('العرض الأقصى','max_width',h.max_width,760,1600,20)+hRange('المسافة الجانبية','padding_x',h.padding_x,0,64,1)+'</div><div class="vb-row-3">'+hRange('حجم الشعار','logo_size',h.logo_size,32,110,1)+hRange('حجم اسم الوقف','name_size',h.name_size,12,34,1)+hRange('حجم اسم المدينة','city_size',h.city_size,9,24,1)+'</div><div class="vb-row-3">'+hRange('حجم روابط القائمة','menu_size',h.menu_size,11,24,1)+hRange('المسافة بين الروابط','menu_gap',h.menu_gap,4,46,1)+hRange('استدارة زر المتجر','cta_radius',h.cta_radius,0,40,1)+'</div><div class="vb-check-grid">'+hField('إظهار الشريط','enabled',h.enabled,'checkbox')+hField('تثبيت الشريط عند التمرير','sticky',h.sticky,'checkbox')+hField('إظهار الظل','shadow',h.shadow,'checkbox')+hField('تفعيل قائمة الجوال','mobile_menu',h.mobile_menu,'checkbox')+hField('إظهار الشعار','show_logo',h.show_logo,'checkbox')+hField('إظهار اسم الوقف','show_name',h.show_name,'checkbox')+hField('إظهار المدينة','show_city',h.show_city,'checkbox')+'</div></div></div><div class="vb-card is-open"><div class="vb-card-head"><div class="vb-card-icon">◆</div><div class="vb-card-title"><strong>زر الإجراء الرئيسي</strong><small>يمكن استخدامه للمتجر أو المساهمة أو أي صفحة مهمة.</small></div></div><div class="vb-card-body" style="display:block"><div class="vb-check-grid">'+hField('إظهار الزر الرئيسي','cta_enabled',h.cta_enabled,'checkbox')+'</div><div class="vb-row">'+hField('نص الزر','cta_label',h.cta_label)+hField('رابط الزر','cta_url',h.cta_url)+'</div><div class="vb-row">'+hField('لون الزر','cta_background',h.cta_background,'color')+hField('لون نص الزر','cta_text_color',h.cta_text_color,'color')+'</div></div></div><div class="vb-card is-open"><div class="vb-card-head"><div class="vb-card-icon">✦</div><div class="vb-card-title"><strong>شريط الإعلان</strong><small>رسالة قصيرة تظهر أعلى القائمة الرئيسية.</small></div></div><div class="vb-card-body" style="display:block"><div class="vb-check-grid">'+hField('تفعيل شريط الإعلان','announcement_enabled',h.announcement_enabled,'checkbox')+'</div>'+hField('نص الإعلان','announcement_text',h.announcement_text)+ '<div class="vb-row">'+hField('نص الرابط','announcement_label',h.announcement_label)+hField('رابط الإعلان','announcement_url',h.announcement_url)+'</div><div class="vb-row-3">'+hField('لون الخلفية','announcement_background',h.announcement_background,'color')+hField('لون النص','announcement_text_color',h.announcement_text_color,'color')+hRange('حجم النص','announcement_size',h.announcement_size,10,22,1)+'</div></div></div><div class="vb-card is-open"><div class="vb-card-head"><div class="vb-card-icon">☰</div><div class="vb-card-title"><strong>روابط القائمة العلوية</strong><small>عدّل النص والرابط والترتيب، أو أخفِ الرابط من الموقع.</small></div><button type="button" class="vb-btn vb-btn-sm vb-btn-gold" id="vbAddHeaderMenu">+ إضافة رابط</button></div><div class="vb-card-body" style="display:block"><div class="vb-header-menu-editor">'+(menus.length?menus.map((item,index)=>'<article class="vb-header-menu-item" data-menu-id="'+item.id+'"><div class="vb-header-menu-order"><button type="button" data-menu-up title="لأعلى">↑</button><button type="button" data-menu-down title="لأسفل">↓</button></div><div class="vb-field"><label>اسم الرابط</label><input data-menu-field="label" value="'+esc(item.label||'')+'"></div><div class="vb-field"><label>الرابط</label><input data-menu-field="url" value="'+esc(item.url||'')+'"></div><label class="vb-check"><input type="checkbox" data-menu-field="published" '+(item.published!==false?'checked':'')+'> ظاهر</label><label class="vb-check"><input type="checkbox" data-menu-field="new_tab" '+(item.new_tab?'checked':'')+'> نافذة جديدة</label><button type="button" class="vb-mini" data-menu-delete title="حذف">×</button></article>').join(''):'<div class="vb-empty">لا توجد روابط في القائمة العلوية.</div>')+'</div></div></div></div>';bindHeaderPanel(root)}
function bindHeaderPanel(root){$$('[data-header-field]',root).forEach(input=>{const handler=()=>{const h=headerSettings(),key=input.dataset.headerField;let value=input.type==='checkbox'?input.checked:(input.type==='range'||input.type==='number'?Number(input.value):input.value);h[key]=value;if(input.type==='range'&&input.nextElementSibling)input.nextElementSibling.textContent=input.value;markHeader();};input.addEventListener('input',handler);input.addEventListener('change',handler)});const add=$('#vbAddHeaderMenu',root);if(add)add.addEventListener('click',createHeaderMenu);$$('[data-menu-id]',root).forEach(card=>{const item=(state.data.menus||[]).find(row=>String(row.id)===String(card.dataset.menuId));if(!item)return;$$('[data-menu-field]',card).forEach(input=>{const handler=()=>{item[input.dataset.menuField]=input.type==='checkbox'?input.checked:input.value;markHeaderMenu(item)};input.addEventListener('input',handler);input.addEventListener('change',handler)});const up=$('[data-menu-up]',card),down=$('[data-menu-down]',card),remove=$('[data-menu-delete]',card);if(up)up.addEventListener('click',()=>moveHeaderMenu(item.id,-1));if(down)down.addEventListener('click',()=>moveHeaderMenu(item.id,1));if(remove)remove.addEventListener('click',()=>deleteHeaderMenu(item.id))})}
function markHeader(){state.headerDirty=true;status('saving','جارٍ حفظ الشريط العلوي');clearTimeout(state.saveTimers.get('header'));state.saveTimers.set('header',setTimeout(()=>saveHeaderSettings(),550));renderPreview()}
async function saveHeaderSettings(force=false){if(!state.headerDirty&&!force)return;clearTimeout(state.saveTimers.get('header'));try{const result=await api('/settings/header',{method:'PUT',body:JSON.stringify({value:headerSettings()})});state.data.settings.header=result.value||headerSettings();state.headerDirty=false;status('saved','تم حفظ الشريط العلوي')}catch(error){status('error','فشل حفظ الشريط العلوي');toast(error.message,true)}}
function markHeaderMenu(item){if(!state.menuTimers)state.menuTimers=new Map();clearTimeout(state.menuTimers.get(item.id));state.menuTimers.set(item.id,setTimeout(()=>saveHeaderMenu(item),500));renderPreview()}
async function saveHeaderMenu(item){try{const saved=await api('/menus/'+item.id,{method:'PATCH',body:JSON.stringify(item)});Object.assign(item,saved);status('saved','تم حفظ روابط القائمة')}catch(error){status('error','فشل حفظ الرابط');toast(error.message,true)}}
async function createHeaderMenu(){try{const menus=headerMenus(),created=await api('/menus',{method:'POST',body:JSON.stringify({label:'رابط جديد',url:'#',sort_order:menus.length+1,published:true,new_tab:false})});state.data.menus=state.data.menus||[];state.data.menus.push(created);renderHeaderPanel();renderPreview();toast('تمت إضافة رابط جديد')}catch(error){toast(error.message,true)}}
async function deleteHeaderMenu(id){if(!confirm('حذف هذا الرابط من الشريط العلوي؟'))return;try{await api('/menus/'+id,{method:'DELETE'});state.data.menus=(state.data.menus||[]).filter(item=>String(item.id)!==String(id));renderHeaderPanel();renderPreview();toast('تم حذف الرابط')}catch(error){toast(error.message,true)}}
async function moveHeaderMenu(id,delta){const menus=headerMenus(),index=menus.findIndex(item=>String(item.id)===String(id)),target=index+delta;if(index<0||target<0||target>=menus.length)return;[menus[index],menus[target]]=[menus[target],menus[index]];menus.forEach((item,i)=>item.sort_order=i+1);renderHeaderPanel();renderPreview();try{await Promise.all(menus.map(item=>api('/menus/'+item.id,{method:'PATCH',body:JSON.stringify(item)})));status('saved','تم حفظ ترتيب القائمة')}catch(error){toast(error.message,true)}}
`;
    builderJs = requireReplace(builderJs, renderPageMarker, headerEditorCode + renderPageMarker, 'header editor runtime');

    builderJs = requireReplace(
      builderJs,
      'function renderAll(){renderPageSelect();renderPagePanel();renderSections();renderInspector();renderPreview();updateUndoButtons()}',
      'function renderAll(){renderPageSelect();renderPagePanel();renderHeaderPanel();renderSections();renderInspector();renderPreview();updateUndoButtons()}',
      'header panel render call'
    );

    builderJs = requireReplace(
      builderJs,
      '<body><main id="visualPageRoot">${html}</main>',
      '<body>${renderHeaderPreview()}<main id="visualPageRoot">${html}</main>',
      'header preview markup'
    );

    builderJs = requireReplace(
      builderJs,
      'await Promise.all([savePage(),...[...state.dirtySections].map(saveSection)]);',
      'await Promise.all([saveHeaderSettings(true),savePage(),...[...state.dirtySections].map(saveSection)]);',
      'save-all header integration'
    );

    builderJs = `/* ${HEADER_MARKER} */\n${builderJs}`;
    await fs.writeFile(builderJsPath, builderJs);
  }

  if (!publicCss.includes(HEADER_MARKER)) {
    publicCss += `\n\n/* ${HEADER_MARKER} */
.waqf-custom-header{position:relative;z-index:1000;background:var(--waqf-header-bg,#fffdf8);color:var(--waqf-header-text,#1e2933);border-bottom:1px solid var(--waqf-header-border,#eadfc9);font-family:'Cairo',Tahoma,Arial,sans-serif}
.waqf-custom-header.is-sticky{position:sticky;top:0}.waqf-custom-header.has-shadow{box-shadow:0 12px 32px rgba(13,43,70,.10)}
.waqf-announcement{min-height:34px;padding:6px 18px;background:var(--waqf-announcement-bg,#0d2b46);color:var(--waqf-announcement-text,#fff);display:flex;align-items:center;justify-content:center;gap:12px;text-align:center;font-size:var(--waqf-announcement-size,13px);font-weight:700}.waqf-announcement a{color:inherit;text-decoration:underline;text-underline-offset:3px;font-weight:900}
.waqf-header-nav{width:min(var(--waqf-header-max,1180px),calc(100% - (var(--waqf-header-pad,16px)*2)));min-height:var(--waqf-header-height,84px);margin:auto;display:flex;align-items:center;gap:24px;position:relative}
.waqf-header-brand{display:flex;align-items:center;gap:12px;margin-left:auto;text-decoration:none;color:var(--waqf-header-text,#1e2933);min-width:0}.waqf-header-logo{width:var(--waqf-logo-size,66px);height:var(--waqf-logo-size,66px);object-fit:contain;flex:0 0 auto}.waqf-header-brand strong{display:block;font-size:var(--waqf-name-size,18px);line-height:1.35;color:var(--waqf-header-text,#1e2933);white-space:nowrap}.waqf-header-brand small{display:block;font-size:var(--waqf-city-size,12px);color:var(--waqf-header-accent,#b38b4d);white-space:nowrap}
.waqf-header-menu{display:flex;align-items:center;gap:var(--waqf-menu-gap,18px);font-size:var(--waqf-menu-size,14px);font-weight:800}.waqf-header-menu>a:not(.waqf-header-cta){color:var(--waqf-header-text,#1e2933);text-decoration:none;white-space:nowrap;transition:color .18s ease,transform .18s ease}.waqf-header-menu>a:not(.waqf-header-cta):hover{color:var(--waqf-header-accent,#b38b4d);transform:translateY(-1px)}
.waqf-header-cta{display:inline-flex;align-items:center;justify-content:center;padding:10px 17px;border-radius:var(--waqf-cta-radius,12px);background:var(--waqf-cta-bg,#b38b4d);color:var(--waqf-cta-text,#fff)!important;text-decoration:none;white-space:nowrap;box-shadow:0 9px 22px color-mix(in srgb,var(--waqf-cta-bg,#b38b4d) 28%,transparent)}
.waqf-header-toggle{display:none;width:43px;height:43px;border-radius:12px;border:1px solid var(--waqf-header-border,#eadfc9);background:color-mix(in srgb,var(--waqf-header-bg,#fffdf8) 86%,#fff);color:var(--waqf-header-text,#1e2933);font:900 20px/1 'Cairo',sans-serif;cursor:pointer}
.waqf-header-layout-logo_left .waqf-header-brand{order:3;margin-left:0;margin-right:auto}.waqf-header-layout-logo_left .waqf-header-menu{order:1}.waqf-header-layout-logo_left .waqf-header-toggle{order:2}
.waqf-header-layout-centered .waqf-header-nav{justify-content:center;flex-wrap:wrap;padding-block:10px}.waqf-header-layout-centered .waqf-header-brand{width:100%;justify-content:center;margin:0}.waqf-header-layout-centered .waqf-header-menu{justify-content:center}
.waqf-header-layout-compact .waqf-header-nav{min-height:min(var(--waqf-header-height,72px),72px)}.waqf-header-layout-compact .waqf-header-logo{width:min(var(--waqf-logo-size,52px),52px);height:min(var(--waqf-logo-size,52px),52px)}
@media(max-width:900px){.waqf-header-nav{width:min(var(--waqf-header-max,1180px),calc(100% - 24px));min-height:max(68px,var(--waqf-header-height,74px));gap:12px}.waqf-header-toggle{display:grid;place-items:center;margin-right:auto}.waqf-header-menu{display:none;position:absolute;top:calc(100% + 8px);right:0;left:0;z-index:20;flex-direction:column;align-items:stretch;gap:4px;padding:12px;border-radius:16px;background:var(--waqf-header-bg,#fffdf8);border:1px solid var(--waqf-header-border,#eadfc9);box-shadow:0 20px 45px rgba(13,43,70,.18)}.waqf-custom-header.is-mobile-open .waqf-header-menu{display:flex}.waqf-header-menu a{padding:10px 12px;border-radius:10px}.waqf-header-cta{margin-top:4px}.waqf-header-layout-centered .waqf-header-brand{width:auto;margin-left:auto}.waqf-header-layout-centered .waqf-header-nav{flex-wrap:nowrap}.waqf-header-layout-logo_left .waqf-header-brand{order:0;margin-right:0;margin-left:auto}.waqf-header-layout-logo_left .waqf-header-toggle{order:0}.waqf-header-brand strong{font-size:min(var(--waqf-name-size,18px),18px)}.waqf-header-logo{width:min(var(--waqf-logo-size,58px),58px);height:min(var(--waqf-logo-size,58px),58px)}}
@media(max-width:520px){.waqf-header-brand small{display:none}.waqf-announcement{font-size:min(var(--waqf-announcement-size,12px),12px);padding-inline:12px}.waqf-header-brand strong{max-width:180px;overflow:hidden;text-overflow:ellipsis}}
`;
    await fs.writeFile(publicCssPath, publicCss);
  }

  if (!builderCss.includes(HEADER_MARKER)) {
    builderCss += `\n\n/* ${HEADER_MARKER} */
.vb-header-editor{display:grid;gap:14px}.vb-header-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}.vb-check-grid{display:flex;flex-wrap:wrap;gap:8px 16px;padding:10px 0}.vb-header-menu-editor{display:grid;gap:9px}.vb-header-menu-item{display:grid;grid-template-columns:auto minmax(130px,.8fr) minmax(180px,1.4fr) auto auto auto;gap:8px;align-items:end;padding:12px;border:1px solid var(--vb-line);border-radius:14px;background:#fff}.vb-header-menu-item .vb-field{margin:0}.vb-header-menu-order{display:grid;gap:4px;align-self:center}.vb-header-menu-order button{width:30px;height:28px;border:1px solid var(--vb-line);border-radius:8px;background:#fff;color:var(--vb-navy);cursor:pointer}.vb-header-menu-order button:hover{border-color:var(--vb-gold);color:var(--vb-gold)}
@media(max-width:1100px){.vb-header-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.vb-header-menu-item{grid-template-columns:auto 1fr 1fr auto}.vb-header-menu-item .vb-check{grid-row:2}}
@media(max-width:720px){.vb-header-grid{grid-template-columns:1fr 1fr}.vb-header-menu-item{grid-template-columns:auto 1fr}.vb-header-menu-item .vb-field{grid-column:2}.vb-header-menu-item .vb-check{grid-column:2}.vb-header-menu-item>[data-menu-delete]{grid-column:1;grid-row:1}}
`;
    await fs.writeFile(builderCssPath, builderCss);
  }
}
