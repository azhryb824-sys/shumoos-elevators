import { promises as fs } from 'node:fs';
import path from 'node:path';

const SECTION_TYPES_MARKER = 'WAQF_VISUAL_SECTION_TYPES_V1';

function requireReplace(source, searchValue, replacement, label) {
  if (source.includes(replacement)) return source;
  if (!source.includes(searchValue)) throw new Error(`Section-types patch target not found: ${label}`);
  return source.replace(searchValue, replacement);
}

function requireReplaceAll(source, searchValue, replacement, label) {
  if (source.includes(replacement)) return source;
  if (!source.includes(searchValue)) throw new Error(`Section-types patch target not found: ${label}`);
  return source.replaceAll(searchValue, replacement);
}

export async function applySectionTypesRuntimePatch(runtimeDir) {
  const publicJsPath = path.join(runtimeDir, 'visual-public.js');
  const publicCssPath = path.join(runtimeDir, 'visual-public.css');
  const builderJsPath = path.join(runtimeDir, 'visual-builder.js');
  const builderCssPath = path.join(runtimeDir, 'visual-builder.css');
  const builderPatchPath = path.join(runtimeDir, 'visual-builder-patch.mjs');

  let publicJs = await fs.readFile(publicJsPath, 'utf8');
  let publicCss = await fs.readFile(publicCssPath, 'utf8');
  let builderJs = await fs.readFile(builderJsPath, 'utf8');
  let builderCss = await fs.readFile(builderCssPath, 'utf8');
  let builderPatch = await fs.readFile(builderPatchPath, 'utf8');

  if (!publicJs.includes(SECTION_TYPES_MARKER)) {
    const renderMarker = 'function renderSection(s,state){';
    const renderers = `/* ${SECTION_TYPES_MARKER} */
function renderExtendedSectionHead(s){
  if(!s.title&&!s.subtitle)return'';
  return '<div class="wb-section-head">'+(s.title?'<h2 class="wb-title">'+esc(s.title)+'</h2>':'')+(s.subtitle?'<p class="wb-subtitle">'+esc(s.subtitle)+'</p>':'')+'</div>';
}
function renderPartners(s){
  const c=s.content||{},d=s.design||{},items=normalizeItems(c);
  const entries=items.map((x,i)=>{
    const logo=x.media_id?imageHtml(x.media_id,x.title||s.title,'wb-partner-image'):'<div class="wb-partner-placeholder">'+esc(String(x.title||'شريك').slice(0,2))+'</div>';
    const body='<div class="wb-partner-logo">'+logo+'</div><strong>'+esc(x.title||'شريك أثر')+'</strong>'+(x.text||x.description?'<span>'+esc(x.text||x.description)+'</span>':'');
    return x.url?'<a class="wb-partner" href="'+attr(x.url)+'" rel="noopener">'+body+'</a>':'<article class="wb-partner">'+body+'</article>';
  }).join('');
  return '<section class="'+sectionClass(s)+'" style="'+cssVars(d)+'" data-section-id="'+s.id+'"><div class="wb-container">'+renderExtendedSectionHead(s)+(entries?'<div class="wb-partners-grid">'+entries+'</div>':'<div class="wb-empty">أضف شعارات الشركاء من المحرر المرئي.</div>')+'</div></section>';
}
function renderSteps(s){
  const c=s.content||{},d=s.design||{},items=normalizeItems(c);
  const entries=items.map((x,i)=>'<article class="wb-step"><div class="wb-step-number">'+esc(x.icon||String(i+1))+'</div><div class="wb-step-copy"><h3>'+esc(x.title||('الخطوة '+(i+1)))+'</h3><p>'+esc(x.text||x.description||'')+'</p></div></article>').join('');
  return '<section class="'+sectionClass(s)+'" style="'+cssVars(d)+'" data-section-id="'+s.id+'"><div class="wb-container">'+renderExtendedSectionHead(s)+(entries?'<div class="wb-steps">'+entries+'</div>':'<div class="wb-empty">أضف خطوات العمل من المحرر.</div>')+'</div></section>';
}
function renderTestimonials(s){
  const c=s.content||{},d=s.design||{},items=normalizeItems(c);
  const entries=items.map(x=>'<blockquote class="wb-testimonial"><div class="wb-quote-mark">“</div><p>'+esc(x.text||x.description||'')+'</p><footer><strong>'+esc(x.title||'جهة داعمة')+'</strong>'+(x.label?'<span>'+esc(x.label)+'</span>':'')+'</footer></blockquote>').join('');
  return '<section class="'+sectionClass(s)+'" style="'+cssVars(d)+'" data-section-id="'+s.id+'"><div class="wb-container">'+renderExtendedSectionHead(s)+(entries?'<div class="wb-testimonials">'+entries+'</div>':'<div class="wb-empty">أضف الآراء والتوصيات من المحرر.</div>')+'</div></section>';
}
`;
    if (!publicJs.includes(renderMarker)) throw new Error('Section-types public renderer insertion point was not found.');
    publicJs = publicJs.replace(renderMarker, renderers + renderMarker);
    publicJs = requireReplace(
      publicJs,
      "case'cards':return renderCards(s);",
      "case'cards':case'features':return renderCards(s);case'partners':return renderPartners(s);case'steps':return renderSteps(s);case'testimonials':return renderTestimonials(s);",
      'public section cases'
    );
    publicJs = requireReplace(
      publicJs,
      "case'cta':return renderCta(s);",
      "case'cta':case'banner':case'contact':return renderCta(s);",
      'public CTA aliases'
    );
    await fs.writeFile(publicJsPath, publicJs);
  }

  if (!publicCss.includes(SECTION_TYPES_MARKER)) {
    publicCss += `\n\n/* ${SECTION_TYPES_MARKER} */
.wb-partners-grid{display:grid;grid-template-columns:repeat(var(--section-columns),minmax(0,1fr));gap:var(--section-gap)}
.wb-partner{min-height:150px;border:1px solid color-mix(in srgb,var(--section-accent) 22%,transparent);border-radius:var(--section-radius);background:color-mix(in srgb,var(--section-bg) 88%,#fff);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:22px;text-align:center;text-decoration:none;color:var(--section-text);box-shadow:var(--section-shadow);transition:transform .2s ease,border-color .2s ease,box-shadow .2s ease}
.wb-partner:hover{transform:translateY(-4px);border-color:color-mix(in srgb,var(--section-accent) 58%,transparent)}
.wb-partner-logo{height:74px;width:100%;display:grid;place-items:center}.wb-partner-logo img{max-width:100%;max-height:72px;object-fit:contain}.wb-partner strong{font-size:16px}.wb-partner span{font-size:12px;color:color-mix(in srgb,var(--section-text) 65%,transparent);line-height:1.7}.wb-partner-placeholder{width:64px;height:64px;border-radius:18px;display:grid;place-items:center;background:color-mix(in srgb,var(--section-accent) 14%,transparent);color:var(--section-accent);font-weight:900;font-size:20px}
.wb-layout-strip .wb-partners-grid{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:8px}.wb-layout-strip .wb-partner{min-width:210px;scroll-snap-align:start}.wb-layout-monochrome .wb-partner-logo img{filter:grayscale(1);opacity:.72}.wb-layout-monochrome .wb-partner:hover .wb-partner-logo img{filter:none;opacity:1}.wb-layout-framed .wb-partner{border-width:2px;background:transparent}
.wb-steps{display:grid;grid-template-columns:repeat(var(--section-columns),minmax(0,1fr));gap:var(--section-gap);counter-reset:waqf-step}.wb-step{position:relative;display:flex;gap:16px;align-items:flex-start;border-radius:var(--section-radius);padding:22px;background:color-mix(in srgb,var(--section-bg) 88%,#fff);border:1px solid color-mix(in srgb,var(--section-accent) 20%,transparent);box-shadow:var(--section-shadow)}.wb-step-number{flex:0 0 46px;height:46px;border-radius:15px;display:grid;place-items:center;background:var(--section-accent);color:#fff;font-weight:900}.wb-step-copy h3{margin:0 0 7px;font-size:18px}.wb-step-copy p{margin:0;color:color-mix(in srgb,var(--section-text) 72%,transparent);line-height:1.85}.wb-layout-vertical .wb-steps{grid-template-columns:1fr}.wb-layout-vertical .wb-step{max-width:850px}.wb-layout-timeline .wb-steps{grid-template-columns:1fr;position:relative}.wb-layout-timeline .wb-steps:before{content:'';position:absolute;right:23px;top:18px;bottom:18px;width:2px;background:color-mix(in srgb,var(--section-accent) 42%,transparent)}.wb-layout-timeline .wb-step{background:transparent;box-shadow:none;border:0;padding:10px 0}.wb-layout-timeline .wb-step-number{z-index:1;border:5px solid var(--section-bg)}.wb-layout-cards .wb-step{min-height:180px;flex-direction:column}
.wb-testimonials{display:grid;grid-template-columns:repeat(var(--section-columns),minmax(0,1fr));gap:var(--section-gap)}.wb-testimonial{margin:0;position:relative;border-radius:var(--section-radius);padding:28px;background:color-mix(in srgb,var(--section-bg) 88%,#fff);border:1px solid color-mix(in srgb,var(--section-accent) 22%,transparent);box-shadow:var(--section-shadow);color:var(--section-text)}.wb-quote-mark{font-size:54px;line-height:.75;color:var(--section-accent);font-family:Georgia,serif}.wb-testimonial p{font-size:16px;line-height:1.95;margin:15px 0 22px}.wb-testimonial footer{display:flex;flex-direction:column;gap:3px}.wb-testimonial footer strong{font-size:15px}.wb-testimonial footer span{font-size:12px;color:color-mix(in srgb,var(--section-text) 62%,transparent)}.wb-layout-quote .wb-testimonials{grid-template-columns:minmax(0,760px);justify-content:center}.wb-layout-quote .wb-testimonial{text-align:center;padding:42px}.wb-layout-horizontal .wb-testimonials{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:8px}.wb-layout-horizontal .wb-testimonial{min-width:min(430px,86vw);scroll-snap-align:start}
.wb-banner .wb-cta,.wb-contact .wb-cta{border:1px solid color-mix(in srgb,var(--section-accent) 26%,transparent)}
@media(max-width:900px){.wb-partners-grid,.wb-steps,.wb-testimonials{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:620px){.wb-partners-grid,.wb-steps,.wb-testimonials{grid-template-columns:1fr}.wb-step{padding:18px}.wb-partner{min-height:130px}}
`;
    await fs.writeFile(publicCssPath, publicCss);
  }

  if (!builderJs.includes(SECTION_TYPES_MARKER)) {
    const stateMarker = 'const state={';
    const extensions = `/* ${SECTION_TYPES_MARKER} */
Object.assign(TYPES,{
  partners:['الشركاء','◆'],
  steps:['خطوات العمل','➜'],
  testimonials:['آراء الداعمين','❝'],
  features:['المزايا والخدمات','✦'],
  banner:['شريط إعلاني','▰'],
  contact:['قسم التواصل','☎']
});
Object.assign(LAYOUTS,{
  partners:[['default','شبكة شعارات','grid'],['strip','شريط أفقي','band'],['monochrome','أحادي اللون','grid'],['framed','إطارات فاخرة','grid']],
  steps:[['horizontal','خطوات أفقية','grid'],['vertical','قائمة رأسية','split'],['timeline','خط زمني','band'],['cards','بطاقات كبيرة','grid']],
  testimonials:[['default','شبكة آراء','grid'],['quote','اقتباس بارز','centered'],['horizontal','تمرير أفقي','band']],
  features:[['default','شبكة مزايا','grid'],['staggered','بطاقات متدرجة','grid'],['horizontal','شريط أفقي','split'],['featured','ميزة رئيسية','grid']],
  banner:[['default','شريط دعوة','split'],['centered','مركزي','centered'],['outline','إطار فاخر','centered']],
  contact:[['default','نص واتصال','split'],['centered','تواصل مركزي','centered'],['outline','إطار تواصل','centered']]
});
Object.assign(DEFAULTS,{
  partners:{title:'شركاء الأثر',subtitle:'نعتز بالجهات التي تشاركنا صناعة أثرٍ مستدام',content:{items:[{media_id:null,title:'شريك الأثر',text:'جهة شريكة',url:''},{media_id:null,title:'شريك الأثر',text:'جهة شريكة',url:''},{media_id:null,title:'شريك الأثر',text:'جهة شريكة',url:''},{media_id:null,title:'شريك الأثر',text:'جهة شريكة',url:''}]},design:{layout:'default',background:'#fffdf8',text:'#1e2933',accent:'#b38b4d',padding:72,radius:20,columns:4,gap:18,alignment:'center',max_width:1180,shadow:false}},
  steps:{title:'كيف نصنع الأثر؟',subtitle:'خطوات واضحة من الفكرة إلى الأثر الموثق',content:{items:[{icon:'1',title:'اختيار المشروع',text:'تحديد الاحتياج والأولوية.'},{icon:'2',title:'التنفيذ والمتابعة',text:'إدارة العمل وفق مراحل واضحة.'},{icon:'3',title:'التوثيق والتقرير',text:'نشر النتائج ومؤشرات الأثر.'}]},design:{layout:'horizontal',background:'#f7f3ea',text:'#1e2933',accent:'#b38b4d',padding:72,radius:20,columns:3,gap:22,alignment:'right',max_width:1180,shadow:true}},
  testimonials:{title:'قالوا عن الأثر الجميل',subtitle:'آراء الجهات والداعمين',content:{items:[{title:'جهة داعمة',label:'شريك أثر',text:'تجربة منظمة وشفافة تعكس احترافية إدارة المبادرات.'},{title:'متبرع',label:'مساهم',text:'سهولة المتابعة ووضوح التقارير عززا الثقة في المشروع.'},{title:'شريك مجتمعي',label:'شريك تنفيذ',text:'تعاون مميز وأثر قابل للقياس والتوثيق.'}]},design:{layout:'default',background:'#fffdf8',text:'#1e2933',accent:'#b38b4d',padding:72,radius:22,columns:3,gap:22,alignment:'right',max_width:1180,shadow:true}},
  features:{title:'لماذا وقف الأثر الجميل؟',subtitle:'منظومة متكاملة لإدارة الأثر',content:{items:[{icon:'✦',title:'شفافية موثقة',text:'تقارير واضحة ومؤشرات قابلة للمتابعة.',url:'',label:''},{icon:'◎',title:'استدامة',text:'مشاريع مصممة ليستمر نفعها.',url:'',label:''},{icon:'✓',title:'إدارة احترافية',text:'حوكمة ومتابعة دقيقة لكل مرحلة.',url:'',label:''}]},design:{layout:'default',background:'#f7f3ea',text:'#1e2933',accent:'#b38b4d',padding:72,radius:20,columns:3,gap:22,alignment:'center',max_width:1180,shadow:true}},
  banner:{title:'كن جزءًا من أثرٍ يبقى',subtitle:'',content:{body:'ساهم في مشروع أو تسوّق من متجر الأثر الجميل.',primary_label:'ساهم الآن',primary_url:'/projects',secondary_label:'زيارة المتجر',secondary_url:'/store'},design:{layout:'centered',background:'#0d2b46',text:'#ffffff',accent:'#b38b4d',padding:58,radius:24,columns:2,gap:24,alignment:'center',max_width:1180,shadow:true}},
  contact:{title:'تواصل معنا',subtitle:'نسعد بالشراكات والاستفسارات',content:{body:'فريق وقف الأثر الجميل جاهز لخدمتكم والإجابة عن استفساراتكم.',primary_label:'تواصل الآن',primary_url:'/contact',secondary_label:'واتساب',secondary_url:'#'},design:{layout:'default',background:'#fffdf8',text:'#1e2933',accent:'#b38b4d',padding:64,radius:24,columns:2,gap:28,alignment:'right',max_width:1180,shadow:true}}
});
`;
    if (!builderJs.includes(stateMarker)) throw new Error('Section-types builder insertion point was not found.');
    builderJs = builderJs.replace(stateMarker, extensions + stateMarker);

    const contentMarker = 'function contentFields(s){';
    const specialRepeater = `function specialSectionRepeater(s){
  const items=Array.isArray(s.content?.items)?s.content.items:[],type=s.section_type;
  const heading=type==='partners'?'الشركاء':type==='steps'?'الخطوات':'الآراء والتوصيات';
  return '<div class="vb-section-toolbar"><h3>'+heading+'</h3><button class="vb-btn vb-btn-sm vb-btn-light" data-add-item>+ عنصر</button></div><div class="vb-repeater">'+items.map((item,i)=>{
    let fields='';
    if(type==='partners')fields='<div class="vb-field"><label>شعار الشريك</label>'+mediaField(item.media_id,'content.items.'+i+'.media_id')+'</div>'+field('اسم الشريك','content.items.'+i+'.title',item.title)+field('وصف مختصر','content.items.'+i+'.text',item.text,'textarea')+field('رابط الشريك','content.items.'+i+'.url',item.url);
    else if(type==='steps')fields=field('الرقم أو الأيقونة','content.items.'+i+'.icon',item.icon)+field('عنوان الخطوة','content.items.'+i+'.title',item.title)+field('وصف الخطوة','content.items.'+i+'.text',item.text,'textarea');
    else fields=field('اسم الجهة أو صاحب الرأي','content.items.'+i+'.title',item.title)+field('الصفة','content.items.'+i+'.label',item.label)+field('نص الرأي','content.items.'+i+'.text',item.text,'textarea');
    return '<div class="vb-repeater-item" data-item="'+i+'"><div class="vb-repeater-head"><strong>العنصر '+(i+1)+'</strong><button class="vb-mini" data-item-up="'+i+'">↑</button><button class="vb-mini" data-item-down="'+i+'">↓</button><button class="vb-mini" data-item-delete="'+i+'" style="color:var(--vb-danger)">×</button></div>'+fields+'</div>';
  }).join('')+'</div>';
}
`;
    if (!builderJs.includes(contentMarker)) throw new Error('Section-types content editor insertion point was not found.');
    builderJs = builderJs.replace(contentMarker, specialRepeater + contentMarker);

    builderJs = requireReplaceAll(
      builderJs,
      "['hero','text','image_text','cta']",
      "['hero','text','image_text','cta','banner','contact']",
      'body-capable section types'
    );
    builderJs = requireReplaceAll(
      builderJs,
      "['hero','image_text','cta']",
      "['hero','image_text','cta','banner','contact']",
      'button-capable section types'
    );
    builderJs = requireReplace(
      builderJs,
      "if(['cards','gallery','stats','faq'].includes(s.section_type))html+=repeater(s);",
      "if(['partners','steps','testimonials'].includes(s.section_type))html+=specialSectionRepeater(s);else if(['cards','gallery','stats','faq','features'].includes(s.section_type))html+=repeater(s);",
      'special section repeaters'
    );
    await fs.writeFile(builderJsPath, builderJs);
  }

  if (!builderCss.includes(SECTION_TYPES_MARKER)) {
    builderCss += `\n\n/* ${SECTION_TYPES_MARKER} */
.vb-library-card[data-add-type="partners"] .vb-library-icon,.vb-library-card[data-add-type="banner"] .vb-library-icon{background:linear-gradient(135deg,#b38b4d,#d8bd83);color:#fff}
.vb-library-card[data-add-type="steps"] .vb-library-icon,.vb-library-card[data-add-type="features"] .vb-library-icon{background:linear-gradient(135deg,#0d2b46,#1c547d);color:#fff}
.vb-library-card[data-add-type="testimonials"] .vb-library-icon,.vb-library-card[data-add-type="contact"] .vb-library-icon{background:linear-gradient(135deg,#6d5131,#b38b4d);color:#fff}
`;
    await fs.writeFile(builderCssPath, builderCss);
  }

  if (!builderPatch.includes('?v=9')) {
    builderPatch = builderPatch.replaceAll('?v=8', '?v=9').replaceAll('?v=7', '?v=9').replaceAll('?v=6', '?v=9');
    await fs.writeFile(builderPatchPath, builderPatch);
  }
}