// Deploy only Hearth's isolated gateway and Hosting site. No credentials in Git.
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const exec = promisify(execFile);
const root = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const project = option('--project', 'epilogue-508616');
const site = option('--site', 'hearth-family-plan');
const region = 'us-central1';
const service = 'hearth-family-gateway';
const envFile = option('--env-file');
const hostingOnly = args.includes('--hosting-only');
if (!/^[a-z][a-z0-9-]{4,61}$/.test(project) || !/^[a-z0-9][a-z0-9-]{1,29}$/.test(site)) throw Error('Invalid project or site.');
async function command(parts) {
  const result = await exec('gcloud', parts, { cwd: root, maxBuffer: 12 * 1024 * 1024 });
  // These commands contain resource names only. Access tokens are never printed.
  if (result.stdout.trim()) console.log(result.stdout.trim());
  if (result.stderr.trim()) console.log(result.stderr.trim());
}
if (!hostingOnly) {
  if (!envFile) throw Error('Provide --env-file with non-secret gateway configuration; secrets are read from Secret Manager.');
  const env = JSON.parse(await readFile(path.resolve(envFile), 'utf8'));
  if (env.APP_ORIGIN !== `https://${site}.web.app`) throw Error('The configured application origin must match the selected Hosting site.');
  if (Object.keys(env).some(k => /SECRET|TOKEN|PASSWORD|META_API_KEY/.test(k))) throw Error('Keep secrets in Secret Manager, not the public runtime configuration.');
  const number = execFileSync('gcloud', ['projects','describe',project,'--format=value(projectNumber)'], { encoding:'utf8' }).trim();
  const tag = execFileSync('git',['rev-parse','--short=12','HEAD'],{cwd:root,encoding:'utf8'}).trim() + '-' + Date.now();
  const image = `${region}-docker.pkg.dev/${project}/hearth-family/gateway:${tag}`;
  console.log('Building the isolated Hearth gateway container.');
  await command(['builds','submit','gateway','--project='+project,'--region='+region,'--config=gateway/cloudbuild.yaml','--service-account=projects/'+project+'/serviceAccounts/hearth-family-build@'+project+'.iam.gserviceaccount.com','--gcs-source-staging-dir=gs://hearth-family-build-'+number+'/source','--substitutions=_IMAGE='+image,'--quiet']);
  console.log('Deploying the gateway with bounded capacity and server-side secrets.');
  await command(['run','deploy',service,'--project='+project,'--region='+region,'--image='+image,'--service-account='+service+'@'+project+'.iam.gserviceaccount.com','--allow-unauthenticated','--memory=512Mi','--cpu=1','--concurrency=10','--min-instances=0','--max-instances=2','--timeout=300','--set-secrets=HEARTH_BRIDGE_SECRET=hearth-family-bridge:latest,HEARTH_COOKIE_SECRET=hearth-family-cookie:latest','--env-vars-file='+path.resolve(envFile),'--quiet']);
}
const token = execFileSync('gcloud',['auth','print-access-token'],{encoding:'utf8'}).trim();
async function api(method, url, body) {
  const response = await fetch(url,{ method, headers:{Authorization:`Bearer ${token}`,'x-goog-user-project':project,'Content-Type':'application/json'}, ...(body ? {body:JSON.stringify(body)} : {}), signal:AbortSignal.timeout(60000) });
  const value = await response.json();
  if (!response.ok) throw Error(`Firebase ${method} failed (${response.status}): ${value.error?.message || 'Unknown error'}`);
  return value;
}
const base = 'https://firebasehosting.googleapis.com/v1beta1';
await api('GET',`${base}/projects/${project}/sites/${site}`);
const version = await api('POST',`${base}/sites/${site}/versions`,{config:{rewrites:[{glob:'**',run:{serviceId:service,region}}],headers:[{glob:'**',headers:{'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'}}]},labels:{application:'hearth'}});
await api('PATCH',`${base}/${version.name}?updateMask=status`,{status:'FINALIZED'});
const release = await api('POST',`${base}/sites/${site}/releases?versionName=${encodeURIComponent(version.name)}`,{message:'Hearth application and evaluation review'});
const origin = `https://${site}.web.app`;
const health = await fetch(origin+'/api/health',{signal:AbortSignal.timeout(30000)});
if (!health.ok || !(await health.json()).ok) throw Error('The released gateway health check failed.');
const privateApi = await fetch(origin+'/api/workspace',{signal:AbortSignal.timeout(30000)});
if (privateApi.status !== 401) throw Error('Anonymous workspace access must be rejected.');
const result = {url:origin,project,site,service,version:version.name,release:release.name,verifiedAt:new Date().toISOString(),anonymousWorkspaceStatus:privateApi.status};
await mkdir(path.join(root,'work'),{recursive:true});
await writeFile(path.join(root,'work/firebase-deployment.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
