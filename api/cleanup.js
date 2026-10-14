// Endpoint antigo mantido inerte: nenhum acesso ao banco ou exclusão.
module.exports = function handler(req, res) {
 res.setHeader('Cache-Control', 'no-store');
 return res.status(410).json({enabled:false, message:'Limpeza automática desativada. Os cultos são preservados.'});
};
