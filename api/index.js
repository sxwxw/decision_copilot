import app from '../server/index.js'

export default function handler(req, res) {
  // Vercel serverless: strip /api prefix since vercel.json rewrites route /api/* here
  // The app expects routes like /api/decision/*, /api/health
  // vercel.json rewrite passes the full path, so no need to modify url

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  return app(req, res)
}
