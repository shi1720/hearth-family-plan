import {identity,load,db,fail} from '@/lib/server';
import {assertRole} from '@/lib/domain';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{const u=identity(req),x=await load(req,u);assertRole(x.role,['owner']);const rows=await db().prepare('SELECT revision,state,created_at AS createdAt FROM revisions WHERE household=? ORDER BY revision DESC LIMIT 100').bind(x.state.id).all();return Response.json({format:'hearth.plan-history.v1',currentRevision:x.revision,versions:rows.results.map((r:any)=>({...r,state:JSON.parse(r.state)}))},{headers:{'Cache-Control':'no-store','Content-Disposition':'attachment; filename="hearth-plan-history.json"'}});}catch(e){return fail(e);}}
