
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const DomainConfigTab: React.FC = () => {
  return (
    <div className="mt-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Domain Configuration</CardTitle>
          <CardDescription>Set up the DEVONN.AI Framework on the canonical d3vonn.io domain</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <h3 className="text-lg font-semibold">Production DNS Configuration</h3>
          <p>
            d3vonn.io uses Hostinger DNS for the current production cutover. Keep Hostinger
            nameservers active and manage the production records from the Hostinger DNS zone.
          </p>

          <div className="bg-secondary p-4 rounded-md mt-2 mb-4">
            <p className="font-semibold">Required production records:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><code>A apex → 76.76.21.21</code> for the Vercel apex frontend.</li>
              <li><code>CNAME www → cname.vercel-dns.com</code> for the Vercel www alias.</li>
              <li><code>CNAME api → devonn-ai-api-production.up.railway.app</code> for the Railway API service.</li>
            </ul>
          </div>

          <h3 className="text-lg font-semibold mt-4">Hostinger DNS Records</h3>
          <p>Remove conflicting parking records or duplicate records for the apex, <code>www</code>, or <code>api</code> hosts before saving these values.</p>

          <pre className="bg-secondary p-4 rounded-md overflow-x-auto mt-2">
            <code>{`Type    Host     Value
A       apex     76.76.21.21
CNAME   www      cname.vercel-dns.com
CNAME   api      devonn-ai-api-production.up.railway.app`}</code>
          </pre>

          <h3 className="text-lg font-semibold mt-4">Vercel Frontend Domains</h3>
          <p>Attach the frontend project domains in Vercel:</p>

          <pre className="bg-secondary p-4 rounded-md overflow-x-auto mt-2">
            <code>{`d3vonn.io
www.d3vonn.io`}</code>
          </pre>

          <h3 className="text-lg font-semibold mt-4">Railway API Domain</h3>
          <p>Attach the API service custom domain in Railway:</p>

          <pre className="bg-secondary p-4 rounded-md overflow-x-auto mt-2">
            <code>{`api.d3vonn.io`}</code>
          </pre>

          <h3 className="text-lg font-semibold mt-4">Verification Commands</h3>
          <pre className="bg-secondary p-4 rounded-md overflow-x-auto mt-2">
            <code>{`nslookup d3vonn.io
nslookup www.d3vonn.io
nslookup api.d3vonn.io
curl -I https://d3vonn.io
curl -I https://www.d3vonn.io
curl https://api.d3vonn.io/health`}</code>
          </pre>

          <div className="bg-amber-50 border border-amber-200 p-4 rounded-md mt-6">
            <h4 className="font-semibold text-amber-800">Important Notes:</h4>
            <ul className="list-disc pl-6 text-amber-900 mt-2">
              <li>DNS propagation can vary by resolver and network.</li>
              <li>Always verify SSL status in both Vercel and Railway before announcing cutover completion.</li>
              <li>Use registrar and Hostinger dashboard evidence instead of hardcoded domain-expiry assumptions.</li>
              <li>Do not start production cutover until PR #249 review items and release gates are resolved.</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DomainConfigTab;
