import { promises as fs } from 'node:fs';
import path from 'node:path';

const FONT_MARKER = 'WAQF_VISUAL_FONT_CONTROLS_V1';

function requireReplace(source, searchValue, replacement, label) {
  if (source.includes(replacement)) return source;
  if (!source.includes(searchValue)) throw new Error(`Font-size patch target not found: ${label}`);
  return source.replace(searchValue, replacement);
}

export async function applyFontSizeRuntimePatch(runtimeDir) {
  const publicJsPath = path.join(runtimeDir, 'visual-public.js');
  const publicCssPath = path.join(runtimeDir, 'visual-public.css');
  const builderJsPath = path.join(runtimeDir, 'visual-builder.js');
  const builderCssPath = path.join(runtimeDir, 'visual-builder.css');

  let publicJs = await fs.readFile(publicJsPath, 'utf8');
  let publicCss = await fs.readFile(publicCssPath, 'utf8');
  let builderJs = await fs.readFile(builderJsPath, 'utf8');
  let builderCss = await fs.readFile(builderCssPath, 'utf8');

  if (!publicJs.includes(FONT_MARKER)) {
    const sectionClassOld = "const sectionClass=s=>`wb-section wb-${esc(s.section_type)} wb-layout-${esc(s.design?.layout||'default')}`;";
    const sectionClassNew = [
      `/* ${FONT_MARKER} */`,
      "const fontClassList=s=>{const d=s.design||{};return [d.title_size?'wb-font-title':'',d.subtitle_size?'wb-font-subtitle':'',d.body_size?'wb-font-body':'',d.eyebrow_size?'wb-font-eyebrow':'',d.button_size?'wb-font-button':'',d.card_title_size?'wb-font-card-title':'',d.card_text_size?'wb-font-card-text':'',d.stat_size?'wb-font-stat':''].filter(Boolean).join(' ')};",
      "const sectionClass=s=>`wb-section wb-${esc(s.section_type)} wb-layout-${esc(s.design?.layout||'default')} ${fontClassList(s)}`;"
    ].join('\n');
    publicJs = requireReplace(publicJs, sectionClassOld, sectionClassNew, 'section class');

    const maxWidthLine = "  `--section-max:${clamp(num(design.max_width||1180),640,1600)}px`,\n";
    const fontVars = [
      maxWidthLine.trimEnd(),
      "  `--section-title-size:${clamp(num(design.title_size||0),0,96)}px`,",
      "  `--section-subtitle-size:${clamp(num(design.subtitle_size||0),0,56)}px`,",
      "  `--section-body-size:${clamp(num(design.body_size||0),0,36)}px`,",
      "  `--section-eyebrow-size:${clamp(num(design.eyebrow_size||0),0,30)}px`,",
      "  `--section-button-size:${clamp(num(design.button_size||0),0,28)}px`,",
      "  `--section-card-title-size:${clamp(num(design.card_title_size||0),0,42)}px`,",
      "  `--section-card-text-size:${clamp(num(design.card_text_size||0),0,32)}px`,",
      "  `--section-stat-size:${clamp(num(design.stat_size||0),0,88)}px`,"
    ].join('\n') + '\n';
    publicJs = requireReplace(publicJs, maxWidthLine, fontVars, 'font CSS variables');
    await fs.writeFile(publicJsPath, publicJs);
  }

  if (!publicCss.includes(FONT_MARKER)) {
    publicCss += `\n\n/* ${FONT_MARKER} */
.wb-font-title .wb-title{font-size:var(--section-title-size)!important;line-height:1.22!important}
.wb-font-subtitle .wb-subtitle{font-size:var(--section-subtitle-size)!important;line-height:1.75!important}
.wb-font-body .wb-body,.wb-font-body .wb-text-card,.wb-font-body .wb-image-text-copy>.wb-body{font-size:var(--section-body-size)!important;line-height:1.95!important}
.wb-font-eyebrow .wb-eyebrow{font-size:var(--section-eyebrow-size)!important}
.wb-font-button .wb-btn{font-size:var(--section-button-size)!important}
.wb-font-card-title .wb-card h3,.wb-font-card-title .wb-faq summary,.wb-font-card-title .wb-price strong{font-size:var(--section-card-title-size)!important;line-height:1.45!important}
.wb-font-card-text .wb-card p,.wb-font-card-text .wb-faq p,.wb-font-card-text .wb-meta,.wb-font-card-text .wb-stat span{font-size:var(--section-card-text-size)!important;line-height:1.85!important}
.wb-font-stat .wb-stat strong{font-size:var(--section-stat-size)!important;line-height:1.15!important}
@media(max-width:720px){
  .wb-font-title .wb-title{font-size:calc(var(--section-title-size)*.78)!important}
  .wb-font-subtitle .wb-subtitle{font-size:calc(var(--section-subtitle-size)*.9)!important}
  .wb-font-stat .wb-stat strong{font-size:calc(var(--section-stat-size)*.82)!important}
}
`;
    await fs.writeFile(publicCssPath, publicCss);
  }

  if (!builderJs.includes(FONT_MARKER)) {
    const appearanceMarker = '<div class="vb-section-toolbar"><h3>المظهر والمسافات</h3></div>';
    const typographyControls = [
      `<!-- ${FONT_MARKER} -->`,
      '<div class="vb-section-toolbar vb-font-size-toolbar"><div><h3>أحجام الخطوط</h3><small>القيمة 0 تعني استخدام الحجم التلقائي المتوافق مع التصميم.</small></div><button type="button" class="vb-btn vb-btn-sm vb-btn-ghost" data-reset-font-sizes>إعادة الضبط</button></div>',
      '<div class="vb-row-3">${rangeField(\'حجم العنوان\',\'design.title_size\',d.title_size||0,0,96,1)}${rangeField(\'العنوان الفرعي\',\'design.subtitle_size\',d.subtitle_size||0,0,56,1)}${rangeField(\'حجم النص\',\'design.body_size\',d.body_size||0,0,36,1)}</div>',
      '<div class="vb-row-3">${rangeField(\'النص العلوي الصغير\',\'design.eyebrow_size\',d.eyebrow_size||0,0,30,1)}${rangeField(\'نص الأزرار\',\'design.button_size\',d.button_size||0,0,28,1)}${rangeField(\'عناوين البطاقات\',\'design.card_title_size\',d.card_title_size||0,0,42,1)}</div>',
      '<div class="vb-row-3">${rangeField(\'نصوص البطاقات\',\'design.card_text_size\',d.card_text_size||0,0,32,1)}${rangeField(\'حجم أرقام الإحصاءات\',\'design.stat_size\',d.stat_size||0,0,88,1)}<div class="vb-font-size-note"><strong>معاينة فورية</strong><span>تظهر الأحجام مباشرة على الحاسوب والجوال، ثم تُحفظ مع القسم.</span></div></div>'
    ].join('');
    builderJs = requireReplace(builderJs, appearanceMarker, typographyControls + appearanceMarker, 'typography controls');

    const inspectorBindMarker = "$$('[data-layout]',root).forEach(b=>b.addEventListener('click',()=>{pushHistory(snapshot());s.design=s.design||{};s.design.layout=b.dataset.layout;markSection(s,true);renderInspector();renderSections()}));";
    const resetHandler = inspectorBindMarker + "const resetFonts=$('[data-reset-font-sizes]',root);if(resetFonts)resetFonts.addEventListener('click',()=>{pushHistory(snapshot());s.design=s.design||{};['title_size','subtitle_size','body_size','eyebrow_size','button_size','card_title_size','card_text_size','stat_size'].forEach(key=>delete s.design[key]);markSection(s,true);renderInspector();renderSections()});";
    builderJs = requireReplace(builderJs, inspectorBindMarker, resetHandler, 'font reset handler');
    await fs.writeFile(builderJsPath, builderJs);
  }

  if (!builderCss.includes(FONT_MARKER)) {
    builderCss += `\n\n/* ${FONT_MARKER} */
.vb-font-size-toolbar{align-items:flex-start;gap:14px}
.vb-font-size-toolbar>div{min-width:0}
.vb-font-size-toolbar h3{margin-bottom:2px}
.vb-font-size-toolbar small{display:block;color:var(--vb-muted);font-size:11px;line-height:1.65}
.vb-font-size-note{border:1px dashed color-mix(in srgb,var(--vb-gold) 45%,var(--vb-line));border-radius:14px;background:color-mix(in srgb,var(--vb-gold) 8%,#fff);padding:12px 14px;display:flex;flex-direction:column;justify-content:center;min-height:78px}
.vb-font-size-note strong{color:var(--vb-navy);font-size:13px}.vb-font-size-note span{color:var(--vb-muted);font-size:11px;line-height:1.65}
@media(max-width:680px){.vb-font-size-toolbar{flex-direction:column}.vb-font-size-toolbar [data-reset-font-sizes]{width:100%}}
`;
    await fs.writeFile(builderCssPath, builderCss);
  }
}
