// Shared by the browser and Node live runners. Production smoke tests are read-only.
const liveCases = [
 ['/api/product?code=3017620422003',200,d=>!!d.product?.product_name],
 ['/api/product?code=0000000000000',200,d=>d.status===0],
 ['/api/product?code=abc',400,d=>!!d.error],
 ['/api/search?q=yogur&pageSize=2',200,d=>Array.isArray(d.products)&&d.products.length===2&&d.products.every(p=>/^\d{8,14}$/.test(p.code)&&p.product_name)],
 ['/api/category?tag=en:chocolates&pageSize=2',200,d=>Array.isArray(d.products)&&d.products.length===2&&d.products.every(p=>p.categories.includes('en:chocolates'))],
 ['/api/invima?ds=uhs6-qp53&q=ALQUERIA&limit=2',200,d=>Array.isArray(d)&&d.length<=2],
 ['/api/invima?ds=ui32-p9f2&q=LECHE&limit=2',200,d=>Array.isArray(d)&&d.length<=2],
 ['/api/invima?ds=evil&q=test',400,d=>!!d.error],
 ['/api/search?q=yogur&pageSize=2&colombiaOnly=1',200,d=>d.products?.length>0&&d.products.every(p=>p.countries_tags.includes('en:colombia'))],
 ['/api/category?tag=en:chocolates&pageSize=2&colombiaOnly=1',200,d=>d.products?.length>0&&d.products.every(p=>p.countries_tags.includes('en:colombia')&&p.categories.includes('en:chocolates'))],
 ['/api/search?q=yogur&pageSize=2&page=2',200,d=>d.page===2&&d.products?.length===2],
 ['/api/search?q=zzzxqvnomatchcanastaclara',200,d=>d.count===0&&d.products?.length===0],
 ['/api/search?q=yogur&pageSize=999',400,d=>!!d.error],
 ['/api/category?tag=invalid',400,d=>!!d.error],
];
if (typeof module !== 'undefined') module.exports = liveCases;
