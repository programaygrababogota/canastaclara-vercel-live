const {collect}=require('../lib/official');
module.exports=async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:{message:'GET requerido'}});}
 const mode=req.query.mode||'documents';
 if(!['documents','news'].includes(mode))return res.status(400).json({error:{message:'Modo inválido'}});
 const data=await collect(mode);
 res.setHeader('Cache-Control','public, s-maxage=900, stale-while-revalidate=300');
 return res.status(200).json(data);
};
