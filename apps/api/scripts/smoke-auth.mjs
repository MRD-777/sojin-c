import { createClient } from '@supabase/supabase-js';
const URL='https://tbezbzlsuerjlohaoawy.supabase.co';
const ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRiZXpiemxzdWVyamxvaGFvYXd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwMjk4NDksImV4cCI6MjA5MTYwNTg0OX0.SzhEElAbXjvKK287dMKW6zdi-lmkyRJjQHE-OSLBwLs';
const api='http://localhost:4000';
const s=createClient(URL,ANON,{auth:{persistSession:false}});
const {data,error}=await s.auth.signInWithPassword({email:'admin@demo.com',password:'Admin123!'});
if(error){console.log('LOGIN FAIL',error.message);process.exit(1);}
const tok=data.session.access_token;

async function hit(path,token){
  const r=await fetch(api+path,{headers:token?{Authorization:'Bearer '+token}:{}});
  let body=''; try{body=JSON.stringify(await r.json()).slice(0,300);}catch{}
  return `${r.status}  ${body}`;
}
console.log('1) valid ES256 token  -> GET /api/v1/projects :', await hit('/api/v1/projects',tok));
console.log('2) no token           -> GET /api/v1/projects :', await hit('/api/v1/projects',null));
console.log('3) garbage token      -> GET /api/v1/projects :', await hit('/api/v1/projects','not.a.jwt'));
