import { promises as fs } from 'node:fs';
import path from 'node:path';
import { applySectionTypesRuntimePatch } from './section-types-runtime-patch.mjs';

const MARKER = 'WAQF_PAGE_MEDIA_REFERENCE_GUARD_V1';

function replaceRequired(source, searchValue, replacement, label) {
  if (source.includes(replacement)) return source;
  if (!source.includes(searchValue)) throw new Error(`Media-reference patch target not found: ${label}`);
  return source.replace(searchValue, replacement);
}

export async function applyMediaReferenceRuntimePatch(runtimeDir) {
  const visualBuilderPath = path.join(runtimeDir, 'visual-builder.js');
  const visualApiPath = path.join(runtimeDir, 'visual-builder-patch.mjs');
  const cmsAdminPath = path.join(runtimeDir, 'cms-admin.js');
  const cmsApiPath = path.join(runtimeDir, 'cms-patch.mjs');

  let visualBuilder = await fs.readFile(visualBuilderPath, 'utf8');
  let visualApi = await fs.readFile(visualApiPath, 'utf8');
  let cmsAdmin = await fs.readFile(cmsAdminPath, 'utf8');
  let cmsApi = await fs.readFile(cmsApiPath, 'utf8');

  if (!visualBuilder.includes(MARKER)) {
    const oldValue = 'og_media_id:p.og_media_id||null';
    const newValue = `/* ${MARKER} */og_media_id:((state.data.media||[]).some(media=>String(media.id)===String(p.og_media_id))?Number(p.og_media_id):null)`;
    visualBuilder = replaceRequired(visualBuilder, oldValue, newValue, 'visual editor page save');
    await fs.writeFile(visualBuilderPath, visualBuilder);
  }

  if (!visualApi.includes(MARKER)) {
    const oldBody = "const body=pick(await parseJson(req),pageFields);if(body.slug)";
    const newBody = `const body=pick(await parseJson(req),pageFields);/* ${MARKER} */if(Object.prototype.hasOwnProperty.call(body,'og_media_id')){const mediaId=Number(body.og_media_id);body.og_media_id=Number.isSafeInteger(mediaId)&&mediaId>0?mediaId:null}if(body.slug)`;
    visualApi = replaceRequired(visualApi, oldBody, newBody, 'visual API page payload');
    await fs.writeFile(visualApiPath, visualApi);
  }

  if (!cmsAdmin.includes(MARKER)) {
    const oldConversion = "for(const k of ['sort_order','page_id','og_media_id'])if(k in v)v[k]=v[k]?N(v[k]):null;";
    const newConversion = `for(const k of ['sort_order','page_id'])if(k in v)v[k]=v[k]?N(v[k]):null;/* ${MARKER} */if('og_media_id' in v){const mediaId=N(v.og_media_id);v.og_media_id=Number.isSafeInteger(mediaId)&&mediaId>0?mediaId:null}`;
    cmsAdmin = replaceRequired(cmsAdmin, oldConversion, newConversion, 'CMS page form payload');
    await fs.writeFile(cmsAdminPath, cmsAdmin);
  }

  if (!cmsApi.includes(MARKER)) {
    const oldConversion = "for(const k of ['sort_order','page_id','og_media_id','product_id','media_id'])if(o[k]!==undefined)o[k]=o[k]===''?null:num(o[k]);";
    const newConversion = `for(const k of ['sort_order','page_id','product_id','media_id'])if(o[k]!==undefined)o[k]=o[k]===''?null:num(o[k]);/* ${MARKER} */if(o.og_media_id!==undefined){const mediaId=Number(o.og_media_id);o.og_media_id=Number.isSafeInteger(mediaId)&&mediaId>0?mediaId:null}`;
    cmsApi = replaceRequired(cmsApi, oldConversion, newConversion, 'CMS API payload normalization');
    await fs.writeFile(cmsApiPath, cmsApi);
  }

  await applySectionTypesRuntimePatch(runtimeDir);
}