const fields = 'code,product_name,product_name_es,brands,image_front_small_url,image_front_url,nutriscore_grade,nutriscore_score,nova_group,categories,quantity,countries_tags,ingredients_text,additives_n,nutriments,allergens_tags,additives_tags,ingredients,ingredients_text_es,ingredients_analysis_tags,ecoscore_grade,labels_tags,serving_size,completeness';
class InputError extends Error {}
function text(value, max = 120) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\x00-\x1f\x7f]/.test(value)) throw new InputError('Invalid text');
  return value.trim();
}
function integer(value, fallback, max) {
  if (value === undefined) return fallback;
  if ((typeof value !== 'string' && typeof value !== 'number') || !/^\d+$/.test(String(value)) || +value < 1 || +value > max) throw new InputError('Invalid number');
  return +value;
}
function build(kind, q) {
  let url;
  if (kind === 'invima') {
    if (!['ui32-p9f2', 'uhs6-qp53'].includes(q.ds)) throw new InputError('Invalid dataset');
    url = new URL(`https://www.datos.gov.co/resource/${q.ds}.json`);
    const t = text(q.q).toUpperCase().replace(/'/g, "''");
    // contains() treats percent and underscore literally, unlike LIKE.
    const match = column => `contains(upper(${column}), '${t}')`;
    let where;
    if (q.ds === 'uhs6-qp53') where = match('razon_social');
    else {
      where = `upper(nombredireccion) like '%ALIMENTOS%' AND `;
      where += q.mode === 'holder' || q.mode === 'count' ? match('titular') : `(${match('producto')} OR ${match('titular')})`;
    }
    url.searchParams.set('$where', where);
    url.searchParams.set('$limit', integer(q.limit, 40, 120));
    if (q.mode === 'count') {
      if (q.ds !== 'ui32-p9f2') throw new InputError('Invalid mode');
      url.searchParams.set('$select', 'estadoregistro, count(*) as total');
      url.searchParams.set('$group', 'estadoregistro');
    } else if (q.mode && !['search', 'holder'].includes(q.mode)) throw new InputError('Invalid mode');
  } else {
    if (kind === 'product') {
      if (typeof q.code !== 'string' || !/^\d{8,14}$/.test(q.code)) throw new InputError('Invalid barcode');
      url = new URL(`https://world.openfoodfacts.org/api/v2/product/${q.code}.json`);
    } else {
      url = new URL('https://search.openfoodfacts.org/search');
      let query;
      if (kind === 'search') {
        // Quote each token: user input is literal text, not arbitrary Lucene syntax.
        query = text(q.q).split(/\s+/).map(word => JSON.stringify(word)).join(' ');
      } else {
        const tag = text(q.tag, 100);
        if (!/^[a-z]{2}:[a-z0-9-]+$/.test(tag)) throw new InputError('Invalid category');
        query = 'categories:' + JSON.stringify(tag);
      }
      if (q.colombiaOnly === '1') query += ' countries:"en:colombia"';
      url.searchParams.set('q', query);
      url.searchParams.set('page', integer(q.page, 1, 100));
      url.searchParams.set('page_size', integer(q.pageSize, 24, 50));
    }
    url.searchParams.set('fields', fields);
  }
  return url;
}
function handler(kind) {
  return async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({error:{code:'method_not_allowed',message:'GET required'}}); }
    try {
      const url = build(kind, req.query);
      const isSearch = kind === 'search' || kind === 'category';
      const headers = {Accept:'application/json', 'User-Agent':'canastaclara/1.2 (juan.gutierreztor@cun.edu.co)'};
      const options = {headers, signal:AbortSignal.timeout(9000), redirect:'error'};
      if (isSearch) {
        headers['Content-Type'] = 'application/json';
        options.method = 'POST';
        options.body = JSON.stringify({
          q: url.searchParams.get('q'),
          page: Number(url.searchParams.get('page')),
          page_size: Number(url.searchParams.get('page_size')),
          fields: fields.split(',').concat(['countries', 'categories']),
          langs: ['es', 'en'], boost_phrase: true,
        });
        // Query text stays in the server-to-server POST body, not the upstream URL.
        url.search = '';
      }
      const response = await fetch(url, options);
      if (kind === 'product' && response.status === 404) return res.status(200).json({status:0,product:null});
      if (!response.ok) {
        console.warn('upstream_status', kind, response.status);
        const status = [429, 503].includes(response.status) ? response.status : 502;
        if ([429, 503].includes(status)) res.setHeader('Retry-After', '60');
        return res.status(status).json({error:{code:'upstream_unavailable',message:'Proveedor temporalmente no disponible. Intenta más tarde.'}});
      }
      if (!response.headers.get('content-type')?.includes('json')) throw new Error('Invalid upstream response');
      let body = '';
      let bytes = 0;
      const decoder = new TextDecoder();
      for await (const chunk of response.body) {
        bytes += chunk.byteLength;
        if (bytes > 4000000) throw new Error('Response too large');
        body += decoder.decode(chunk, {stream:true});
      }
      body += decoder.decode();
      let data = JSON.parse(body);
      if (isSearch) {
        if (!Array.isArray(data.hits) || data.timed_out || !Number.isFinite(Number(data.count))) throw new Error('Invalid search response');
        data = {
          products: data.hits.map(hit => {
            if (!hit || typeof hit !== 'object' || !/^\d{8,14}$/.test(String(hit.code))) throw new Error('Invalid search hit');
            return {...hit,
              product_name: hit.product_name_es || hit.product_name || hit.product_name_en || '',
              brands: Array.isArray(hit.brands) ? hit.brands.map(brand => String(brand).replace(/^[a-z]{2}:/, '')).join(', ') : hit.brands || '',
              categories: Array.isArray(hit.categories) ? hit.categories.join(', ') : hit.categories || '',
              countries_tags: hit.countries_tags || hit.countries || [],
            };
          }),
          count: Number(data.count), page: Number(data.page), page_size: Number(data.page_size),
          is_count_exact: data.is_count_exact,
        };
      }
      if (kind === 'invima' ? !Array.isArray(data) : !data || typeof data !== 'object' || (kind !== 'product' && !Array.isArray(data.products))) throw new Error('Invalid schema');
      res.setHeader('Cache-Control','public, s-maxage=300, stale-while-revalidate=600');
      return res.status(200).json(data);
    } catch (e) {
      if (!(e instanceof InputError)) console.warn('upstream_error', kind, e.name, e.message);
      const status = e instanceof InputError ? 400 : ['TimeoutError','AbortError'].includes(e.name) ? 504 : 502;
      return res.status(status).json({error:{code:status === 400 ? 'invalid_input' : 'upstream_unavailable',message:status === 400 ? 'Parámetros inválidos.' : 'Proveedor temporalmente no disponible. Intenta más tarde.'}});
    }
  };
}
module.exports = {handler, build};
